import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
      <main style={{ marginLeft: '260px', width: 'calc(100% - 260px)', minHeight: '100vh', background: '#0b0e14' }}>
        {children}
      </main>
    </div>
  );
};

const HomeRedirect = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
};

function App() {
  const token = localStorage.getItem('token');

  return (
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
        <Route path="/admin/licencas" element={<PrivateRoute><AdminLayout><div className="admin-container"><h1 className="admin-title">Gestão de Licenças</h1><p className="admin-subtitle">Em breve: Controle de planos Premium e expirações.</p></div></AdminLayout></PrivateRoute>} />

        {/* Redirecionamento legado */}
        <Route path="/dashboard/admin" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router >
  );
}

export default App;
