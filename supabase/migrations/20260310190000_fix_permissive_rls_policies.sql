-- ============================================================================
-- FIX PERMISSIVE RLS POLICIES
-- ============================================================================
-- Este arquivo corrige políticas RLS muito permissivas que permitiam
-- que usuarios de uma empresa visualizassem dados de outras empresas.
-- ============================================================================

-- ============================================================================
-- 1. PROFILES - Corrigir politica de leitura publica
-- ============================================================================
-- Antes: USING (true) - qualquer usuario podia ver todos os perfis
-- Depois: Apenas usuarios da mesma empresa podem ver perfis

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

CREATE POLICY "Users can view profiles in their company" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR (
      SELECT is_super_admin FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.company_id = om2.company_id
      WHERE om1.user_id = auth.uid()
      AND om2.user_id = profiles.id
    )
  );

-- ============================================================================
-- 2. USER_NOTIFICATION_SETTINGS - Corrigir politica de leitura publica
-- ============================================================================
-- Antes: USING (true) - qualquer usuario podia ver preferencias de todos
-- Depois: Apenas usuarios da mesma empresa podem ver preferencias

DROP POLICY IF EXISTS "Users can view others settings to check preferences" ON user_notification_settings;

CREATE POLICY "Users can view notification settings in their company" ON user_notification_settings
  FOR SELECT USING (
    auth.uid() = user_id
    OR (
      SELECT is_super_admin FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.company_id = om2.company_id
      WHERE om1.user_id = auth.uid()
      AND om2.user_id = user_notification_settings.user_id
    )
  );

-- ============================================================================
-- 3. TIME_ENTRIES - Corrigir politica de leitura global
-- ============================================================================
-- Antes: USING (true) - qualquer usuario podia ver todas as entradas de tempo
-- Depois: Apenas usuarios da mesma empresa podem ver entradas

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.time_entries;

CREATE POLICY "Users can view time entries in their company" ON public.time_entries
  FOR SELECT TO authenticated USING (
    (
      SELECT is_super_admin FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM kanban_cards kc
      JOIN organization_members om ON om.company_id = kc.company_id
      WHERE kc.id = time_entries.card_id
      AND om.user_id = auth.uid()
    )
  );
