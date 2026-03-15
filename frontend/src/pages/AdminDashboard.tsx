import React, { useState, useEffect } from 'react';
import { Activity, Globe, Zap, Users, BookOpen, FileText, Calendar, School, BarChart3, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import './Admin.css';

export const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [overview, setOverview] = useState<any>(null);
    const [pendencias, setPendencias] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [notifying, setNotifying] = useState<number | null>(null);
    const [turmasModal, setTurmasModal] = useState(false);
    const [turmasList, setTurmasList] = useState<any[]>([]);
    const [loadingTurmas, setLoadingTurmas] = useState(false);

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

    const loadTurmas = async () => {
        setTurmasModal(true);
        setLoadingTurmas(true);
        try {
            const data = await api.request('/turmas');
            setTurmasList(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Erro ao carregar turmas:', err);
        } finally {
            setLoadingTurmas(false);
        }
    };

    const handleDeleteTurma = async (turmaId: number, turmaNome: string) => {
        if (!confirm(`ATENÇÃO: Excluir a turma "${turmaNome}" E TODOS OS SEUS ALUNOS permanentemente?`)) return;
        if (!confirm('ESTA AÇÃO NÃO PODE SER DESFEITA. Confirma?')) return;
        try {
            await api.request(`/turmas/${turmaId}/wipe`, { method: 'DELETE' });
            setTurmasList(prev => prev.filter(t => t.id !== turmaId));
            loadDashboardData();
        } catch (err) {
            console.error('Erro ao excluir turma:', err);
            alert('Erro ao excluir turma');
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
                    <div className="icon-bg icon-emerald" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)' }}>
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
                        { label: 'Alunos', value: overview.alunos, icon: <Users size={20} />, color: 'var(--color-success)' },
                        { label: 'Turmas', value: overview.turmas, icon: <BookOpen size={20} />, color: 'var(--color-primary)', onClick: loadTurmas },
                        { label: 'Gabaritos', value: overview.gabaritos, icon: <FileText size={20} />, color: 'var(--color-warning)' },
                        { label: 'Resultados', value: overview.resultados, icon: <BarChart3 size={20} />, color: 'var(--color-purple)' },
                        { label: 'Eventos', value: overview.eventos, icon: <Calendar size={20} />, color: 'var(--color-pink)' },
                        { label: 'Escolas', value: overview.schools, icon: <School size={20} />, color: 'var(--color-cyan)' },
                        { label: 'Média Notas', value: overview.media_notas?.toFixed(1) || '—', icon: <Activity size={20} />, color: '#f97316' },
                        { label: 'Presença', value: `${overview.pct_presenca}%`, icon: <Globe size={20} />, color: '#22c55e' },
                    ].map((item, idx) => (
                        <div key={idx} style={{
                            background: 'var(--bg-primary)', border: `1px solid ${item.color}33`, borderRadius: '10px',
                            padding: '16px', textAlign: 'center',
                            cursor: item.onClick ? 'pointer' : 'default',
                            transition: 'transform 0.15s',
                        }}
                        onClick={item.onClick}
                        onMouseEnter={e => { if (item.onClick) (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                        >
                            <div style={{ color: item.color, marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{item.icon}</div>
                            <p style={{ color: 'var(--color-text)', fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{item.value}</p>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', margin: '4px 0 0' }}>{item.label}</p>
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
                                                <span style={{ fontSize: '10px', color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {item.detalhes.provas_sem_nota} Provas
                                                </span>
                                            )}
                                            {item.detalhes.aulas_esquecidas > 0 && (
                                                <span style={{ fontSize: '10px', color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
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
                                        <p style={{ fontSize: '14px', color: 'var(--color-text)' }}>{act.descricao}</p>
                                        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{new Date(act.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-500 py-10 text-center">Nenhuma atividade detectada nas últimas horas.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Turmas */}
            {turmasModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '12px', padding: '24px', width: '95%', maxWidth: '650px', maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border-color, #333)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: 'var(--color-text, #fff)' }}>
                                Turmas ({turmasList.length})
                            </h3>
                            <button onClick={() => setTurmasModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted, #999)' }}>
                                <X size={22} />
                            </button>
                        </div>

                        {loadingTurmas ? (
                            <p style={{ textAlign: 'center', color: '#999', padding: '24px' }}>Carregando...</p>
                        ) : turmasList.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#999', padding: '24px' }}>Nenhuma turma encontrada.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left', color: '#999' }}>Nome</th>
                                        <th style={{ padding: '10px', textAlign: 'left', color: '#999' }}>Disciplina</th>
                                        <th style={{ padding: '10px', textAlign: 'center', color: '#999' }}>Alunos</th>
                                        <th style={{ padding: '10px', textAlign: 'center', color: '#999' }}>Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {turmasList.map((t: any) => (
                                        <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                            <td style={{ padding: '10px', color: 'var(--color-text, #fff)', fontWeight: 600 }}>{t.nome}</td>
                                            <td style={{ padding: '10px', color: '#999' }}>{t.disciplina || '—'}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: '#999' }}>{t.alunos_count ?? t.total_alunos ?? '—'}</td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleDeleteTurma(t.id, t.nome)}
                                                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    title="Excluir turma e todos alunos"
                                                >
                                                    <Trash2 size={14} /> Excluir
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
