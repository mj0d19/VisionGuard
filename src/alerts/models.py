from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Set


@dataclass(frozen=True)
class AlertRule:
    name: str
    severity: str = "medium"
    action_labels: Optional[Set[str]] = None
    min_action_score: float = 0.6
    min_consecutive_hits: int = 3
    cooldown_frames: int = 60
    message_template: str = "Action '{action_label}' detected for subject {stable_id}."

    def normalized_action_labels(self) -> Optional[Set[str]]:
        if self.action_labels is None:
            return None
        return {label.strip().lower() for label in self.action_labels if label and label.strip()}


@dataclass
class GeneratedAlert:
    rule_name: str
    severity: str
    stable_id: int
    action_label: str
    action_score: float
    frame_idx: int
    timestamp_s: float
    message: str
    metadata: dict = field(default_factory=dict)
