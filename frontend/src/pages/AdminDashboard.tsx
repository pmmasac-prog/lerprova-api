import React, { useState, useEffect } from 'react';
import { Activity, Globe, Zap } from 'lucide-react';
import { api } from '../services/api';
import './Admin.css';

export const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const data = await api.getDashboardOperacional();
            setStats(data);
        } catch (error) {
            console.error('Erro ao carregar dashboard admin:', error);
        } finally {
            setLoading(false);
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

                <div className="admin-content card">
                    <div className="card-header p-4" style={{ borderBottom: '1px solid var(--admin-border)' }}>
                        <h3 className="admin-title" style={{ fontSize: '18px' }}>Distribuição de Licenças</h3>
                    </div>
                    <div className="p-6 text-center">
                        <div style={{ position: 'relative', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ position: 'absolute', width: '150px', height: '150px', borderRadius: '50%', border: '8px solid var(--admin-emerald)', borderTopColor: 'transparent', transform: 'rotate(45deg)' }} />
                            <div>
                                <span style={{ fontSize: '32px', fontWeight: '800', display: 'block' }}>{stats?.percentual_premium || '0%'}</span>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>PREMIUM USERS</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
