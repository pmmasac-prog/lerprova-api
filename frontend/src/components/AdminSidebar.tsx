import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldAlert, LogOut, Settings, Award, School, Calendar, Contact, FileText, Wifi } from 'lucide-react';
import '../pages/Admin.css';

export const AdminSidebar: React.FC = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <aside className="admin-sidebar shadow-xl">
            <div className="admin-logo" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', background: 'var(--admin-emerald)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 6px -1px var(--admin-emerald-alpha)' }}>
                        <ShieldAlert size={24} />
                    </div>
                    <span style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '1px' }}>ADMIN<span style={{ color: 'var(--admin-emerald)' }}>PROVA</span></span>
                </div>
            </div>

            <nav className="admin-nav" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <NavLink to="/admin" end className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                </NavLink>
                <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Users size={18} />
                    <span>Gerir Usuários</span>
                </NavLink>
                
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', margin: '15px 0 5px 12px', letterSpacing: '1px' }}>Estrutura escolar</div>
                
                <NavLink to="/admin/escolas" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <School size={18} />
                    <span>Gestão Escolas</span>
                </NavLink>
                <NavLink to="/admin/calendario" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Calendar size={18} />
                    <span>Calendário 2026</span>
                </NavLink>
                <NavLink to="/admin/turmas-master" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Users size={18} />
                    <span>Base Central (Salas)</span>
                </NavLink>
                <NavLink to="/admin/carteirinhas" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Contact size={18} />
                    <span>Carteirinhas</span>
                </NavLink>
                <NavLink to="/admin/relatorios-frequencia" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <FileText size={18} />
                    <span>Relatórios Frequência</span>
                </NavLink>
                <NavLink to="/admin/chamada-nfc" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Wifi size={18} />
                    <span>Chamada NFC</span>
                </NavLink>

                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', margin: '15px 0 5px 12px', letterSpacing: '1px' }}>Sistema</div>

                <NavLink to="/admin/licencas" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Award size={18} />
                    <span>Licenças & Planos</span>
                </NavLink>
                <NavLink to="/admin/config" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Settings size={18} />
                    <span>Configurações</span>
                </NavLink>
            </nav>

            <div className="admin-sidebar-footer" style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '20px' }}>
                <button onClick={handleLogout} className="admin-logout-btn" style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--color-danger)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontWeight: 700
                }}>
                    <LogOut size={20} />
                    <span>Encerrar Sessão</span>
                </button>
            </div>
        </aside>
    );
};

const navItemStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '12px',
    textDecoration: 'none',
    color: isActive ? '#fff' : 'var(--color-text-muted)',
    background: isActive ? 'var(--admin-emerald)' : 'transparent',
    fontWeight: 700,
    transition: 'all 0.3s'
});
