-- Add distributor_id field to merchant_profiles to allow distributors to create merchants
ALTER TABLE public.merchant_profiles 
ADD COLUMN distributor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Make user_id nullable for merchants created by distributors
ALTER TABLE public.merchant_profiles
ALTER COLUMN user_id DROP NOT NULL;

-- Drop the old unique constraint
ALTER TABLE public.merchant_profiles
DROP CONSTRAINT merchant_profiles_user_id_key;

-- Add unique constraint only for non-null user_id values
CREATE UNIQUE INDEX merchant_profiles_user_id_key ON public.merchant_profiles (user_id) WHERE user_id IS NOT NULL;

-- Add RLS policy for distributors to create merchants
CREATE POLICY "Distributors can create merchants" 
ON public.merchant_profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role = 'distributor' AND user_id = auth.uid()
  )
);

-- Add RLS policy for distributors to view their merchants
CREATE POLICY "Distributors can view their merchants" 
ON public.merchant_profiles 
FOR SELECT 
USING (
  distributor_id = auth.uid()
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'support_admin')
  )
);

-- Add RLS policy for distributors to update their merchants
CREATE POLICY "Distributors can update their merchants" 
ON public.merchant_profiles 
FOR UPDATE 
USING (
  distributor_id = auth.uid()
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'support_admin')
  )
);
