import React, { useState, useEffect } from 'react';
import { Activity, Globe, Zap } from 'lucide-react';
import { api } from '../services/api';
import './Admin.css';

export const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [pendencias, setPendencias] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [notifying, setNotifying] = useState<number | null>(null);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const [statsData, pendenciasData] = await Promise.all([
                api.getDashboardOperacional(),
                api.admin.listPendencias()
            ]);
            setStats(statsData);
            setPendencias(pendenciasData);
        } catch (error) {
            console.error('Erro ao carregar dashboard admin:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNotificar = async (profId: number) => {
        try {
            setNotifying(profId);
            await api.admin.notificarProfessor(profId);
            alert('Professor notificado com sucesso!');
        } catch (error) {
            alert('Falha ao notificar professor.');
        } finally {
            setNotifying(null);
        }
    };

    if (loading) return <div className="admin-container"><p>Sincronizando Ecossistema...</p></div>;

    return (
        <div className="admin-container">
            <div className="admin-header">
                <div>
                    <h1 className="admin-title">Cockpit Operacional</h1>
                    <p className="admin-subtitle">Monitoramento de atividades e engajamento em tempo real</p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-emerald" onClick={loadDashboardData} style={{ padding: '8px 16px', fontSize: '12px' }}>
                        ATUALIZAR DADOS
                    </button>
                    <div className="status-indicator">
                        <div className="dot animate-pulse" />
                        <span>SISTEMA ONLINE</span>
                    </div>
                </div>
            </div>

            <div className="admin-stats-bar">
                <div className="admin-stat">
                    <div className="icon-bg icon-emerald">
                        <Zap size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="label">Correções Hoje</span>
                        <span className="value">{stats?.provas_hoje || 0}</span>
                    </div>
                </div>
                <div className="admin-stat">
                    <div className="icon-bg icon-gold">
                        <Activity size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="label">Engajamento Semanal</span>
                        <span className="value">{stats?.crescimento_semanal || '0%'}</span>
                    </div>
                </div>
                <div className="admin-stat">
                    <div className="icon-bg icon-emerald" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <Globe size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="label">Professores Ativos</span>
                        <span className="value">{stats?.professores_ativos || 0}</span>
                    </div>
                </div>
            </div>

            <div className="admin-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                {/* Widget de Auditoria de Pendências */}
                <div className="admin-content card">
                    <div className="card-header p-4" style={{ borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 className="admin-title" style={{ fontSize: '18px' }}>Atenção Necessária</h3>
                            <p className="admin-subtitle" style={{ fontSize: '11px' }}>Professores com tarefas pendentes</p>
                        </div>
                        <span className="role-badge admin" style={{ fontSize: '10px' }}>{pendencias.length} ALERTAS</span>
                    </div>
                    <div className="p-4">
                        {pendencias.length > 0 ? (
                            pendencias.map((item: any, idx: number) => (
                                <div key={idx} className="activity-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <div>
                                        <p className="user-name" style={{ fontSize: '14px' }}>{item.nome}</p>
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                            {item.detalhes.provas_sem_nota > 0 && (
                                                <span style={{ fontSize: '10px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {item.detalhes.provas_sem_nota} Provas
                                                </span>
                                            )}
                                            {item.detalhes.aulas_esquecidas > 0 && (
                                                <span style={{ fontSize: '10px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {item.detalhes.aulas_esquecidas} Aulas
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        className="btn-emerald"
                                        onClick={() => handleNotificar(item.professor_id)}
                                        disabled={notifying === item.professor_id}
                                        style={{ padding: '6px 12px', fontSize: '11px', boxShadow: 'none' }}
                                    >
                                        {notifying === item.professor_id ? 'Notificando...' : 'NOTIFICAR'}
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <Zap size={32} className="text-emerald-500 mb-2 mx-auto opacity-20" />
                                <p className="text-slate-500">Tudo em dia no ecossistema!</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="admin-content card">
                    <div className="card-header p-4" style={{ borderBottom: '1px solid var(--admin-border)' }}>
                        <h3 className="admin-title" style={{ fontSize: '18px' }}>Atividade do Ecossistema</h3>
                    </div>
                    <div className="p-4">
                        {stats?.atividades_recentes?.length > 0 ? (
                            stats.atividades_recentes.map((act: any, idx: number) => (
                                <div key={idx} className="activity-row" style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <div className="activity-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--admin-emerald)', marginTop: '6px' }} />
                                    <div>
                                        <p style={{ fontSize: '14px', color: '#f1f5f9' }}>{act.descricao}</p>
                                        <p style={{ fontSize: '11px', color: '#64748b' }}>{new Date(act.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-500 py-10 text-center">Nenhuma atividade detectada nas últimas horas.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
