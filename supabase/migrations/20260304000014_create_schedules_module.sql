-- Create monthly_schedules table
CREATE TABLE IF NOT EXISTS public.monthly_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved')), -- Internal control
    
    -- Strategy fields (Espinha dorsal)
    strategy_focus text,
    strategy_dates text,
    strategy_offer text,
    strategy_creative text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create schedule_posts table
CREATE TABLE IF NOT EXISTS public.schedule_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id uuid REFERENCES public.monthly_schedules(id) ON DELETE CASCADE NOT NULL,
    
    week_number integer NOT NULL, -- 1, 2, 3, 4, 5
    position integer NOT NULL DEFAULT 0, -- Order within the week
    
    -- Post Details
    format text, -- 'reels', 'static', 'carousel', 'story'
    theme text,
    objective text,
    hook text,
    pain_desire text,
    caption_idea text, -- Optional: Idea for caption
    
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_posts ENABLE ROW LEVEL SECURITY;

-- Policies for monthly_schedules
CREATE POLICY "Users can view schedules of their company" 
ON public.monthly_schedules FOR SELECT 
USING (company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert schedules for their company" 
ON public.monthly_schedules FOR INSERT 
WITH CHECK (company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update schedules of their company" 
ON public.monthly_schedules FOR UPDATE 
USING (company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete schedules of their company" 
ON public.monthly_schedules FOR DELETE 
USING (company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Policies for schedule_posts
-- Using a subquery to check company_id via the parent schedule
CREATE POLICY "Users can view posts of their company schedules" 
ON public.schedule_posts FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.monthly_schedules s
        WHERE s.id = schedule_posts.schedule_id
        AND s.company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid())
    )
);

CREATE POLICY "Users can insert posts for their company schedules" 
ON public.schedule_posts FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.monthly_schedules s
        WHERE s.id = schedule_posts.schedule_id
        AND s.company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid())
    )
);

CREATE POLICY "Users can update posts of their company schedules" 
ON public.schedule_posts FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.monthly_schedules s
        WHERE s.id = schedule_posts.schedule_id
        AND s.company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid())
    )
);

CREATE POLICY "Users can delete posts of their company schedules" 
ON public.schedule_posts FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.monthly_schedules s
        WHERE s.id = schedule_posts.schedule_id
        AND s.company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid())
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_monthly_schedules_company_id ON public.monthly_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_monthly_schedules_client_id ON public.monthly_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_schedule_posts_schedule_id ON public.schedule_posts(schedule_id);
