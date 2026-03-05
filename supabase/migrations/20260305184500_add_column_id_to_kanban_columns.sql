-- Add column_id to kanban_columns to facilitate template syncing
ALTER TABLE kanban_columns
  ADD COLUMN IF NOT EXISTS column_id uuid;

-- Index for performance when grouping/filtering by template origin
CREATE INDEX IF NOT EXISTS idx_kanban_columns_column_id
  ON kanban_columns(column_id);
