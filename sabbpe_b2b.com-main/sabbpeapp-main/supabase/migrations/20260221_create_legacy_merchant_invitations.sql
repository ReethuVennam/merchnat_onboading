-- Migration: Create legacy merchant_invitations table for backward compatibility

CREATE TABLE IF NOT EXISTS merchant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_name VARCHAR(255) NOT NULL,
  merchant_mobile VARCHAR(20) NOT NULL,
  invitation_token UUID NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending -> accepted -> expired
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  sent_via VARCHAR(50)
);

-- Indexes for faster queries
CREATE INDEX idx_merchant_invitations_distributor_id ON merchant_invitations(distributor_id);
CREATE INDEX idx_merchant_invitations_invitation_token ON merchant_invitations(invitation_token);
CREATE INDEX idx_merchant_invitations_status ON merchant_invitations(status);

-- RLS Policies
ALTER TABLE merchant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Distributors can view own invitations"
  ON merchant_invitations FOR SELECT
  TO authenticated
  USING (auth.uid() = distributor_id);

CREATE POLICY "Distributors can insert invitations"
  ON merchant_invitations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = distributor_id);

CREATE POLICY "Distributors can update own invitations"
  ON merchant_invitations FOR UPDATE
  TO authenticated
  USING (auth.uid() = distributor_id);

-- Anyone can query by token (invitation links)
CREATE POLICY "Anyone can query by invitation token"
  ON merchant_invitations FOR SELECT
  USING (true);
