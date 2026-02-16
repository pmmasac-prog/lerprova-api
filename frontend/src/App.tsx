import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Turmas } from './pages/Turmas';
import { Relatorios } from './pages/Relatorios';
import { Assinatura } from './pages/Assinatura';
import { Gabarito } from './pages/Gabarito';
import { TurmaDetail } from './pages/TurmaDetail';
import { TabNavigation } from './components/TabNavigation';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<><Dashboard /><TabNavigation /></>} />
        <Route path="/dashboard/turmas" element={<><Turmas /><TabNavigation /></>} />
        <Route path="/dashboard/turma/:id" element={<><TurmaDetail /><TabNavigation /></>} />
        <Route path="/dashboard/relatorios" element={
          <>
            <TabNavigation />
            <Relatorios />
          </>
        } />
        <Route path="/dashboard/gabarito" element={
          <>
            <TabNavigation />
            <Gabarito />
          </>
        } />
        <Route path="/dashboard/assinatura" element={
          <>
            <TabNavigation />
            <Assinatura />
          </>
        } />
      </Routes>
    </Router >
  );
}

export default App;
