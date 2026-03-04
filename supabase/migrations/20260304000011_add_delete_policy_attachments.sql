-- Adicionar permissão de DELETE para anexos
CREATE POLICY "Members delete attachments" ON kanban_attachments FOR DELETE USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_attachments.card_id AND is_company_member(c.company_id))
);

-- Adicionar permissão de DELETE para comentários (opcional, mas boa prática)
CREATE POLICY "Members delete comments" ON kanban_comments FOR DELETE USING (
  EXISTS (SELECT 1 FROM kanban_cards c WHERE c.id = kanban_comments.card_id AND is_company_member(c.company_id))
);
