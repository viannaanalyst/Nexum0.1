-- Add permissions column to organization_members with CORRECT system pages
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{
  "atividades": true,
  "kanban": true,
  "lista": true,
  "historico_tarefas": true,
  "cronograma": true,
  "inteligencia_artificial": true,
  "calendario": true,
  "financeiro_geral": true,
  "financeiro_lancamentos": true,
  "financeiro_comissoes": true,
  "financeiro_cobranca": true,
  "config_empresa": true,
  "config_regras": true,
  "config_clientes": true,
  "config_ia": true,
  "config_equipe": true,
  "suporte": true
}'::jsonb;

-- Force update ALL existing members to have the correct permission schema (cleanup old data)
UPDATE organization_members SET permissions = '{
  "atividades": true,
  "kanban": true,
  "lista": true,
  "historico_tarefas": true,
  "cronograma": true,
  "inteligencia_artificial": true,
  "calendario": true,
  "financeiro_geral": true,
  "financeiro_lancamentos": true,
  "financeiro_comissoes": true,
  "financeiro_cobranca": true,
  "config_empresa": true,
  "config_regras": true,
  "config_clientes": true,
  "config_ia": true,
  "config_equipe": true,
  "suporte": true
}'::jsonb;
