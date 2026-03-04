-- Tabela de Colunas Kanban (Personalizáveis por Empresa/Cliente)
CREATE TABLE IF NOT EXISTS kanban_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE, -- Opcional: Se nulo, é um template geral
  title TEXT NOT NULL,
  color TEXT DEFAULT 'gray',
  position INTEGER NOT NULL,
  is_done_column BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Cards (Tarefas)
CREATE TABLE IF NOT EXISTS kanban_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  column_id UUID NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE, -- Card sempre pertence a um cliente
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  due_date TIMESTAMPTZ,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Checklist (Itens dentro da tarefa)
CREATE TABLE IF NOT EXISTS kanban_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  needs_approval BOOLEAN DEFAULT false,
  approver_id UUID REFERENCES auth.users(id), -- Quem deve aprovar
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_checklists ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Baseadas na empresa)
CREATE POLICY "Company members can view columns" ON kanban_columns FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Company admins can manage columns" ON kanban_columns FOR ALL USING (is_company_admin(company_id));

CREATE POLICY "Company members can view cards" ON kanban_cards FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Company members can manage cards" ON kanban_cards FOR ALL USING (is_company_member(company_id));

CREATE POLICY "Company members can view checklists" ON kanban_checklists FOR SELECT USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_checklists.card_id AND is_company_member(c.company_id))
);
CREATE POLICY "Company members can manage checklists" ON kanban_checklists FOR ALL USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_checklists.card_id AND is_company_member(c.company_id))
);
