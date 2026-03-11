-- ============================================================================
-- FIX CROSS-TABLE RECURSION
-- ============================================================================
-- O problema: recursao cruzada entre profiles e organization_members
-- 
-- profiles policy → SELECT em organization_members
-- organization_members policy → SELECT em profiles
-- Resultado: RECURSAO INFINITA
--
-- A solucao: organization_members deve usar a FUNCAO is_super_admin()
-- ============================================================================

-- ============================================================================
-- 1. Corrigir policy de organization_members para usar a FUNCAO
-- ============================================================================

-- Drop a policy problemática
DROP POLICY IF EXISTS "Super Admin Access" ON organization_members;

-- Recriar usando a FUNCAO is_super_admin() que é SECURITY DEFINER
CREATE POLICY "Super Admin Access" ON organization_members
  FOR ALL USING (is_super_admin());

-- ============================================================================
-- 2. Verificar se a função is_super_admin() existe e está correta
-- ============================================================================

-- Garantir que a função existe com SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
