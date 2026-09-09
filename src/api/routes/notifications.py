"""
Notification preference endpoints.

GET  /me/notifications  — return the current user's notification settings
PATCH /me/notifications — toggle email_alerts_enabled on/off
"""

from __future__ import annotations

import os
import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.api.auth import get_current_user
from src.api.deps import get_db
from src.api.schemas import NotificationPreferenceOut, NotificationPreferenceUpdate
from src.database.models import NotificationPreference

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/me", tags=["notifications"])

_CLERK_API = "https://api.clerk.com/v1"


def _get_clerk_email(clerk_user_id: str) -> str:
    """Fetch the user's primary email from the Clerk Backend API."""
    secret = os.getenv("CLERK_SECRET_KEY", "")
    if not secret:
        raise HTTPException(status_code=500, detail="CLERK_SECRET_KEY not configured")

    resp = httpx.get(
        f"{_CLERK_API}/users/{clerk_user_id}",
        headers={"Authorization": f"Bearer {secret}"},
        timeout=10,
    )
    if resp.status_code != 200:
        logger.error("Clerk API error %s: %s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="Could not fetch user info from Clerk")

    data = resp.json()

    # Clerk returns email_addresses sorted by verification; pick primary or first
    for ea in data.get("email_addresses", []):
        if ea.get("id") == data.get("primary_email_address_id"):
            return ea["email_address"]

    if data.get("email_addresses"):
        return data["email_addresses"][0]["email_address"]

    raise HTTPException(status_code=404, detail="No email found for this Clerk user")


def _get_or_create_pref(
    db: Session, user: dict[str, Any]
) -> NotificationPreference:
    """Return the existing preference row or auto-create one on first access."""
    clerk_user_id = user.get("sub", "")
    pref = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.clerk_user_id == clerk_user_id)
        .first()
    )
    if pref is not None:
        return pref

    # First time — fetch email from Clerk and create a row
    email = _get_clerk_email(clerk_user_id)
    pref = NotificationPreference(
        clerk_user_id=clerk_user_id,
        email=email,
        email_alerts_enabled=True,
    )
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref


@router.get("/notifications", response_model=NotificationPreferenceOut)
def get_notification_preferences(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    pref = _get_or_create_pref(db, user)
    return pref


@router.patch("/notifications", response_model=NotificationPreferenceOut)
def update_notification_preferences(
    body: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    pref = _get_or_create_pref(db, user)
    pref.email_alerts_enabled = body.email_alerts_enabled
    db.commit()
    db.refresh(pref)
    return pref
