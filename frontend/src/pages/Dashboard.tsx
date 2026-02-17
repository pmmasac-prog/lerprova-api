import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, BookOpen, ClipboardList, TrendingUp, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Dashboard.css';

interface DashboardStats {
    total_turmas: number;
    total_alunos: number;
    total_gabaritos: number;
    total_resultados: number;
}

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats>({
        total_turmas: 0,
        total_alunos: 0,
        total_gabaritos: 0,
        total_resultados: 0
    });
    const [recentResults, setRecentResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadStats();
    }, []);

    const handleLogout = () => {
        if (confirm('Deseja realmente sair?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    };

    const loadStats = async () => {
        try {
            setLoading(true);
            const [statsData, resultsData] = await Promise.all([
                api.getStats(),
                api.getResultados()
            ]);
            setStats(statsData);
            // Pegar os 5 últimos resultados
            const sortedResults = [...resultsData].sort((a, b) => b.id - a.id).slice(0, 5);
            setRecentResults(sortedResults);
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        } finally {
            setLoading(false);
        }
    };

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Olá, {user.nome?.split(' ')[0] || 'Professor(a)'}</h1>
                    <p className="dashboard-subtitle">Bem-vindo(a) ao LerProva</p>
                </div>
                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <button
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                            onClick={() => navigate('/dashboard/debug')}
                            title="Diagnóstico"
                        >
                            <Settings size={22} />
                        </button>
                    )}
                    <button
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        onClick={handleLogout}
                        title="Sair"
                    >
                        <LogOut size={22} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#64748b' }}>
                    <p>Carregando estatísticas...</p>
                </div>
            ) : (
                <>
                    {/* Quick Stats Cards */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon-bg icon-blue">
                                <BookOpen size={24} />
                            </div>
                            <div className="stat-info">
                                <h3>Turmas</h3>
                                <p>{stats.total_turmas}</p>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon-bg icon-purple">
                                <Users size={24} />
                            </div>
                            <div className="stat-info">
                                <h3>Alunos</h3>
                                <p>{stats.total_alunos}</p>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon-bg icon-green">
                                <ClipboardList size={24} />
                            </div>
                            <div className="stat-info">
                                <h3>Gabaritos</h3>
                                <p>{stats.total_gabaritos}</p>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon-bg icon-orange">
                                <TrendingUp size={24} />
                            </div>
                            <div className="stat-info">
                                <h3>Correções</h3>
                                <p>{stats.total_resultados}</p>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity Section */}
                    <div className="stats-grid" style={{ marginTop: '30px', gridTemplateColumns: '1fr' }}>
                        <div className="stat-card" style={{ display: 'block', padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <div className="stat-icon-bg icon-blue" style={{ width: '40px', height: '40px' }}>
                                    <TrendingUp size={20} />
                                </div>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>Correções Recentes</h2>
                            </div>

                            {recentResults.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {recentResults.map(r => (
                                        <div key={r.id} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px',
                                            background: '#f8fafc',
                                            borderRadius: '12px',
                                            border: '1px solid #f1f5f9'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '14px' }}>{r.nome}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>{r.assunto} • {r.data || 'Agora'}</div>
                                            </div>
                                            <div style={{
                                                padding: '4px 12px',
                                                borderRadius: '8px',
                                                background: r.nota > 5.9 ? '#dcfce7' : '#fee2e2',
                                                color: r.nota > 5.9 ? '#166534' : '#991b1b',
                                                fontWeight: 'bold'
                                            }}>
                                                {parseFloat(r.nota).toFixed(1)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>Nenhuma correção realizada ainda.</p>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions banner */}
                    <div className="section-container" style={{ marginTop: '30px' }}>
                        <div className="welcome-banner">
                            <div className="welcome-content">
                                <h2>Comece agora</h2>
                                <p>Selecione uma opção abaixo para gerenciar suas turmas e provas.</p>
                                <div className="quick-actions">
                                    <button className="action-button primary" onClick={() => window.location.href = '/dashboard/turmas'}>
                                        Minhas Turmas
                                    </button>
                                    <button className="action-button secondary" onClick={() => window.location.href = '/dashboard/gabarito'}>
                                        Novo Gabarito
                                    </button>
                                    {isAdmin && (
                                        <button className="action-button outline" onClick={() => navigate('/dashboard/admin')} style={{ border: '1px solid #e2e8f0', background: 'white' }}>
                                            Painel Admin
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="welcome-image">
                                <LayoutDashboard size={100} opacity={0.1} />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};