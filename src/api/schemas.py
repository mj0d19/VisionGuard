
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

class MinimalEventSegmentOut(BaseModel):
    stable_id: int
    object_label: str
    action_label: str
    start_timestamp_s: float
    end_timestamp_s: float


class MinimalActionAlertOut(BaseModel):
    stable_id: int
    rule_name: str
    severity: str
    action_label: str
    action_score: float
    frame_idx: int
    timestamp_s: float
    message: str

class VideoRunOut(BaseModel):
    id: str
    run_name: Optional[str]
    input_path: str
    output_path: str
    started_at: datetime
    ended_at: Optional[datetime]
    fps: float
    frame_width: int
    frame_height: int
    total_frames: Optional[int]

    class Config:
        from_attributes = True


class EventSegmentOut(BaseModel):
    id: int
    run_id: str
    stable_id: int
    object_label: str
    stable_id_event: str
    action_label: str
    identity_update_ok: bool
    memory_update_ok: bool
    start_frame: int
    end_frame: int
    start_timestamp_s: float
    end_timestamp_s: float
    avg_det_conf: float
    avg_action_score: float
    avg_mask_ratio: float
    sample_count: int
    first_raw_track_id: Optional[int]
    last_raw_track_id: Optional[int]

    class Config:
        from_attributes = True


class EventSegmentContextOut(BaseModel):
    stable_id: int
    action_label: str
    start_frame: int
    end_frame: int
    start_timestamp_s: float
    end_timestamp_s: float
    duration_frames: int
    sample_count: int


class ActionAlertOut(BaseModel):
    id: int
    run_id: str
    stable_id: int
    rule_name: str
    severity: str
    action_label: str
    action_score: float
    frame_idx: int
    timestamp_s: float
    message: str
    metadata_json: Optional[str]

    class Config:
        from_attributes = True


class LLMContextResponse(BaseModel):
    run_id: str
    summary: str
    segments: List[MinimalEventSegmentOut]
    alerts: List[MinimalActionAlertOut] = Field(default_factory=list)


# --- Notification preferences ------------------------------------------------

class NotificationPreferenceOut(BaseModel):
    email_alerts_enabled: bool
    email: str

    class Config:
        from_attributes = True


class NotificationPreferenceUpdate(BaseModel):
    email_alerts_enabled: bool
