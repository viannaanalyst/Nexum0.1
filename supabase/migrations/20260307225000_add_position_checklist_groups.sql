-- Adicionar coluna de posição em grupos de checklist
ALTER TABLE kanban_checklist_groups ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Inicializar posições baseadas no created_at para grupos existentes
WITH ordered_groups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY created_at) * 10 as new_position
  FROM kanban_checklist_groups
)
UPDATE kanban_checklist_groups
SET position = ordered_groups.new_position
FROM ordered_groups
WHERE kanban_checklist_groups.id = ordered_groups.id;
