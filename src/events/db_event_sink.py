from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional, Tuple

from sqlalchemy.orm import Session

from src.database.init_db import init_db
from src.database.models import ActionAlert, EventSegment, VideoRun
from src.database.session import SessionLocal


@dataclass
class SegmentAccumulator:
    stable_id: int
    object_label: str
    action_label: str
    stable_id_event: str
    identity_update_ok: bool
    memory_update_ok: bool
    start_frame: int
    end_frame: int
    start_timestamp_s: float
    end_timestamp_s: float
    det_conf_sum: float
    action_score_sum: float
    mask_ratio_sum: float
    sample_count: int
    first_raw_track_id: Optional[int]
    last_raw_track_id: Optional[int]
    # accumulate per-segment scene context counts (class -> pixels or occurance weight)
    scene_context_counts: Dict[str, int] = field(default_factory=dict)

    @classmethod
    def from_event(cls, event: Dict) -> "SegmentAccumulator":
        ts = float(event.get("timestamp_s", 0.0))
        frame_idx = int(event.get("frame_idx", 0))
        raw_track_id = event.get("raw_track_id")
        raw_track_id_int = int(raw_track_id) if raw_track_id is not None else None
        det_conf = float(event.get("det_conf", 0.0))
        action_score = float(event.get("action_score", 0.0))
        mask_ratio = float(event.get("mask_ratio", 0.0))
        return cls(
            stable_id=int(event["stable_id"]),
            object_label=str(event.get("object_label", "person")),
            action_label=str(event.get("action_label", "pending")),
            stable_id_event=str(event.get("stable_id_event", "unknown")),
            identity_update_ok=bool(event.get("identity_update_ok", False)),
            memory_update_ok=bool(event.get("memory_update_ok", False)),
            start_frame=frame_idx,
            end_frame=frame_idx,
            start_timestamp_s=ts,
            end_timestamp_s=ts,
            det_conf_sum=det_conf,
            action_score_sum=action_score,
            mask_ratio_sum=mask_ratio,
            sample_count=1,
            first_raw_track_id=raw_track_id_int,
            last_raw_track_id=raw_track_id_int,
            scene_context_counts={
                str(c.get("class", c.get("label", ""))): int(c.get("pixels", 0))
                for c in (event.get("scene_context") or [])
                if (c.get("class") or c.get("label"))
            },
        )

    def dedupe_key(self) -> Tuple:
        return (
            self.stable_id,
            self.object_label,
            self.action_label,
        )

    def can_extend(self, event: Dict) -> bool:
        if int(event["stable_id"]) != self.stable_id:
            return False
        candidate_key = (
            int(event["stable_id"]),
            str(event.get("object_label", "person")),
            str(event.get("action_label", "pending")),
        )
        return candidate_key == self.dedupe_key()

    def extend(self, event: Dict) -> None:
        self.end_frame = int(event.get("frame_idx", self.end_frame))
        self.end_timestamp_s = float(event.get("timestamp_s", self.end_timestamp_s))
        self.det_conf_sum += float(event.get("det_conf", 0.0))
        self.action_score_sum += float(event.get("action_score", 0.0))
        self.mask_ratio_sum += float(event.get("mask_ratio", 0.0))
        self.sample_count += 1
        self.identity_update_ok = self.identity_update_ok and bool(event.get("identity_update_ok", False))
        self.memory_update_ok = self.memory_update_ok and bool(event.get("memory_update_ok", False))
        self.last_raw_track_id = int(event["raw_track_id"]) if event.get("raw_track_id") is not None else self.last_raw_track_id
        # merge scene context counts from the new event into the accumulator
        for c in (event.get("scene_context") or []):
            label = str(c.get("class", c.get("label", "")))
            if not label:
                continue
            pixels = int(c.get("pixels", 0))
            self.scene_context_counts[label] = self.scene_context_counts.get(label, 0) + pixels


class DBEventSink:
    """Persist deduplicated track events as temporal segments in PostgreSQL."""

    def __init__(
        self,
        input_path: str,
        output_path: str,
        fps: float,
        frame_width: int,
        frame_height: int,
        run_name: str = "",
        commit_every_segments: int = 50,
        scene_context_topk: int = 5,
    ):
        init_db()
        self.session: Session = SessionLocal()
        self.run = VideoRun(
            run_name=run_name or None,
            input_path=input_path,
            output_path=output_path,
            fps=float(fps),
            frame_width=int(frame_width),
            frame_height=int(frame_height),
            started_at=datetime.utcnow(),
        )
        self.session.add(self.run)
        self.session.flush()
        self._run_id = self.run.id

        self.active: Dict[int, SegmentAccumulator] = {}
        self.last_frame_idx = 0
        self._pending_segments = 0
        self._commit_every_segments = max(int(commit_every_segments), 1)
        self._scene_context_topk = int(scene_context_topk) if scene_context_topk is not None else 0

    @property
    def run_id(self) -> str:
        return self._run_id

    def add_track_event(self, event: Dict) -> None:
        self.last_frame_idx = int(event.get("frame_idx", self.last_frame_idx))
        stable_id = int(event["stable_id"])
        segment = self.active.get(stable_id)
        if segment is None:
            self.active[stable_id] = SegmentAccumulator.from_event(event)
            return

        if segment.can_extend(event):
            segment.extend(event)
            return

        self._flush_segment(segment)
        self.active[stable_id] = SegmentAccumulator.from_event(event)

    def finalize(self, total_frames: Optional[int] = None) -> None:
        for stable_id, segment in list(self.active.items()):
            self._flush_segment(segment)
            self.active.pop(stable_id, None)
        self.run.ended_at = datetime.utcnow()
        self.run.total_frames = int(total_frames) if total_frames is not None else self.last_frame_idx
        self.session.commit()
        self.session.close()

    def add_alert(self, alert: Dict) -> None:
        row = ActionAlert(
            run_id=self._run_id,
            stable_id=int(alert["stable_id"]),
            rule_name=str(alert.get("rule_name", "unnamed_rule")),
            severity=str(alert.get("severity", "medium")),
            action_label=str(alert.get("action_label", "unknown")),
            action_score=float(alert.get("action_score", 0.0)),
            frame_idx=int(alert.get("frame_idx", 0)),
            timestamp_s=float(alert.get("timestamp_s", 0.0)),
            message=str(alert.get("message", "")),
            metadata_json=json.dumps(alert.get("metadata", {}), ensure_ascii=True),
        )
        self.session.add(row)
        self._pending_segments += 1
        if self._pending_segments >= self._commit_every_segments:
            self.session.commit()
            self._pending_segments = 0

    def _flush_segment(self, segment: SegmentAccumulator) -> None:
        sample_count = max(int(segment.sample_count), 1)
        # build comma-separated top-K scene context from accumulated counts
        scene_context_csv = None
        try:
            if segment.scene_context_counts:
                sorted_items = sorted(
                    segment.scene_context_counts.items(), key=lambda kv: kv[1], reverse=True
                )
                k = max(int(self._scene_context_topk), 0)
                if k > 0:
                    topk = [label for label, _ in sorted_items[:k]]
                else:
                    topk = [label for label, _ in sorted_items]
                scene_context_csv = ",".join(topk) if topk else None
        except Exception:
            scene_context_csv = None

        row = EventSegment(
            run_id=self._run_id,
            stable_id=segment.stable_id,
            object_label=segment.object_label,
            stable_id_event=segment.stable_id_event,
            action_label=segment.action_label,
            identity_update_ok=segment.identity_update_ok,
            memory_update_ok=segment.memory_update_ok,
            start_frame=segment.start_frame,
            end_frame=segment.end_frame,
            start_timestamp_s=segment.start_timestamp_s,
            end_timestamp_s=segment.end_timestamp_s,
            avg_det_conf=segment.det_conf_sum / sample_count,
            avg_action_score=segment.action_score_sum / sample_count,
            avg_mask_ratio=segment.mask_ratio_sum / sample_count,
            sample_count=sample_count,
            first_raw_track_id=segment.first_raw_track_id,
            last_raw_track_id=segment.last_raw_track_id,
            scene_context=scene_context_csv,
        )
        self.session.add(row)
        self._pending_segments += 1
        if self._pending_segments >= self._commit_every_segments:
            self.session.commit()
            self._pending_segments = 0
