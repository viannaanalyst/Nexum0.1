-- Create time_entries table
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    is_billable BOOLEAN DEFAULT FALSE,
    is_running BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow users to view all time entries for now (simplified, similar to other tables in this project)
CREATE POLICY "Enable read access for authenticated users" ON public.time_entries
    FOR SELECT TO authenticated USING (true);

-- Allow users to insert their own entries
CREATE POLICY "Enable insert for authenticated users" ON public.time_entries
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own entries
CREATE POLICY "Enable update for users based on user_id" ON public.time_entries
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Allow users to delete their own entries
CREATE POLICY "Enable delete for users based on user_id" ON public.time_entries
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
