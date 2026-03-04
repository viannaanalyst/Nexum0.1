
-- 1. Create client_credentials table
CREATE TABLE client_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  login text NOT NULL,
  encrypted_password text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_credentials ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Super Admin access credentials" ON client_credentials FOR ALL USING (is_super_admin());
CREATE POLICY "Members view credentials" ON client_credentials FOR SELECT USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = client_credentials.client_id AND is_company_member(c.company_id))
);
CREATE POLICY "Admins manage credentials" ON client_credentials FOR ALL USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = client_credentials.client_id AND is_company_admin(c.company_id))
);

-- 2. Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3. Automatic Status Change Log Trigger
CREATE OR REPLACE FUNCTION log_client_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO client_logs (client_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_client_status_change ON clients;
CREATE TRIGGER on_client_status_change
  AFTER UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION log_client_status_change();

-- 4. Secure Credential Functions (RPC)

-- A. Add Credential (Encrypts password)
-- We use a fixed key 'nexum-secret-key' for simplicity in this MVP. 
-- In production, this should be a Vault secret or env var.
CREATE OR REPLACE FUNCTION add_client_credential(
  p_client_id uuid,
  p_service_name text,
  p_login text,
  p_password text,
  p_notes text
)
RETURNS void AS $$
BEGIN
  -- Check permission (must be company admin or super admin)
  IF NOT (
    is_super_admin() OR 
    EXISTS (SELECT 1 FROM clients c WHERE c.id = p_client_id AND is_company_admin(c.company_id))
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO client_credentials (client_id, service_name, login, encrypted_password, notes)
  VALUES (
    p_client_id, 
    p_service_name, 
    p_login, 
    pgp_sym_encrypt(p_password, 'nexum-secret-key'), 
    p_notes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Get Credentials (Decrypts password)
CREATE OR REPLACE FUNCTION get_client_credentials(p_client_id uuid)
RETURNS TABLE (
  id uuid,
  service_name text,
  login text,
  password text,
  notes text,
  created_at timestamptz
) AS $$
BEGIN
  -- Check permission (must be member)
  IF NOT (
    is_super_admin() OR 
    EXISTS (SELECT 1 FROM clients c WHERE c.id = p_client_id AND is_company_member(c.company_id))
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    cc.id,
    cc.service_name,
    cc.login,
    pgp_sym_decrypt(cc.encrypted_password::bytea, 'nexum-secret-key') as password,
    cc.notes,
    cc.created_at
  FROM client_credentials cc
  WHERE cc.client_id = p_client_id
  ORDER BY cc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Delete Credential
CREATE OR REPLACE FUNCTION delete_client_credential(p_credential_id uuid)
RETURNS void AS $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT client_id INTO v_client_id FROM client_credentials WHERE id = p_credential_id;
  
  -- Check permission
  IF NOT (
    is_super_admin() OR 
    EXISTS (SELECT 1 FROM clients c WHERE c.id = v_client_id AND is_company_admin(c.company_id))
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  DELETE FROM client_credentials WHERE id = p_credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
