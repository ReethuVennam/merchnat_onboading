-- Migration: set default for sent_via to 'whatsapp'

ALTER TABLE merchant_invitations
  ALTER COLUMN sent_via SET DEFAULT 'whatsapp';
