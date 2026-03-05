-- ════════════════════════════════════════════════════════
-- Migration: Kanban Config (Configuração → Kanban)
-- Data: 2026-03-05
-- ════════════════════════════════════════════════════════

-- 1. Template padrão de colunas armazenado na empresa
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS kanban_columns jsonb;

-- 2. Suporte a colunas "padrão" na tabela kanban_columns
ALTER TABLE kanban_columns
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_kanban_columns_company_id
  ON kanban_columns(company_id);

-- 3. Templates de tarefas pré-definidas
CREATE TABLE IF NOT EXISTS kanban_task_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  priority    text        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low','medium','high','urgent')),
  subtasks    jsonb       NOT NULL DEFAULT '[]',
  assignees   uuid[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES auth.users(id),
  updated_by  uuid        REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE kanban_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da empresa podem ver templates"
  ON kanban_task_templates FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Membros podem gerenciar templates"
  ON kanban_task_templates FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER kanban_task_templates_updated_at
  BEFORE UPDATE ON kanban_task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
