-- Create checklist groups table
CREATE TABLE IF NOT EXISTS kanban_checklist_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Checklist',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE kanban_checklist_groups ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Company members can view checklist groups" ON kanban_checklist_groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_checklist_groups.card_id AND is_company_member(c.company_id))
);
CREATE POLICY "Company members can manage checklist groups" ON kanban_checklist_groups FOR ALL USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_checklist_groups.card_id AND is_company_member(c.company_id))
);

-- Adicionar FK na tabela existente de checklists
ALTER TABLE kanban_checklists ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES kanban_checklist_groups(id) ON DELETE CASCADE;


