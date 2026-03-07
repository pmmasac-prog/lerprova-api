import React, { useState, useEffect } from 'react';
import { Activity, Globe, Zap, Users, BookOpen, FileText, Calendar, School, BarChart3 } from 'lucide-react';
import { api } from '../services/api';
import './Admin.css';

export const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [overview, setOverview] = useState<any>(null);
    const [pendencias, setPendencias] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [notifying, setNotifying] = useState<number | null>(null);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const [statsData, pendenciasData, overviewData] = await Promise.all([
                api.getDashboardOperacional(),
                api.admin.listPendencias(),
                api.admin.getSystemOverview().catch(() => null),
            ]);
            setStats(statsData || {});
            setPendencias(Array.isArray(pendenciasData) ? pendenciasData : []);
            setOverview(overviewData);
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

            {/* VISÃO GERAL DO SISTEMA */}
            {overview && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', margin: '20px 0' }}>
                    {[
                        { label: 'Alunos', value: overview.alunos, icon: <Users size={20} />, color: '#10b981' },
                        { label: 'Turmas', value: overview.turmas, icon: <BookOpen size={20} />, color: '#3b82f6' },
                        { label: 'Gabaritos', value: overview.gabaritos, icon: <FileText size={20} />, color: '#f59e0b' },
                        { label: 'Resultados', value: overview.resultados, icon: <BarChart3 size={20} />, color: '#8b5cf6' },
                        { label: 'Eventos', value: overview.eventos, icon: <Calendar size={20} />, color: '#ec4899' },
                        { label: 'Escolas', value: overview.schools, icon: <School size={20} />, color: '#06b6d4' },
                        { label: 'Média Notas', value: overview.media_notas?.toFixed(1) || '—', icon: <Activity size={20} />, color: '#f97316' },
                        { label: 'Presença', value: `${overview.pct_presenca}%`, icon: <Globe size={20} />, color: '#22c55e' },
                    ].map((item, idx) => (
                        <div key={idx} style={{
                            background: '#0f172a', border: `1px solid ${item.color}33`, borderRadius: '10px',
                            padding: '16px', textAlign: 'center',
                        }}>
                            <div style={{ color: item.color, marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{item.icon}</div>
                            <p style={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{item.value}</p>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '4px 0 0' }}>{item.label}</p>
                        </div>
                    ))}
                </div>
            )}

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
