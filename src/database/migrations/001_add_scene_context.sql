-- Add scene_context column to event_segments
ALTER TABLE event_segments ADD COLUMN IF NOT EXISTS scene_context TEXT;
