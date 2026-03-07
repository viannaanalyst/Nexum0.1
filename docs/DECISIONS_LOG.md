# DECISIONS_LOG

Registro oficial de decisões técnicas implementadas.
Toda decisão estrutural futura deve ser adicionada aqui antes ou imediatamente após a implementação.

---

## DEC-001

**Data:** 2025 (data exata não identificada)
**Decisão:** Adotar Supabase como único backend (BaaS)
**Motivo:** Eliminar a necessidade de um servidor próprio. Supabase provê autenticação, banco de dados PostgreSQL e API REST prontos para uso, reduzindo o custo e a complexidade de infraestrutura.
**Impacto no sistema:** Todo o acesso a dados, autenticação e gestão de sessão dependem do Supabase. Não há backend próprio. O client é inicializado como singleton em `src/lib/supabase.ts` e usado diretamente nos componentes.

---

## DEC-002

**Data:** 2025 (data exata não identificada)
**Decisão:** Queries Supabase realizadas diretamente nos componentes de página, sem camada de serviço ou repositório
**Motivo:** Simplicidade e velocidade de desenvolvimento. O projeto não exige abstração de repositório dado o escopo atual.
**Impacto no sistema:** Cada página é responsável por buscar, manipular e persistir seus próprios dados. Não existe `service/`, `repository/` ou hooks globais de domínio. Mudança de banco ou provider exigiria alteração em cada página individualmente.

---

## DEC-003

**Data:** 2025 (data exata não identificada)
**Decisão:** Gerenciamento de estado global via React Context API (sem Redux, Zustand ou similar)
**Motivo:** O estado global do sistema se resume a dois domínios: usuário autenticado e empresa selecionada. A complexidade não justifica uma biblioteca de estado externa.
**Impacto no sistema:** Dois contextos existem: `AuthContext` e `CompanyContext`. Qualquer novo estado verdadeiramente global requer criação de um novo Context e registro no `DECISIONS_LOG.md`.

---

## DEC-004

**Data:** 2025 (data exata não identificada)
**Decisão:** Modelo multi-tenant com isolamento por `company_id` em todas as tabelas operacionais
**Motivo:** O sistema gerencia múltiplas empresas sob um único banco de dados. O isolamento por `company_id` evita vazamento de dados entre tenants sem exigir bancos separados.
**Impacto no sistema:** Toda query que retorna dados operacionais deve conter `.eq('company_id', selectedCompany.id)`. Tabelas sem `company_id` são globais por design (`profiles`, `companies`). Novas tabelas multi-tenant devem seguir este padrão obrigatoriamente.

---

## DEC-005

**Data:** 2025 (data exata não identificada)
**Decisão:** Implementar RBAC com 4 papéis: `SUPER ADMIN`, `admin`, `editor`, `visualizador`
**Motivo:** O sistema precisa distinguir usuários com acesso total ao painel (SUPER ADMIN), administradores de empresa, editores e usuários somente leitura.
**Impacto no sistema:** `SUPER ADMIN` tem rota exclusiva `/super-admin` e pode navegar entre todas as empresas. Os demais papéis acessam apenas a empresa associada. O controle é feito via `<ProtectedRoute allowedRoles={[...]}>` em `App.tsx` e via `profiles.is_super_admin` + `organization_members.role` no banco.

---

## DEC-006

**Data:** 2025 (data exata não identificada)
**Decisão:** Empresa selecionada persiste via `localStorage`
**Motivo:** Evitar que o usuário precise reselecionar a empresa a cada refresh de página, melhorando a experiência de uso.
**Impacto no sistema:** `CompanyContext` lê `localStorage.getItem('selectedCompanyId')` na inicialização e grava `localStorage.setItem('selectedCompanyId', ...)` ao selecionar. SUPER ADMIN sem empresa salva permanece no dashboard `/super-admin`. Usuários não-super-admin sem empresa salva recebem a primeira empresa disponível automaticamente.

---

## DEC-007

**Data:** 2025 (data exata não identificada)
**Decisão:** Estilização exclusivamente via Tailwind CSS; CSS externo permitido apenas para bibliotecas de terceiros
**Motivo:** Manter consistência visual e evitar conflito de estilos. Tailwind permite co-localização de estilos com o JSX.
**Impacto no sistema:** Não há CSS modules, styled-components ou emotion. Arquivos `.css` existem apenas para FullCalendar (`calendario.css`) e Clientes (`styles.css`), onde o Tailwind não cobre customizações de bibliotecas externas. A paleta customizada está em `tailwind.config.js` e as classes globais (`.glass-card`, `.gradient-text`, `.glow-icon`) em `index.css`.

---

## DEC-008

**Data:** 2025 (data exata não identificada)
**Decisão:** Adotar dnd-kit para drag-and-drop no Kanban
**Motivo:** Biblioteca moderna, acessível e modular para React. Suporta sensores de pointer e teclado, `SortableContext` e `DragOverlay` sem dependências pesadas.
**Impacto no sistema:** Usado exclusivamente em `src/pages/Organizador/Kanban.tsx`. O `DndContext` envolve todo o quadro Kanban. A lógica de reordenação usa `arrayMove` do `@dnd-kit/sortable`. A persistência de posição de coluna (`column_id`) é feita via Supabase no `onDragEnd`. Bloqueio de card (`is_blocked`) impede drag para colunas marcadas como `is_done_column`.

---

## DEC-009

**Data:** 2025 (data exata não identificada)
**Decisão:** Adotar FullCalendar para a visualização de calendário
**Motivo:** Solução completa com suporte a múltiplas views (mês, semana, dia), localização em pt-br e plugin de interação sem necessidade de implementação manual.
**Impacto no sistema:** Usado em `src/pages/Calendario/index.tsx`. A integração com dados reais (campo `show_on_calendar` de `kanban_cards`) não está implementada — `events={[]}` está como placeholder. Requer arquivo CSS customizado (`calendario.css`) para sobrescrever estilos padrão da biblioteca.

---

## DEC-010

**Data:** 2025 (data exata não identificada)
**Decisão:** Adotar Recharts para gráficos no módulo Financeiro e Dashboard
**Motivo:** Biblioteca React-native para gráficos com suporte a `ResponsiveContainer`, composição declarativa e integração simples com dados derivados de `useMemo`.
**Impacto no sistema:** Usado em `src/pages/Financeiro/VisaoGeral.tsx` e `src/pages/Atividades/index.tsx`.

---

## DEC-011

**Data:** 2025 (data exata não identificada)
**Decisão:** Subcomponentes definidos no mesmo arquivo da página principal
**Motivo:** Manter co-localização de código relacionado. Subcomponentes como `KanbanColumn`, `KanbanCard`, `KpiCard` e `NavItem` são específicos de uma única página e não precisam de arquivo separado.
**Impacto no sistema:** Arquivos de página podem ser maiores. Não existe pasta `components/` global. Subcomponentes reutilizáveis entre páginas não foram identificados no código atual — se surgir essa necessidade, uma decisão deve ser registrada aqui.

---

## DEC-012

**Data:** 2025 (data exata não identificada)
**Decisão:** Guards de rota (`ProtectedRoute`, `SuperAdminRoute`) definidos inline em `App.tsx`
**Motivo:** Simplicidade. Com apenas dois tipos de guard, não justifica arquivo separado.
**Impacto no sistema:** Toda lógica de proteção de rota está centralizada em `App.tsx`. Alterações no comportamento de autenticação ou redirecionamento afetam diretamente este arquivo.

---

## DEC-013

**Data:** 2025 (data exata não identificada)
**Decisão:** Rota raiz `/` redireciona para `/atividades` como página inicial padrão
**Motivo:** `/atividades` foi definida como a landing page principal após o login.
**Impacto no sistema:** `<Route index element={<Navigate to="/atividades" replace />} />` em `App.tsx`. Alterar a página inicial exige modificar este redirect.

---

## DEC-014

**Data:** 2025 (data exata não identificada)
**Decisão:** Utilização da tabela `audit_logs` para rastreamento de produtividade e feed de atividades
**Motivo:** Centralizar todos os eventos do sistema (criação, edição, movimentação de cards) em uma tabela única para facilitar a geração de métricas de produtividade e histórico.
**Impacto no sistema:** Kanban e Modais agora inserem registros em `audit_logs` a cada ação relevante. O dashboard usa esses dados para calcular gráficos de desempenho.

---

## DEC-015

**Data:** 2025 (data exata não identificada)
**Decisão:** Implementação de `DashboardContext` para persistência de dados do Dashboard
**Motivo:** Evitar recarregamento desnecessário e "flicker" de tela ao navegar entre abas, mantendo os dados do dashboard em cache na memória.
**Impacto no sistema:** Novo provider em `App.tsx`. Componente `Atividades` agora consome dados do contexto em vez de buscar localmente.

---

## DEC-016

**Data:** 2025 (data exata não identificada)
**Decisão:** Criação do módulo "Cronograma" separado do Kanban
**Motivo:** Separar a etapa de Planejamento Estratégico (Cronograma) da etapa de Execução (Kanban). Foco na geração de PDF e aprovação via WhatsApp/Email.
**Impacto no sistema:** Novas tabelas `monthly_schedules` e `schedule_posts`. Nova rota `/organizador/cronograma`.

---

## DEC-017

**Data:** 2025 (data exata não identificada)
**Decisão:** Adoção de `jspdf` e `html2canvas` para geração de PDF client-side
**Motivo:** Permitir a exportação do Cronograma em formato PDF multipágina diretamente pelo navegador, sem necessidade de backend de renderização.
**Impacto no sistema:** Dependências adicionadas ao projeto. Lógica de renderização oculta/temporária para captura de canvas.

---

## DEC-018

**Data:** 2026-03-05
**Decisão:** Criar submenu "Kanban" dentro de Configuração com rota `/configuracao/kanban`
**Motivo:** Centralizar a configuração do quadro Kanban em um local dedicado dentro do menu Configuração, seguindo o padrão já existente de submenus (Empresa, Equipe, Clientes etc.).
**Impacto no sistema:**
- Nova rota `/configuracao/kanban` adicionada em `App.tsx`
- Novo item "Kanban" adicionado ao submenu de Configuração em `MainLayout.tsx` (ícone `Columns` já importado)
- Nova página `src/pages/Configuracao/Kanban.tsx` com duas abas: **Colunas** e **Tarefas**
- Aba **Colunas**: editor drag-and-drop de template padrão de colunas salvo em `companies.kanban_columns` (jsonb); toggle `use_default` para novos clientes; botão para aplicar a todos os clientes existentes (sobrescreve `kanban_columns` com flag `is_default`)
- Novos campos no banco: `companies.kanban_columns` (jsonb), `kanban_columns.is_default` (bool), `kanban_columns.company_id` (uuid) — **requer migration manual no Supabase Dashboard** (arquivo `migration_sql.md`)
- O `companies.kanban_columns` foi confirmado como sem uso anterior no frontend antes desta alteração

---

## DEC-019

**Data:** 2026-03-05
**Decisão:** Criação de tabela `kanban_task_templates` para templates de tarefas pré-definidas
**Motivo:** Permitir que usuários criem modelos reutilizáveis de tarefas (com subtarefas e responsáveis pré-selecionados) para evitar criação manual repetitiva de tarefas recorrentes no Kanban.
**Impacto no sistema:**
- Nova tabela `kanban_task_templates` com campos: `id`, `company_id`, `title`, `description`, `priority`, `subtasks` (jsonb array), `assignees` (uuid[]), timestamps e soft-delete padrão
- Formato de `subtasks`: `[{ "id": "uuid", "title": "Subtarefa 1", "order": 0 }, ...]`
- Formato de `assignees`: array de `user_id` de `organization_members`
- RLS habilitado: membros ativos da empresa podem ler e gerenciar templates
- Aba **Tarefas** na página `/configuracao/kanban` implementa CRUD completo: listar, criar (modal), editar (mesmo modal) e excluir com confirmação
- Subtarefas criadas com nome incremental automático ("Subtarefa 1", "Subtarefa 2"...) e editáveis inline
- Responsáveis selecionados via lista de membros ativos da `organization_members` + `profiles`
- Requer migration manual no Supabase Dashboard (arquivo `migration_sql.md`)

---

## DEC-020

**Data:** 2026-03-07
**Decisão:** Lógica de Recorrência Mensal "Virtual" no Financeiro
**Motivo:** Automatizar a projeção de custos e receitas fixas (ex: Aluguel, Provedores) sem inflar o banco de dados com milhares de registros futuros não confirmados.
**Impacto no sistema:** Novo campo `transactions.recurrence` (monthly/none) e `recurrence_until`. O front-end projeta cards automáticos via `useMemo`. A gravação real no banco só ocorre no momento do pagamento/confirmação, marcando o novo registro com `template_id`.

---

## DEC-021

**Data:** 2026-03-07
**Decisão:** Vínculo de Lançamentos Financeiros com Clientes (Receitas e Despesas)
**Motivo:** Permitir rastreabilidade de bônus, pagamentos parciais ou despesas operacionais associadas diretamente a um cliente específico, integrando os módulos de Clientes e Financeiro.
**Impacto no sistema:** Campo `client_id` na tabela `transactions`. O modal de lançamento agora inclui um seletor de cliente que busca todos os clientes ativos da empresa.

---

*Novas decisões devem ser adicionadas ao final deste arquivo seguindo o padrão DEC-NNN.*
