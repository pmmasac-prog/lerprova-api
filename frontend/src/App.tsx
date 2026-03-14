import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Turmas } from './pages/Turmas';
import { Relatorios } from './pages/Relatorios';

import { Gabarito } from './pages/Gabarito';
import { TurmaDetail } from './pages/TurmaDetail';
import { Debug } from './pages/Debug';
import { TabNavigation } from './components/TabNavigation';
import { Admin } from './pages/Admin';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminSidebar } from './components/AdminSidebar';
import { Planejamento } from './pages/Planejamento';
import { ImportMaster } from './pages/ImportMaster';
import { StudentPortal } from './pages/StudentPortal';
import { SchoolManagement } from './pages/SchoolManagement';
import { AcademicCalendar } from './pages/AcademicCalendar';
import { StudentCardsPage } from './pages/StudentCardsPage';
import { RelatoriosAdmin } from './pages/RelatoriosAdmin';
import { ChamadaNFC } from './pages/ChamadaNFC';
import { BillingScreen } from './screens/BillingScreen';
import { GenerateReportScreen } from './screens/GenerateReportScreen';
import { BatchSyncComponent } from './components/BatchSyncComponent';
import { ChatWidget } from './components/ChatWidget';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeSwitcher } from './components/ThemeSwitcher';

// Wrapper para extrair params da URL
const GenerateReportScreenWrapper = () => {
  const { id } = useParams<{ id: string }>();
  const turmaId = parseInt(id || '0', 10);
  // Poderia buscar o turmaNome da API se necessário
  return <GenerateReportScreen turmaId={turmaId} turmaNome={`Turma ${turmaId}`} />;
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return (
    <div className="admin-layout" style={{ display: 'flex' }}>
      <AdminSidebar />
      <main style={{ marginLeft: '260px', width: 'calc(100% - 260px)', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        {children}
      </main>
    </div>
  );
};

const HomeRedirect = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'student') return <Navigate to="/portal-aluno" replace />;
  return <Navigate to="/dashboard" replace />;
};

function App() {
  const token = localStorage.getItem('token');

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={token ? <HomeRedirect /> : <Login />} />
          <Route path="/" element={token ? <HomeRedirect /> : <Navigate to="/login" replace />} />

          {/* Professor Routes */}
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /><TabNavigation /></PrivateRoute>} />
          <Route path="/dashboard/turmas" element={<PrivateRoute><Turmas /><TabNavigation /></PrivateRoute>} />
          <Route path="/dashboard/turma/:id" element={<PrivateRoute><TurmaDetail /><TabNavigation /></PrivateRoute>} />
          <Route path="/dashboard/relatorios" element={<PrivateRoute><TabNavigation /><Relatorios /></PrivateRoute>} />
          <Route path="/dashboard/gabarito" element={<PrivateRoute><TabNavigation /><Gabarito /></PrivateRoute>} />
          <Route path="/dashboard/planejamento" element={<PrivateRoute><TabNavigation /><Planejamento /></PrivateRoute>} />
          <Route path="/dashboard/debug" element={<PrivateRoute><Debug /></PrivateRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<PrivateRoute><AdminLayout><AdminDashboard /></AdminLayout></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute><AdminLayout><Admin /></AdminLayout></PrivateRoute>} />
          <Route path="/admin/escolas" element={<PrivateRoute><AdminLayout><SchoolManagement /></AdminLayout></PrivateRoute>} />
          <Route path="/admin/calendario" element={<PrivateRoute><AdminLayout><AcademicCalendar /></AdminLayout></PrivateRoute>} />
          <Route path="/admin/turmas-master" element={<PrivateRoute><AdminLayout><ImportMaster /></AdminLayout></PrivateRoute>} />
          <Route path="/admin/carteirinhas" element={<PrivateRoute><AdminLayout><StudentCardsPage /></AdminLayout></PrivateRoute>} />
          <Route path="/admin/relatorios-frequencia" element={<PrivateRoute><AdminLayout><RelatoriosAdmin /></AdminLayout></PrivateRoute>} />
          <Route path="/admin/licencas" element={<PrivateRoute><AdminLayout><div className="admin-container"><h1 className="admin-title">Gestão de Licenças</h1><p className="admin-subtitle">Em breve: Controle de planos Premium e expirações.</p></div></AdminLayout></PrivateRoute>} />
          <Route path="/admin/config" element={<PrivateRoute><AdminLayout><div className="admin-container"><h1 className="admin-title">Configurações do Sistema</h1><p className="admin-subtitle">Em breve: Ajustes globais e logs de auditoria.</p></div></AdminLayout></PrivateRoute>} />
          <Route path="/admin/sincronizacao" element={<PrivateRoute><AdminLayout><BatchSyncComponent /></AdminLayout></PrivateRoute>} />
          <Route path="/admin/config-app" element={<PrivateRoute><AdminLayout><div><h1>Configurações do App</h1><ThemeSwitcher /></div></AdminLayout></PrivateRoute>} />
          <Route path="/admin/chamada-nfc" element={<PrivateRoute><ChamadaNFC /></PrivateRoute>} />

          {/* Nova Feature: Billing/Assinatura */}
          <Route path="/configuracoes/faturamento" element={<PrivateRoute><BillingScreen /></PrivateRoute>} />

          {/* Nova Feature: Relatórios */}
          <Route path="/turmas/:id/relatorio" element={<PrivateRoute><GenerateReportScreenWrapper /></PrivateRoute>} />

          {/* Student Portal */}
          <Route path="/portal-aluno" element={<PrivateRoute><StudentPortal /></PrivateRoute>} />

          {/* Redirecionamento legado */}
          <Route path="/dashboard/admin" element={<Navigate to="/admin" replace />} />
        </Routes>

        {/* Assistente de IA global (visível apenas para usuários logados) */}
        {token && <ChatWidget />}
        {token && <ThemeSwitcher />}
      </Router >
    </ThemeProvider>
  );
}

export default App;
