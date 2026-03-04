-- Tabela de Comentários do Kanban
CREATE TABLE IF NOT EXISTS kanban_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id), -- Quem comentou (pode ser nulo se for sistema)
  content TEXT NOT NULL,
  is_system_log BOOLEAN DEFAULT false, -- Se foi gerado automaticamente
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Anexos do Kanban
CREATE TABLE IF NOT EXISTS kanban_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  file_url TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Tags (Etiquetas)
CREATE TABLE IF NOT EXISTS kanban_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de relacionamento Card <-> Tags
CREATE TABLE IF NOT EXISTS kanban_card_tags (
  card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES kanban_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);

-- RLS
ALTER TABLE kanban_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_card_tags ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for company members)
CREATE POLICY "Members view comments" ON kanban_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_comments.card_id AND is_company_member(c.company_id))
);
CREATE POLICY "Members insert comments" ON kanban_comments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_comments.card_id AND is_company_member(c.company_id))
);

CREATE POLICY "Members view attachments" ON kanban_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_attachments.card_id AND is_company_member(c.company_id))
);
CREATE POLICY "Members insert attachments" ON kanban_attachments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_attachments.card_id AND is_company_member(c.company_id))
);

CREATE POLICY "Members view tags" ON kanban_tags FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Members manage tags" ON kanban_tags FOR ALL USING (is_company_member(company_id));

CREATE POLICY "Members view card tags" ON kanban_card_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_card_tags.card_id AND is_company_member(c.company_id))
);
CREATE POLICY "Members manage card tags" ON kanban_card_tags FOR ALL USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_card_tags.card_id AND is_company_member(c.company_id))
);
