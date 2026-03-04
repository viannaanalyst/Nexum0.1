# SYSTEM_CONTEXT

## Resumo Técnico

SPA React para gestão empresarial (Nexum).  
Multi-tenant via seleção de empresa.  
Autenticação via Supabase Auth.  
Isolamento obrigatório de dados por `company_id`.  
RBAC com 4 papéis: `SUPER ADMIN`, `admin`, `editor`, `visualizador`.

---

## Escopo Atual do Produto

O sistema contém exclusivamente os seguintes módulos:

- Login / Troca de senha
- Dashboard de Produtividade (`/atividades`)
- Kanban (Organizador - Execução)
- Feed de Atividades (Organizador - Auditoria)
- Cronograma (Organizador - Planejamento)
- Calendário
- Financeiro
- Clientes
- Configurações
- Super Admin

⚠️ Não expandir escopo sem decisão explícita registrada no `DECISIONS_LOG.md`.

---

## Stack Oficial

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 19.2.0 | UI |
| TypeScript | 5.9.3 | Tipagem |
| Vite | 8.x (beta) | Build/dev |
| Tailwind CSS | 3.4.17 | Estilização |
| Supabase | 2.98.0 | Auth + banco |
| React Router DOM | 7.13.1 | Roteamento |
| FullCalendar | 6.1.20 | Calendário |
| dnd-kit | 6.x / 10.x | Drag-and-drop |
| Recharts | 3.7.0 | Gráficos |
| Lucide React | 0.576.0 | Ícones |
| react-imask | 7.6.1 | Máscaras |
| jspdf | * | Geração de PDF |
| html2canvas | * | Captura de tela para PDF |

⚠️ Não substituir bibliotecas sem justificativa técnica formal.

---

## Estrutura Oficial de Pastas


src/
├── assets/
├── context/
│ ├── AuthContext.tsx
│ ├── CompanyContext.tsx
│ └── DashboardContext.tsx
├── layouts/
│ └── MainLayout.tsx
├── lib/
│ └── supabase.ts
├── pages/
│ ├── ...
├── App.tsx
├── main.tsx
└── index.css


---

## Padrão para Novas Páginas

- Devem ser criadas dentro de `src/pages/Modulo/NomePagina.tsx`
- Devem ser registradas exclusivamente em `App.tsx`
- Devem estar protegidas por `<ProtectedRoute>`
- Devem usar `MainLayout` como layout padrão
- Não criar estrutura paralela de rotas

---

## Padrões de Código

### Componentes
- Apenas functional components
- `const Component = () => {}` + `export default`
- Subcomponentes definidos no mesmo arquivo
- Types/interfaces inline no mesmo arquivo

### Tipagem
- Uso obrigatório de TypeScript
- Union types para status/roles
- `Omit` e `Partial` para formulários e updates

---

## State Management

- Global: React Context API (`useAuth`, `useCompany`, `useDashboard`)
- Local: `useState` + `useEffect`
- Empresa persistida via `localStorage`
- Não utilizar Redux, Zustand ou outra lib externa

### Regra para Novo Context

- Só criar se o estado for realmente global
- Não duplicar dados já existentes
- Justificar antes da criação
- Registrar decisão no `DECISIONS_LOG.md`

---

## Padrão de Acesso a Dados

- Supabase utilizado diretamente nos componentes
- Não existe camada de service separada
- Não criar wrapper global sem justificativa
- Todas as queries multi-tenant devem conter:
  `.eq('company_id', selectedCompany.id)`

---

## Supabase

- Client singleton em `src/lib/supabase.ts`
- Variáveis obrigatórias:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Error handling obrigatório após queries

---

## Error Handling

- Sempre capturar `error` do Supabase
- Não silenciar erros
- Utilizar padrão:
  `setLoading(true) → try/catch/finally → setLoading(false)`

---

## Tailwind

- Estilização exclusivamente via Tailwind
- CSS permitido apenas para bibliotecas externas
- Manter custom classes:
  - `.glass-card`
  - `.gradient-text`
  - `.glow-icon`
- Não alterar paleta definida no `tailwind.config.js`

---

## Regras Arquiteturais

| Regra | Descrição |
|--------|------------|
| Rotas protegidas | Todas exceto `/login` e `/trocar-senha` |
| Multi-tenant | Todas queries filtradas por `company_id` |
| RBAC | SUPER ADMIN acessa `/super-admin` |
| Navegação | `useNavigate()` |
| Modais | Estado local no componente |
| Dados | Supabase retorna dados brutos |

---

## Tabelas Supabase Existentes

- profiles
- organization_members
- companies
- kanban_columns
- kanban_cards
- kanban_checklists
- kanban_comments
- kanban_attachments
- transactions
- clients
- audit_logs (Novo: Log de atividades e produtividade)
- monthly_schedules (Novo: Planejamento estratégico)
- schedule_posts (Novo: Posts do cronograma)

---

## Regra para Nova Tabela

- Deve conter `company_id` se multi-tenant
- Deve conter `created_at`
- Deve respeitar RBAC
- Não quebrar relacionamentos existentes
- Registrar decisão no `DECISIONS_LOG.md`

---

## O Que Não Deve Ser Alterado Sem Justificativa

- Ordem de providers em `App.tsx`
- Client Supabase singleton
- Contratos públicos dos Contexts
- Estrutura base de rotas
- Paleta de cores
- Variáveis de ambiente

---

## Governança Obrigatória

Qualquer alteração estrutural deve:

1. Ser explicada antes da implementação
2. Ter justificativa técnica
3. Ter impacto descrito
4. Ser registrada no `DECISIONS_LOG.md`

---

Este arquivo é a fonte oficial de verdade do projeto.
Sempre deve ser lido antes de qualquer modificação estrutural.
