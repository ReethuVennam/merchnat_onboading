-- 2026-02-25: add transactions table so distributors can view all merchant transactions

CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchant_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  external_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- enable row level security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- permit merchants and their distributors to read transactions for related merchants
CREATE POLICY "Related merchant or distributor can view transaction"
  ON public.transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_profiles
      WHERE id = transactions.merchant_id
        AND (user_id = auth.uid() OR distributor_id = auth.uid())
    )
  );

-- The table is write‑only from server; no public insert/update policies provided here
