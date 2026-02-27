-- Migration: Add missing roles to app_role enum and fix RLS policies
-- This fixes the issue where distributor signups were failing
-- Some roles may already exist, so we carefully add only missing ones

-- Add distributor if not already present
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.app_role ADD VALUE 'distributor';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Role distributor already exists or error occurred: %', SQLERRM;
  END;
END$$;

-- Add support_admin if not already present
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.app_role ADD VALUE 'support_admin';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Role support_admin already exists or error occurred: %', SQLERRM;
  END;
END$$;

-- Add support_staff if not already present
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.app_role ADD VALUE 'support_staff';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Role support_staff already exists or error occurred: %', SQLERRM;
  END;
END$$;

-- CRITICAL FIX: Allow users to create their own role during signup
-- This policy was missing and was blocking distributor/merchant signups
-- The roleError was being silently caught because RLS was preventing the INSERT
CREATE POLICY "Users can create their own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
