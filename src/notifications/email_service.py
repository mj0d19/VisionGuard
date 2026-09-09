"""
SMTP email service for VisionGuard alert notifications.

Sends HTML alert emails to subscribed users via a configured SMTP server.
Uses Python's built-in smtplib — no extra dependencies required.
"""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class EmailService:
    """Thin wrapper around smtplib for sending alert emails."""

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        from_addr: Optional[str] = None,
    ):
        self._host = host or os.getenv("SMTP_HOST", "")
        self._port = port or int(os.getenv("SMTP_PORT", "587"))
        self._user = user or os.getenv("SMTP_USER", "")
        self._password = password or os.getenv("SMTP_PASSWORD", "")
        self._from = from_addr or os.getenv("SMTP_FROM", self._user)

    @property
    def is_configured(self) -> bool:
        """Return True only when all required SMTP fields are set."""
        return bool(self._host and self._user and self._password)

    def send_alert_email(
        self,
        to_addresses: List[str],
        rule_name: str,
        severity: str,
        message: str,
        action_label: str,
        action_score: float,
        timestamp_s: float,
        run_id: str = "",
    ) -> None:
        """Send an alert notification email to one or more recipients."""
        if not self.is_configured:
            logger.warning("SMTP not configured — skipping email send")
            return

        if not to_addresses:
            logger.debug("No recipients for alert email — skipping")
            return

        subject = f"[VisionGuard] {severity.upper()} Alert — {rule_name}"

        html_body = _build_alert_html(
            rule_name=rule_name,
            severity=severity,
            message=message,
            action_label=action_label,
            action_score=action_score,
            timestamp_s=timestamp_s,
            run_id=run_id,
        )

        for addr in to_addresses:
            try:
                self._send(to=addr, subject=subject, html=html_body)
                logger.info("Alert email sent to %s (rule=%s)", addr, rule_name)
            except Exception:
                logger.exception("Failed to send alert email to %s", addr)

    def _send(self, to: str, subject: str, html: str) -> None:
        """Low-level SMTP send with STARTTLS."""
        msg = MIMEMultipart("alternative")
        msg["From"] = self._from
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(self._host, self._port, timeout=15) as server:
            server.starttls()
            server.login(self._user, self._password)
            server.sendmail(self._from, to, msg.as_string())


def _build_alert_html(
    rule_name: str,
    severity: str,
    message: str,
    action_label: str,
    action_score: float,
    timestamp_s: float,
    run_id: str,
) -> str:
    """Build a styled HTML email body for an alert notification."""
    severity_colors = {
        "low": "#3b82f6",
        "medium": "#f59e0b",
        "high": "#ef4444",
        "critical": "#dc2626",
    }
    color = severity_colors.get(severity.lower(), "#6b7280")

    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:30px auto;">
    <tr>
      <td style="background:#1a1d2e;border-radius:12px;padding:32px;border:1px solid #2a2d3e;">

        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:20px;border-bottom:1px solid #2a2d3e;">
              <span style="color:#60a5fa;font-size:20px;font-weight:bold;">VisionGuard</span>
              <span style="color:#64748b;font-size:14px;margin-left:8px;">Alert Notification</span>
            </td>
          </tr>
        </table>

        <!-- Severity badge -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
          <tr>
            <td>
              <span style="background:{color};color:#fff;padding:4px 14px;border-radius:20px;
                           font-size:12px;font-weight:600;text-transform:uppercase;">
                {severity}
              </span>
            </td>
          </tr>
        </table>

        <!-- Alert message -->
        <p style="color:#e2e8f0;font-size:15px;line-height:1.6;margin-top:18px;">
          {message}
        </p>

        <!-- Details table -->
        <table width="100%" cellpadding="8" cellspacing="0"
               style="margin-top:16px;background:#12141f;border-radius:8px;">
          <tr>
            <td style="color:#94a3b8;font-size:13px;width:40%;">Rule</td>
            <td style="color:#e2e8f0;font-size:13px;">{rule_name}</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;font-size:13px;">Action</td>
            <td style="color:#e2e8f0;font-size:13px;">{action_label}</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;font-size:13px;">Score</td>
            <td style="color:#e2e8f0;font-size:13px;">{action_score:.3f}</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;font-size:13px;">Timestamp</td>
            <td style="color:#e2e8f0;font-size:13px;">{timestamp_s:.1f}s</td>
          </tr>
          {"<tr><td style='color:#94a3b8;font-size:13px;'>Run</td>"
           f"<td style='color:#e2e8f0;font-size:13px;'>{run_id}</td></tr>"
           if run_id else ""}
        </table>

        <!-- Footer -->
        <p style="color:#475569;font-size:12px;margin-top:24px;padding-top:16px;
                  border-top:1px solid #2a2d3e;">
          You're receiving this email because you have alert notifications enabled
          in your VisionGuard settings. You can disable them from the Settings page.
        </p>

      </td>
    </tr>
  </table>
</body>
</html>"""
