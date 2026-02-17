import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Turmas } from './pages/Turmas';
import { Relatorios } from './pages/Relatorios';
import { Assinatura } from './pages/Assinatura';
import { Gabarito } from './pages/Gabarito';
import { TurmaDetail } from './pages/TurmaDetail';
import { Debug } from './pages/Debug';
import { TabNavigation } from './components/TabNavigation';
import { Admin } from './pages/Admin';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  const token = localStorage.getItem('token');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<PrivateRoute><Dashboard /><TabNavigation /></PrivateRoute>} />
        <Route path="/dashboard/turmas" element={<PrivateRoute><Turmas /><TabNavigation /></PrivateRoute>} />
        <Route path="/dashboard/turma/:id" element={<PrivateRoute><TurmaDetail /><TabNavigation /></PrivateRoute>} />
        <Route path="/dashboard/relatorios" element={
          <PrivateRoute>
            <TabNavigation />
            <Relatorios />
          </PrivateRoute>
        } />
        <Route path="/dashboard/gabarito" element={
          <PrivateRoute>
            <TabNavigation />
            <Gabarito />
          </PrivateRoute>
        } />
        <Route path="/dashboard/assinatura" element={
          <PrivateRoute>
            <TabNavigation />
            <Assinatura />
          </PrivateRoute>
        } />
        <Route path="/dashboard/debug" element={<PrivateRoute><Debug /></PrivateRoute>} />
        <Route path="/dashboard/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
      </Routes>
    </Router >
  );
}

export default App;
