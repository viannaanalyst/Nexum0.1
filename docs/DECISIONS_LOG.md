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
**Decisão:** Adotar Recharts para gráficos no módulo Financeiro
**Motivo:** Biblioteca React-native para gráficos com suporte a `ResponsiveContainer`, composição declarativa e integração simples com dados derivados de `useMemo`.
**Impacto no sistema:** Usado exclusivamente em `src/pages/Financeiro/VisaoGeral.tsx`. Implementados: `BarChart` (fluxo de caixa) e `PieChart` (custos por categoria). Dados preparados via `useMemo` antes do render. O gráfico de fluxo de caixa anual possui dados zerados para todos os meses exceto o mês corrente (limitação declarada no código como placeholder).

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

*Novas decisões devem ser adicionadas ao final deste arquivo seguindo o padrão DEC-NNN.*
