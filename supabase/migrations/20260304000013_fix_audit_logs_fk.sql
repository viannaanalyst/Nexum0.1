-- Fix audit_logs user_id foreign key to point to public.profiles instead of auth.users
-- This allows PostgREST to expand the relationship (join) in queries from the frontend.

DO $$
BEGIN
    -- Drop the existing foreign key constraint if it exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'audit_logs_user_id_fkey'
        AND table_name = 'audit_logs'
    ) THEN
        ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_user_id_fkey;
    END IF;

    -- Add the new foreign key constraint referencing public.profiles
    -- We assume public.profiles has the same IDs as auth.users
    ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Could not add foreign key: some user_ids in audit_logs do not exist in profiles.';
        -- Optional: Delete orphan logs or handle them
        -- DELETE FROM public.audit_logs WHERE user_id NOT IN (SELECT id FROM public.profiles);
        -- ALTER TABLE ... ADD CONSTRAINT ...
END $$;
