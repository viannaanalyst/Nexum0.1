-- Add end_date column to clients table
ALTER TABLE public.clients
ADD COLUMN end_date DATE;

-- Comment for clarity
COMMENT ON COLUMN public.clients.end_date IS 'Date when the client contract was terminated';
