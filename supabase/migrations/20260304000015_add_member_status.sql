-- Add status column to organization_members if it doesn't exist
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited'));

-- Update existing rows to active if null
UPDATE public.organization_members SET status = 'active' WHERE status IS NULL;
