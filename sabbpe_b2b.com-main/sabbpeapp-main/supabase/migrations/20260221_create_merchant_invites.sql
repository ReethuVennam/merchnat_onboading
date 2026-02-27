-- Migration: Create merchant_invites table for bulk onboarding invites

CREATE TABLE IF NOT EXISTS merchant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_email VARCHAR(255) NOT NULL,
  merchant_name VARCHAR(255) NOT NULL,
  merchant_mobile VARCHAR(20) NOT NULL,
  business_name VARCHAR(255),
  invite_token UUID NOT NULL UNIQUE,
  invite_link TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending -> sent -> accepted/clicked -> registered
  -- or -> failed_to_send
  whatsapp_message_id VARCHAR(255),
  send_error TEXT,
  accepted_at TIMESTAMP,
  clicked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_merchant_invites_distributor_id ON merchant_invites(distributor_id);
CREATE INDEX idx_merchant_invites_invite_token ON merchant_invites(invite_token);
CREATE INDEX idx_merchant_invites_status ON merchant_invites(status);
CREATE INDEX idx_merchant_invites_merchant_email ON merchant_invites(merchant_email);
CREATE INDEX idx_merchant_invites_created_at ON merchant_invites(created_at DESC);

-- RLS Policies
ALTER TABLE merchant_invites ENABLE ROW LEVEL SECURITY;

-- Distributors can view/manage their own invites
CREATE POLICY "Distributors can view own invites"
  ON merchant_invites FOR SELECT
  TO authenticated
  USING (auth.uid() = distributor_id);

CREATE POLICY "Distributors can insert invites"
  ON merchant_invites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = distributor_id);

CREATE POLICY "Distributors can update own invites"
  ON merchant_invites FOR UPDATE
  TO authenticated
  USING (auth.uid() = distributor_id);

-- Anyone can query by invite_token (to prefill onboarding form)
CREATE POLICY "Anyone can query by invite token"
  ON merchant_invites FOR SELECT
  USING (true); -- Invite tokens are already unique secret links

-- Enable realtime for invite status updates
ALTER PUBLICATION supabase_realtime ADD TABLE merchant_invites;
