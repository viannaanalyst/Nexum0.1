-- Migration para criar a tabela de logs de atividades (audit_logs)
-- Copie e cole no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'comment', 'move', 'approve'
    entity_type TEXT NOT NULL, -- 'card', 'client', 'column', 'checklist'
    entity_id UUID,            -- ID do card, cliente, etc.
    details JSONB DEFAULT '{}'::jsonb, -- Detalhes flexíveis (ex: { from: 'A Fazer', to: 'Em Progresso', card_title: 'Tarefa X' })
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Usuários da mesma empresa podem ver os logs
CREATE POLICY "Users can view audit logs of their company" 
ON public.audit_logs FOR SELECT 
USING (company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Política de Inserção: Usuários autenticados podem criar logs (geralmente via backend ou triggers, mas frontend também pode se necessário)
CREATE POLICY "Users can insert audit logs for their company" 
ON public.audit_logs FOR INSERT 
WITH CHECK (company_id = (SELECT company_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs(entity_id);
