-- Fix foreign key relationship for time_entries to allow joins with profiles
ALTER TABLE public.time_entries 
DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;

ALTER TABLE public.time_entries
ADD CONSTRAINT time_entries_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Re-grant permissions just in case
GRANT ALL ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
