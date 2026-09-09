from __future__ import annotations

import json
from pathlib import Path
from typing import List

from src.alerts.models import AlertRule


def load_alert_rules(path: str) -> List[AlertRule]:
    rule_file = Path(path)
    if not rule_file.exists():
        return []

    payload = json.loads(rule_file.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"Alert rules file must contain a JSON list: {path}")

    rules: List[AlertRule] = []
    for idx, item in enumerate(payload):
        if not isinstance(item, dict):
            raise ValueError(f"Alert rule at index {idx} must be a JSON object")

        name = str(item.get("name", "")).strip()
        if not name:
            raise ValueError(f"Alert rule at index {idx} is missing 'name'")

        action_labels = item.get("action_labels")
        if action_labels is not None:
            if not isinstance(action_labels, list):
                raise ValueError(
                    f"Alert rule '{name}' has invalid 'action_labels'. Expected list[str] or null"
                )
            action_labels = {str(v).strip() for v in action_labels if str(v).strip()}

        rules.append(
            AlertRule(
                name=name,
                severity=str(item.get("severity", "medium")),
                action_labels=action_labels,
                min_action_score=float(item.get("min_action_score", 0.6)),
                min_consecutive_hits=int(item.get("min_consecutive_hits", 3)),
                cooldown_frames=int(item.get("cooldown_frames", 60)),
                message_template=str(
                    item.get(
                        "message_template",
                        "Action '{action_label}' detected for subject {stable_id}.",
                    )
                ),
            )
        )

    return rules
