import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
    func,
)
from sqlalchemy.orm import relationship

from src.database.session import Base


class VideoRun(Base):
    __tablename__ = "video_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_name = Column(String(255), nullable=True)
    input_path = Column(Text, nullable=False)
    output_path = Column(Text, nullable=False)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    fps = Column(Float, nullable=False)
    frame_width = Column(Integer, nullable=False)
    frame_height = Column(Integer, nullable=False)
    total_frames = Column(Integer, nullable=True)

    segments = relationship("EventSegment", back_populates="run", cascade="all, delete-orphan")
    alerts = relationship("ActionAlert", back_populates="run", cascade="all, delete-orphan")


class EventSegment(Base):
    __tablename__ = "event_segments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("video_runs.id", ondelete="CASCADE"), nullable=False)
    stable_id = Column(Integer, nullable=False)
    object_label = Column(String(100), nullable=False)
    stable_id_event = Column(String(50), nullable=False)
    action_label = Column(String(200), nullable=False)
    identity_update_ok = Column(Boolean, nullable=False, default=False)
    memory_update_ok = Column(Boolean, nullable=False, default=False)

    start_frame = Column(Integer, nullable=False)
    end_frame = Column(Integer, nullable=False)
    start_timestamp_s = Column(Float, nullable=False)
    end_timestamp_s = Column(Float, nullable=False)

    avg_det_conf = Column(Float, nullable=False)
    avg_action_score = Column(Float, nullable=False)
    avg_mask_ratio = Column(Float, nullable=False)
    sample_count = Column(Integer, nullable=False, default=1)

    first_raw_track_id = Column(Integer, nullable=True)
    last_raw_track_id = Column(Integer, nullable=True)
    # Comma-separated top-K scene context classes for this segment (e.g. "building,sidewalk,tree")
    scene_context = Column(Text, nullable=True)

    run = relationship("VideoRun", back_populates="segments")


class ActionAlert(Base):
    __tablename__ = "action_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("video_runs.id", ondelete="CASCADE"), nullable=False)
    stable_id = Column(Integer, nullable=False)
    rule_name = Column(String(120), nullable=False)
    severity = Column(String(32), nullable=False)
    action_label = Column(String(200), nullable=False)
    action_score = Column(Float, nullable=False)
    frame_idx = Column(Integer, nullable=False)
    timestamp_s = Column(Float, nullable=False)
    message = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)

    run = relationship("VideoRun", back_populates="alerts")


Index("ix_event_segments_run_stable_start", EventSegment.run_id, EventSegment.stable_id, EventSegment.start_frame)
Index("ix_event_segments_run_start", EventSegment.run_id, EventSegment.start_frame)
Index("ix_action_alerts_run_frame", ActionAlert.run_id, ActionAlert.frame_idx)
Index("ix_action_alerts_run_stable", ActionAlert.run_id, ActionAlert.stable_id)


class NotificationPreference(Base):
    """Per-user email notification settings; keyed by Clerk user ID."""
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(320), nullable=False)
    email_alerts_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


# Minimal event segment table for performance use cases
class MinimalEventSegment(Base):
    __tablename__ = "minimal_event_segments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stable_id = Column(Integer, nullable=False)
    object_label = Column(String(100), nullable=False)
    action_label = Column(String(200), nullable=False)
    start_timestamp_s = Column(Float, nullable=False)
    end_timestamp_s = Column(Float, nullable=False)
    # Comma-separated top-K scene context classes for this minimal segment
    scene_context = Column(Text, nullable=True)
