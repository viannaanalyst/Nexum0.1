-- ============================================================================
-- FIX RECURSIVE RLS POLICIES
-- ============================================================================
-- O problema: policies que fazem SELECT na mesma tabela causam recursao
-- A solucao: usar SECURITY DEFINER functions que bypassam RLS
-- ============================================================================

-- Primeiro, garantir que a funcao is_super_admin existe e é SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 1. PROFILES - Recriar policies SEM recursao
-- ============================================================================

-- Drop todas as policies existentes
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Policy de SELECT: usuarios podem ver proprio perfil OU perfis da mesma empresa
CREATE POLICY "Users can view profiles" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.company_id = om2.company_id
      WHERE om1.user_id = auth.uid()
      AND om2.user_id = profiles.id
    )
  );

-- Policy de INSERT: usuarios so podem criar proprio perfil
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy de UPDATE: usuarios so podem atualizar proprio perfil (ou admin da empresa)
CREATE POLICY "Users can update profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.company_id = om2.company_id
      WHERE om1.user_id = auth.uid()
      AND om1.role = 'admin'
      AND om2.user_id = profiles.id
    )
  );

-- ============================================================================
-- 2. USER_NOTIFICATION_SETTINGS - Recriar policies SEM recursao
-- ============================================================================

DROP POLICY IF EXISTS "Users can view others settings to check preferences" ON user_notification_settings;
DROP POLICY IF EXISTS "Users can view notification settings in their company" ON user_notification_settings;

CREATE POLICY "Users can view notification settings" ON user_notification_settings
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.company_id = om2.company_id
      WHERE om1.user_id = auth.uid()
      AND om2.user_id = user_notification_settings.user_id
    )
  );

-- ============================================================================
-- 3. TIME_ENTRIES - Recriar policies SEM recursao
-- ============================================================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.time_entries;
DROP POLICY IF EXISTS "Users can view time entries in their company" ON public.time_entries;

CREATE POLICY "Users can view time entries" ON public.time_entries
  FOR SELECT TO authenticated USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM kanban_cards kc
      JOIN organization_members om ON om.company_id = kc.company_id
      WHERE kc.id = time_entries.card_id
      AND om.user_id = auth.uid()
    )
  );
