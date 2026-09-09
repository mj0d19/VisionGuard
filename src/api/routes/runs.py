from collections import Counter
from typing import Any, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.api.schemas import (
    ActionAlertOut,
    EventSegmentOut,
    LLMContextResponse,
    MinimalActionAlertOut,
    MinimalEventSegmentOut,
    VideoRunOut,
)
from src.database.models import ActionAlert, EventSegment, VideoRun
from src.llm.llm_service import LLMNotConfiguredError, ask_llm
from src.api.deps import get_db
from src.api.auth import get_current_user

router = APIRouter(tags=["runs"])


def _build_run_context(db: Session, run_id: str, max_segments: int, max_alerts: int) -> dict[str, Any]:
    run = db.query(VideoRun).filter(VideoRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    segments = (
        db.query(EventSegment)
        .filter(EventSegment.run_id == run_id)
        .order_by(EventSegment.start_timestamp_s.asc())
        .limit(max_segments)
        .all()
    )
    alerts = (
        db.query(ActionAlert)
        .filter(ActionAlert.run_id == run_id)
        .order_by(ActionAlert.timestamp_s.asc())
        .limit(max_alerts)
        .all()
    )

    compact_segments = [
        MinimalEventSegmentOut(
            stable_id=seg.stable_id,
            object_label=seg.object_label,
            action_label=seg.action_label,
            start_timestamp_s=seg.start_timestamp_s,
            end_timestamp_s=seg.end_timestamp_s,
        )
        for seg in segments
    ]
    compact_alerts = [
        MinimalActionAlertOut(
            stable_id=alert.stable_id,
            rule_name=alert.rule_name,
            severity=alert.severity,
            action_label=alert.action_label,
            action_score=alert.action_score,
            frame_idx=alert.frame_idx,
            timestamp_s=alert.timestamp_s,
            message=alert.message,
        )
        for alert in alerts
    ]

    action_counter = Counter(seg.action_label for seg in segments)
    severity_counter = Counter(alert.severity for alert in alerts)
    track_ids = {seg.stable_id for seg in segments}
    segment_duration_s = max((seg.end_timestamp_s for seg in segments), default=0.0)

    summary_parts = [
        f"Run {run_id} has {len(segments)} event segments across {len(track_ids)} tracked subjects."
    ]
    if segment_duration_s:
        summary_parts.append(f"Covered duration is about {segment_duration_s:.1f}s.")
    if action_counter:
        summary_parts.append(
            "Top actions: "
            + ", ".join(f"{name} ({count})" for name, count in action_counter.most_common(5))
            + "."
        )
    if compact_alerts:
        summary_parts.append(
            "Top alert severities: "
            + ", ".join(f"{name} ({count})" for name, count in severity_counter.most_common(5))
            + "."
        )
    if run.ended_at is None:
        summary_parts.append("The run is still active or ended before a final commit.")

    return {
        "run": {
            "id": run.id,
            "run_name": run.run_name,
            "input_path": run.input_path,
            "output_path": run.output_path,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "ended_at": run.ended_at.isoformat() if run.ended_at else None,
            "fps": run.fps,
            "frame_width": run.frame_width,
            "frame_height": run.frame_height,
            "total_frames": run.total_frames,
        },
        "summary": " ".join(summary_parts),
        "segments": compact_segments,
        "alerts": compact_alerts,
        "statistics": {
            "segment_count": len(segments),
            "alert_count": len(alerts),
            "track_count": len(track_ids),
            "segment_duration_s": segment_duration_s,
            "action_counts": dict(action_counter),
            "severity_counts": dict(severity_counter),
        },
    }


@router.get("/runs", response_model=List[VideoRunOut], tags=["runs"])
def list_runs(
    limit: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return db.query(VideoRun).order_by(VideoRun.started_at.desc()).limit(limit).all()


@router.get("/runs/{run_id}/segments", response_model=List[EventSegmentOut], tags=["segments"])
def list_segments(
    run_id: str,
    stable_id: Optional[int] = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    q = db.query(EventSegment).filter(EventSegment.run_id == run_id)
    if stable_id is not None:
        q = q.filter(EventSegment.stable_id == stable_id)
    return q.order_by(EventSegment.start_frame.asc()).limit(limit).all()


@router.get("/runs/{run_id}/alerts", response_model=List[ActionAlertOut], tags=["alerts"])
def list_alerts(
    run_id: str,
    stable_id: Optional[int] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    q = db.query(ActionAlert).filter(ActionAlert.run_id == run_id)
    if stable_id is not None:
        q = q.filter(ActionAlert.stable_id == stable_id)
    if severity is not None:
        q = q.filter(ActionAlert.severity == severity)
    return q.order_by(ActionAlert.frame_idx.asc()).limit(limit).all()


@router.get("/runs/{run_id}/context", response_model=LLMContextResponse, tags=["context"])
def llm_context(
    run_id: str,
    max_segments: int = Query(default=300, ge=1, le=2000),
    max_alerts: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    context = _build_run_context(db, run_id, max_segments=max_segments, max_alerts=max_alerts)
    return LLMContextResponse(
        run_id=run_id,
        summary=context["summary"],
        segments=context["segments"],
        alerts=context["alerts"],
    )


@router.post("/runs/{run_id}/llm", tags=["llm"])
def ask_run_llm(
    run_id: str,
    question: str = Body(..., embed=True),
    max_segments: int = Query(default=300, ge=1, le=2000),
    max_alerts: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    context = _build_run_context(db, run_id, max_segments=max_segments, max_alerts=max_alerts)
    try:
        answer = ask_llm(context, question)
    except LLMNotConfiguredError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    return {"answer": answer}