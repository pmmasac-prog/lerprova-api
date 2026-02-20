import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldAlert, LogOut, Settings, Award } from 'lucide-react';
import '../pages/Admin.css';

export const AdminSidebar: React.FC = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <aside className="admin-sidebar">
            <div className="admin-logo" style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', background: 'var(--admin-emerald)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <ShieldAlert size={24} />
                    </div>
                    <span style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '1px' }}>ADMIN<span style={{ color: 'var(--admin-emerald)' }}>PROVA</span></span>
                </div>
            </div>

            <nav className="admin-nav" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <NavLink to="/admin" end className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <LayoutDashboard size={20} />
                    <span>Dashboard</span>
                </NavLink>
                <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Users size={20} />
                    <span>Gerir Usuários</span>
                </NavLink>
                <NavLink to="/admin/licencas" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Award size={20} />
                    <span>Licenças & Planos</span>
                </NavLink>
                <NavLink to="/admin/config" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} style={navItemStyle}>
                    <Settings size={20} />
                    <span>Configurações</span>
                </NavLink>
            </nav>

            <div className="admin-sidebar-footer" style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '20px' }}>
                <button onClick={handleLogout} className="admin-logout-btn" style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
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
    color: isActive ? '#fff' : '#64748b',
    background: isActive ? 'var(--admin-emerald)' : 'transparent',
    fontWeight: 700,
    transition: 'all 0.3s'
});
