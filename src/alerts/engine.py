from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, List, Tuple

from src.alerts.models import AlertRule, GeneratedAlert


@dataclass
class _RuleRuntimeState:
    consecutive_hits: int = 0
    last_alert_frame: int = -10**9


class ActionAlertEngine:
    """Rule-based alert engine for per-track action events."""

    def __init__(self, rules: List[AlertRule]):
        self._rules = [rule for rule in rules if max(rule.min_consecutive_hits, 1) >= 1]
        self._rule_action_labels: Dict[str, set] = {}
        for rule in self._rules:
            labels = rule.normalized_action_labels()
            if labels is not None:
                self._rule_action_labels[rule.name] = labels

        self._state: Dict[Tuple[int, str], _RuleRuntimeState] = defaultdict(_RuleRuntimeState)

    @property
    def has_rules(self) -> bool:
        return bool(self._rules)

    def process_track_event(self, event: dict) -> List[GeneratedAlert]:
        stable_id = int(event.get("stable_id", -1))
        if stable_id < 0:
            return []

        action_label = str(event.get("action_label", "pending"))
        action_label_norm = action_label.strip().lower()
        if action_label_norm in {"", "pending", "unknown", "none"}:
            self._reset_stable_id(stable_id)
            return []

        action_score = float(event.get("action_score", 0.0))
        frame_idx = int(event.get("frame_idx", 0))
        timestamp_s = float(event.get("timestamp_s", 0.0))

        alerts: List[GeneratedAlert] = []
        for rule in self._rules:
            state = self._state[(stable_id, rule.name)]
            if self._matches_rule(rule, action_label_norm, action_score):
                state.consecutive_hits += 1
            else:
                state.consecutive_hits = 0
                continue

            min_hits = max(int(rule.min_consecutive_hits), 1)
            if state.consecutive_hits < min_hits:
                continue

            cooldown = max(int(rule.cooldown_frames), 0)
            if frame_idx - state.last_alert_frame < cooldown:
                continue

            state.last_alert_frame = frame_idx
            alerts.append(
                GeneratedAlert(
                    rule_name=rule.name,
                    severity=rule.severity,
                    stable_id=stable_id,
                    action_label=action_label,
                    action_score=action_score,
                    frame_idx=frame_idx,
                    timestamp_s=timestamp_s,
                    message=rule.message_template.format(
                        stable_id=stable_id,
                        action_label=action_label,
                        action_score=round(action_score, 3),
                        frame_idx=frame_idx,
                        timestamp_s=round(timestamp_s, 3),
                        rule_name=rule.name,
                    ),
                    metadata={
                        "rule_name": rule.name,
                        "object_label": event.get("object_label"),
                        "bbox_xyxy": event.get("bbox_xyxy"),
                        "stable_id_event": event.get("stable_id_event"),
                    },
                )
            )

        return alerts

    def _matches_rule(self, rule: AlertRule, action_label_norm: str, action_score: float) -> bool:
        labels = self._rule_action_labels.get(rule.name)
        if labels is not None and action_label_norm not in labels:
            return False
        return action_score >= float(rule.min_action_score)

    def _reset_stable_id(self, stable_id: int) -> None:
        keys_to_reset = [key for key in self._state.keys() if key[0] == stable_id]
        for key in keys_to_reset:
            self._state[key].consecutive_hits = 0
