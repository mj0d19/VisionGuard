"""
Bridge between the pipeline alert engine and the SMTP email service.

Queries the notification_preferences table for subscribed users
and sends an email for each generated alert.
"""

from __future__ import annotations

import logging
from typing import Dict, List

from sqlalchemy.orm import Session

from src.database.models import NotificationPreference
from src.database.session import SessionLocal
from src.notifications.email_service import EmailService

logger = logging.getLogger(__name__)


class AlertNotifier:
    """Sends email notifications when the pipeline triggers an alert."""

    def __init__(self) -> None:
        self._email_service = EmailService()
        if not self._email_service.is_configured:
            logger.warning(
                "SMTP is not configured — alert emails will be skipped. "
                "Set SMTP_HOST / SMTP_USER / SMTP_PASSWORD in .env"
            )

    @property
    def is_active(self) -> bool:
        return self._email_service.is_configured

    def notify(self, alert_payload: Dict, run_id: str = "") -> None:
        """Send an alert email to all subscribed users."""
        if not self.is_active:
            return

        recipients = self._get_subscribed_emails()
        if not recipients:
            logger.debug("No subscribed users — skipping email notification")
            return

        self._email_service.send_alert_email(
            to_addresses=recipients,
            rule_name=str(alert_payload.get("rule_name", "unknown")),
            severity=str(alert_payload.get("severity", "medium")),
            message=str(alert_payload.get("message", "")),
            action_label=str(alert_payload.get("action_label", "")),
            action_score=float(alert_payload.get("action_score", 0.0)),
            timestamp_s=float(alert_payload.get("timestamp_s", 0.0)),
            run_id=run_id,
        )

    def _get_subscribed_emails(self) -> List[str]:
        """Fetch emails of all users who have email_alerts_enabled=True."""
        session: Session = SessionLocal()
        try:
            prefs = (
                session.query(NotificationPreference)
                .filter(NotificationPreference.email_alerts_enabled.is_(True))
                .all()
            )
            return [p.email for p in prefs if p.email]
        except Exception:
            logger.exception("Failed to query notification preferences")
            return []
        finally:
            session.close()
