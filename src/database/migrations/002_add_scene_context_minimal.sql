-- Add scene_context column to minimal_event_segments
ALTER TABLE minimal_event_segments ADD COLUMN IF NOT EXISTS scene_context TEXT;
