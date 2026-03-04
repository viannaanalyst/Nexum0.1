# ARCHITECTURE

## Arquitetura Geral

SPA (Single Page Application) client-side com React 19.
Sem backend próprio — toda a lógica de dados passa diretamente pelo Supabase (BaaS).
Sem camada de serviços intermediária (no service layer, no repository pattern).
Sem SSR, sem API routes próprias.

```
Browser
  └── React SPA (Vite)
        ├── React Context (Auth, Company)
        ├── React Router DOM (client-side routing)
        └── Supabase JS SDK (direto nos componentes)
              └── Supabase Cloud (PostgreSQL + Auth)
```

---

## Separação de Camadas

| Camada | Responsabilidade | Onde está |
|--------|-----------------|-----------|
| UI | Renderização, estilos, interações | `src/pages/`, `src/layouts/` |
| Estado global | Auth e empresa selecionada | `src/context/` |
| Estado local | Dados de página, modais, formulários | `useState` dentro dos componentes |
| Acesso a dados | Queries Supabase diretamente nos componentes | inline em cada `page/*.tsx` |
| Configuração do client | Instância Supabase singleton | `src/lib/supabase.ts` |
| Banco de dados | PostgreSQL gerenciado pelo Supabase | Supabase Cloud |

Não existe camada de serviço ou repositório separada.
Não existe cache local além do estado React em memória.

---

## Integração com Supabase

### Inicialização

`src/lib/supabase.ts` exporta uma única instância do client:

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);
```

### Padrão de uso nos componentes

```typescript
// Leitura com filtro multi-tenant obrigatório
const { data, error } = await supabase
  .from('tabela')
  .select('*')
  .eq('company_id', selectedCompany.id);

// Escrita
const { error } = await supabase.from('tabela').insert({ ... });

// Atualização
const { error } = await supabase.from('tabela').update({ ... }).eq('id', id);

// Exclusão
const { error } = await supabase.from('tabela').delete().eq('id', id);
```

### Recursos Supabase utilizados

- **supabase.auth** — login, logout, sessão, `onAuthStateChange`
- **supabase.from()** — operações CRUD diretas (PostgREST)
- **Variáveis de ambiente** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Recursos **não identificados explicitamente** no código atual:
- Row Level Security (RLS) — não configurável pelo frontend
- Realtime subscriptions
- Storage
- Edge Functions

---

## Autenticação

### Fluxo completo

```
1. Usuário acessa qualquer rota
2. ProtectedRoute verifica isAuthenticated (AuthContext)
3. Se não autenticado → redireciona para /login
4. Login.tsx chama supabase.auth.signInWithPassword()
5. Supabase dispara onAuthStateChange com sessão ativa
6. AuthContext.fetchProfile() é chamado:
   a. Busca profiles.is_super_admin
   b. Se não for super admin, busca role em organization_members
   c. Seta User no estado global
7. CompanyContext detecta user → busca companies
   a. Tenta restaurar empresa do localStorage
   b. Se não super admin e sem empresa salva → seleciona a primeira
   c. Super admin sem empresa salva → fica sem selectedCompany
8. ProtectedRoute valida selectedCompany e role
9. Acesso liberado ao MainLayout + rotas filhas
```

### Roles e Permissões

| Role | Acesso |
|------|--------|
| `SUPER ADMIN` | `/super-admin` + todas as rotas (ao selecionar empresa) |
| `admin` | Todas as rotas protegidas |
| `editor` | Todas as rotas protegidas |
| `visualizador` | Todas as rotas protegidas |

Controle de acesso por rota via prop `allowedRoles` no `<ProtectedRoute>`.
SUPER ADMIN bypassa `allowedRoles` se tiver empresa selecionada.

### Persistência de sessão

- Sessão gerenciada pelo Supabase (cookie/localStorage interno do SDK)
- `supabase.auth.getSession()` na inicialização do AuthContext
- Empresa selecionada persistida via `localStorage.setItem('selectedCompanyId', ...)`

---

## Fluxo de Dados Principal

```
selectedCompany (CompanyContext)
      │
      ▼
useEffect([selectedCompany]) — dispara fetch ao trocar de empresa
      │
      ▼
supabase.from('tabela').select().eq('company_id', selectedCompany.id)
      │
      ▼
useState local (ex: setTransactions, setCards, setColumns)
      │
      ▼
useMemo — cálculos derivados (stats, filtros, dados para gráficos)
      │
      ▼
Renderização dos componentes
```

Mutações (insert/update/delete) → atualizam o banco → refetch local ou atualizam estado via spread.

---

## Estrutura de Rotas (React Router DOM v7)

```
BrowserRouter
  ├── /login                          → Login (público)
  ├── /trocar-senha                   → TrocarSenha (público)
  ├── /super-admin                    → SuperAdminDashboard (SuperAdminRoute)
  └── /                               → ProtectedRoute > MainLayout (Outlet)
        ├── index                     → redirect /atividades
        ├── /atividades               → Atividades
        ├── /organizador              → redirect /organizador/kanban
        │     ├── /organizador/kanban     → OrganizadorKanban
        │     ├── /organizador/lista      → OrganizadorLista
        │     ├── /organizador/atividades → OrganizadorAtividades
        │     └── /organizador/cronograma → OrganizadorCronograma
        ├── /calendario               → Calendario
        ├── /relatorios               → placeholder (Em construção)
        ├── /financeiro               → redirect /financeiro/visao-geral
        │     ├── /financeiro/visao-geral  → FinanceiroVisaoGeral
        │     ├── /financeiro/lancamentos  → FinanceiroLancamentos
        │     ├── /financeiro/comissoes    → FinanceiroComissoes
        │     └── /financeiro/cobranca     → FinanceiroCobranca
        └── /configuracao
              ├── /configuracao/empresa           → EmpresaConfig
              ├── /configuracao/regras-financeiras → RegrasFinanceiras
              ├── /configuracao/clientes           → Clientes
              ├── /configuracao/ia-automacao       → placeholder (Em construção)
              └── /configuracao/equipe             → EquipeConfig
```

Rota `*` redireciona para `/`.

### Guards de rota

- **`<ProtectedRoute>`** — verifica `isAuthenticated`, `selectedCompany` e `allowedRoles`
- **`<SuperAdminRoute>`** — verifica `isAuthenticated` + `role === 'SUPER ADMIN'`
- Ambos definidos inline em `App.tsx`, sem arquivo separado

---

## Estado Global (Context API)

### AuthContext

```typescript
// src/context/AuthContext.tsx
interface AuthContextType {
  user: User | null;         // perfil + role atual
  login: (email, password) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}
```

- `AuthProvider` bloqueia renderização dos filhos enquanto `loading === true`
- Escuta `onAuthStateChange` do Supabase para reatividade automática

### CompanyContext

```typescript
// src/context/CompanyContext.tsx
interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  addCompany: (data: Omit<Company, 'id' | 'status'>) => Promise<void>;
  selectCompany: (companyId: string) => void;
  updateCompany: (id: string, data: Partial<Company>) => Promise<void>;
  loading: boolean;
}
```

- Depende de `useAuth` (consumido internamente)
- Recarrega empresas ao mudar `user`
- Persiste `selectedCompanyId` no `localStorage`

### Hierarquia de providers

```
<BrowserRouter>
  <AuthProvider>        ← auth + user
    <CompanyProvider>   ← companies + selectedCompany (depende de AuthContext)
      <Routes>
```

---

## Integração: FullCalendar

**Localização:** `src/pages/Calendario/index.tsx`

**Plugins carregados:**
- `dayGridPlugin` — visão mensal
- `timeGridPlugin` — visão semanal/diária
- `interactionPlugin` — cliques e interações

**Configuração atual:**
```typescript
<FullCalendar
  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
  initialView="dayGridMonth"
  locale="pt-br"
  events={[]}   // ← array vazio; sem integração com dados reais ainda
  height="100%"
/>
```

**Estado atual:** Calendário renderizado sem eventos. A prop `events={[]}` indica que a integração com dados do Supabase (`kanban_cards.show_on_calendar`) não está implementada.

---

## Integração: dnd-kit

**Localização:** `src/pages/Organizador/Kanban.tsx`

**Pacotes utilizados:**
- `@dnd-kit/core` — `DndContext`, `DragOverlay`, `closestCorners`, sensores
- `@dnd-kit/sortable` — `SortableContext`, `useSortable`, `arrayMove`
- `@dnd-kit/utilities` — `CSS.Transform.toString()`

**Sensores configurados:**
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);
```

**Fluxo drag-and-drop:**
1. `onDragStart` → salva `activeId` no estado
2. `onDragEnd` → identifica card e coluna de destino
3. Bloqueia drop em `is_done_column` se card `is_blocked === true`
4. Atualiza estado local via `arrayMove`
5. Persiste `column_id` no Supabase via `update`

**`DragOverlay`:** renderiza preview visual do card durante o drag.

**Estratégia de sorting:** `verticalListSortingStrategy` para cards dentro de cada coluna.

---

## Integração: Recharts

**Localização:** `src/pages/Financeiro/VisaoGeral.tsx`

**Componentes utilizados:**
- `BarChart` + `Bar` — fluxo de caixa (receita vs despesa por mês)
- `PieChart` + `Pie` + `Cell` — custos por categoria
- `ResponsiveContainer` — responsividade automática
- `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`

**Padrão de dados:**
```typescript
// Dados preparados via useMemo antes de passar para os gráficos
const cashFlowData = useMemo(() => [...], [stats, month]);
const categoryData = useMemo(() => [...], [filteredTransactions]);
```

**Estilo:** Tooltip com background `#1f2937`, sem bordas, cor branca — integrado ao tema dark.

**Limitação identificada:** `cashFlowData` popula apenas o mês corrente; os demais meses ficam com valores zerados (placeholder declarado no código).


# 🔒 Regras Arquiteturais Imutáveis

1. É PROIBIDO:
   - Criar service layer
   - Criar repository pattern
   - Criar hooks globais genéricos para acesso a dados
   - Criar abstrações desnecessárias
   - Criar SSR ou API routes próprias

2. Queries Supabase devem continuar:
   - Diretas nos componentes
   - Sempre filtradas por company_id
   - Sem alterar padrão atual

3. Alterações estruturais exigem:
   - Justificativa técnica
   - Explicação de impacto
   - Aprovação explícita antes da implementação

4. Não refatorar estrutura existente sem solicitação direta.

5. Não mover lógica de lugar apenas para "organizar melhor".

6. Não alterar AuthContext, CompanyContext ou fluxo de autenticação sem pedido explícito.


# 📌 Contrato Estrutural de Implementação

Este projeto possui contrato estrutural fixo.

1. Cada página é responsável por:
   - Buscar seus próprios dados
   - Gerenciar seu próprio estado local
   - Executar CRUD diretamente

2. Não existe:
   - Camada de abstração para dados
   - Hooks globais de domínio (ex: useTransactions, useKanban)
   - Centralização de queries
   - Padronização via helper genérico

3. Se uma nova funcionalidade exigir:
   - Nova tabela → documentar no DATABASE_SCHEMA.md
   - Nova página → documentar em SYSTEM_CONTEXT.md
   - Nova regra estrutural → atualizar este ARCHITECTURE.md

4. A IA deve:
   - Trabalhar respeitando 100% a estrutura atual
   - Não sugerir reorganizações
   - Não propor refatorações estruturais
   - Não modificar fluxo de autenticação
   - Não alterar hierarquia de providers

5. Caso identifique problema estrutural:
   - Descrever o problema
   - Explicar impacto
   - Solicitar autorização antes de alterar