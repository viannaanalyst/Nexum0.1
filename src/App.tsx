import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import { DashboardProvider } from './context/DashboardContext';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import EmpresaConfig from './pages/Configuracao/Empresa';
import EquipeConfig from './pages/Configuracao/Equipe';
import RegrasFinanceiras from './pages/Configuracao/RegrasFinanceiras';
import Clientes from './pages/Configuracao/Clientes';
import KanbanConfig from './pages/Configuracao/Kanban';
import Atividades from './pages/Atividades';
import SuperAdminDashboard from './pages/SuperAdmin/Dashboard';
import TrocarSenha from './pages/TrocarSenha';
import Calendario from './pages/Calendario';
import FinanceiroVisaoGeral from './pages/Financeiro/VisaoGeral';
import FinanceiroLancamentos from './pages/Financeiro/Lancamentos';
import FinanceiroComissoes from './pages/Financeiro/Comissoes';
import FinanceiroCobranca from './pages/Financeiro/Cobranca';
import OrganizadorKanban from './pages/Organizador/Kanban';
import OrganizadorLista from './pages/Organizador/Lista';
import OrganizadorAtividades from './pages/Organizador/Atividades';
import OrganizadorCronograma from './pages/Organizador/Cronograma';

// Component to protect routes based on authentication and roles
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, isAuthenticated } = useAuth();
  const { selectedCompany, companies, selectCompany, loading } = useCompany();

  if (loading) {
    // return <div className="h-screen bg-[#0a0a1a] flex items-center justify-center text-white">Carregando...</div>;
    // Return null or a skeleton to prevent "flashing" a loading screen on small updates, 
    // or just render children if we trust the previous state.
    // But for initial load we need to block.
    // Let's just return nothing to avoid the flash if it's very fast, or keep the spinner if it's slow?
    // The "flash" is the spinner appearing and disappearing.
    // If we are already authenticated, we might want to show the app structure skeleton.
    return <div className="h-screen bg-[#0a0a1a]"></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'SUPER ADMIN') {
    if (!selectedCompany) {
      return <Navigate to="/super-admin" replace />;
    }
  }

  // If user is NOT allowed for this specific route
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Se for Super Admin, ele tem acesso a tudo, então essa checagem de allowedRoles 
    // deve considerar que Super Admin pode passar se 'SUPER ADMIN' não estiver na lista mas ele está "impersonando"
    // Mas a lógica atual é: se o papel do usuário não estiver na lista, bloqueia.
    // Vamos permitir Super Admin sempre se ele tiver selecionado uma empresa
    if (user.role !== 'SUPER ADMIN') {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'SUPER ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  console.log('App rendering');
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <DashboardProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/trocar-senha" element={<TrocarSenha />} />

              <Route path="/super-admin" element={
                <SuperAdminRoute>
                  <SuperAdminDashboard />
                </SuperAdminRoute>
              } />

              <Route path="/" element={
                <ProtectedRoute allowedRoles={['admin', 'editor', 'visualizador', 'SUPER ADMIN']}>
                  <MainLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/atividades" replace />} />
                <Route path="atividades" element={<Atividades />} />

                {/* Configuração Sub-routes */}
                <Route path="configuracao/empresa" element={<EmpresaConfig />} />
                <Route path="configuracao/regras-financeiras" element={<RegrasFinanceiras />} />
                <Route path="configuracao/clientes" element={<Clientes />} />
                <Route path="configuracao/ia-automacao" element={<div className="text-white p-8">IA e Automação (Em construção)</div>} />
                <Route path="configuracao/equipe" element={<EquipeConfig />} />
                <Route path="configuracao/kanban" element={<KanbanConfig />} />

                {/* Organizador Sub-routes */}
                <Route path="organizador" element={<Navigate to="/organizador/kanban" replace />} />
                <Route path="organizador/kanban" element={<OrganizadorKanban />} />
                <Route path="organizador/lista" element={<OrganizadorLista />} />
                <Route path="organizador/historico" element={<OrganizadorAtividades />} />
                <Route path="organizador/cronograma" element={<OrganizadorCronograma />} />

                {/* Other Sidebar Routes */}
                <Route path="relatorios" element={<div className="text-white p-8">Relatórios IA e Agente (Em construção)</div>} />
                <Route path="calendario" element={<Calendario />} />

                {/* Financeiro Sub-routes */}
                <Route path="financeiro" element={<Navigate to="/financeiro/visao-geral" replace />} />
                <Route path="financeiro/visao-geral" element={<FinanceiroVisaoGeral />} />
                <Route path="financeiro/lancamentos" element={<FinanceiroLancamentos />} />
                <Route path="financeiro/comissoes" element={<FinanceiroComissoes />} />
                <Route path="financeiro/cobranca" element={<FinanceiroCobranca />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DashboardProvider>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
