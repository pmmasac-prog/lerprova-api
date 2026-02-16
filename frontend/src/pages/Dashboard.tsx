import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, BookOpen, ClipboardList, TrendingUp } from 'lucide-react';
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await api.getStats();
            setStats(data);
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Olá, Professor(a)</h1>
                    <p className="dashboard-subtitle">Bem-vindo(a) ao LerProva</p>
                </div>
                <div className="header-date">
                    <span>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
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

                    {/* Recent Activity or Welcome Section */}
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