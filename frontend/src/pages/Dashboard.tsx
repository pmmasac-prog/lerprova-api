import React, { useState, useEffect } from 'react';
import {
    AlertTriangle, CheckCircle, BookOpen, ArrowRight,
    LogOut, Settings, Zap, Clock, ChevronRight,
    Target, RefreshCw, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Dashboard.css';

interface ActionPayload {
    gabarito_id?: number;
    turma_id?: number;
    aula_id?: number;
    plano_id?: number;
}

interface PrimaryAction {
    type: string;
    title: string;
    subtitle: string;
    cta_label: string;
    route: string;
    payload: ActionPayload;
    score: number;
    why: string[];
}

interface Alert {
    type: string;
    title: string;
    subtitle: string;
    cta_label: string;
    route: string;
    payload: ActionPayload;
    score: number;
    why: string[];
}

interface ClassStatus {
    turma_id: number;
    nome: string;
    disciplina: string | null;
    estado: 'ok' | 'atencao' | 'critico';
}

interface ActivityItem {
    icon: string;
    text: string;
    detail: string;
    timestamp: string | null;
}

interface DashboardData {
    primary_action: PrimaryAction;
    alerts: Alert[];
    classes_status: ClassStatus[];
    recent_activity: ActivityItem[];
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
    'CORRIGIR_PROVA': <Target size={32} />,
    'REVISAR_AMBIGUAS': <AlertTriangle size={32} />,
    'REGISTRAR_AULA': <BookOpen size={32} />,
    'COBRAR_FALTANTES': <Users size={32} />,
    'CRIAR_REFORCO': <RefreshCw size={32} />,
    'DIA_LIVRE': <CheckCircle size={32} />,
    'ORGANIZAR_TURMA': <Zap size={32} />,
};

const ACTION_GRADIENTS: Record<string, string> = {
    'CORRIGIR_PROVA': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'REVISAR_AMBIGUAS': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'REGISTRAR_AULA': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'COBRAR_FALTANTES': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'CRIAR_REFORCO': 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'DIA_LIVRE': 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
    'ORGANIZAR_TURMA': 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
};

const SEMAFORO: Record<string, { dot: string; label: string; className: string }> = {
    'ok': { dot: '🟢', label: 'Em dia', className: 'status-ok' },
    'atencao': { dot: '🟡', label: 'Atenção', className: 'status-atencao' },
    'critico': { dot: '🔴', label: 'Crítico', className: 'status-critico' },
};

export const Dashboard: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';
    const firstName = user.nome?.split(' ')[0] || 'Professor(a)';

    useEffect(() => {
        if (isAdmin) {
            navigate('/admin');
            return;
        }
        loadDashboard();
    }, [isAdmin]);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await api.getDashboardOperacional();
            setData(result);
        } catch (err) {
            console.error('Erro ao carregar dashboard:', err);
            setError('Erro ao carregar dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if (confirm('Deseja realmente sair?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    };

    const handleAction = (route: string) => {
        navigate(route);
    };

    const getTimeAgo = (timestamp: string | null): string => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin < 60) return `${diffMin}min atrás`;
            const diffH = Math.floor(diffMin / 60);
            if (diffH < 24) return `${diffH}h atrás`;
            const diffD = Math.floor(diffH / 24);
            return `${diffD}d atrás`;
        } catch {
            return '';
        }
    };

    // ====== RENDER ======

    if (loading) {
        return (
            <div className="op-dashboard">
                <div className="op-header">
                    <div className="op-header-left">
                        <h1 className="op-greeting">Olá, {firstName}</h1>
                        <p className="op-date">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                </div>
                <div className="op-grid">
                    <div className="op-center"><div className="op-skeleton op-skeleton-hero" /></div>
                    <div className="op-alerts-col"><div className="op-skeleton op-skeleton-alert" /><div className="op-skeleton op-skeleton-alert" /></div>
                    <div className="op-turmas-col"><div className="op-skeleton op-skeleton-turma" /></div>
                    <div className="op-history-col"><div className="op-skeleton op-skeleton-history" /></div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="op-dashboard">
                <div className="op-error">
                    <AlertTriangle size={48} />
                    <p>{error || 'Erro desconhecido'}</p>
                    <button onClick={loadDashboard}>Tentar novamente</button>
                </div>
            </div>
        );
    }

    const { primary_action, alerts, classes_status, recent_activity } = data;
    const gradient = ACTION_GRADIENTS[primary_action.type] || ACTION_GRADIENTS['DIA_LIVRE'];
    const icon = ACTION_ICONS[primary_action.type] || <Zap size={32} />;

    return (
        <div className="op-dashboard">
            {/* Header */}
            <div className="op-header">
                <div className="op-header-left">
                    <h1 className="op-greeting">Olá, {firstName}</h1>
                    <p className="op-date">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div className="op-header-right">
                    {isAdmin && (
                        <button className="op-icon-btn" onClick={() => navigate('/dashboard/debug')} title="Diagnóstico">
                            <Settings size={20} />
                        </button>
                    )}
                    <button className="op-icon-btn op-icon-btn-danger" onClick={handleLogout} title="Sair">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Grid: 4 Cognitive Layers */}
            <div className="op-grid">

                {/* LAYER 1: Primary Action (Center) */}
                <div className="op-center">
                    <div className="op-hero-card" style={{ background: gradient }}>
                        <div className="op-hero-icon">{icon}</div>
                        <div className="op-hero-content">
                            <h2 className="op-hero-title">{primary_action.title}</h2>
                            <p className="op-hero-subtitle">{primary_action.subtitle}</p>
                            <div className="op-hero-why">
                                {primary_action.why.map((w, i) => (
                                    <span key={i} className="op-why-chip">{w}</span>
                                ))}
                            </div>
                        </div>
                        <button
                            className="op-hero-cta"
                            onClick={() => handleAction(primary_action.route)}
                        >
                            {primary_action.cta_label}
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </div>

                {/* LAYER 2: Alerts (Top-left) */}
                <div className="op-alerts-col">
                    <h3 className="op-section-title">
                        <AlertTriangle size={16} />
                        Alertas Pedagógicos
                    </h3>
                    {alerts.length === 0 ? (
                        <div className="op-empty-state">
                            <CheckCircle size={24} />
                            <span>Nenhum alerta no momento</span>
                        </div>
                    ) : (
                        alerts.map((alert, i) => (
                            <div
                                key={i}
                                className={`op-alert-card op-alert-${alert.type.toLowerCase()}`}
                                onClick={() => handleAction(alert.route)}
                            >
                                <div className="op-alert-body">
                                    <p className="op-alert-title">{alert.title}</p>
                                    <p className="op-alert-sub">{alert.subtitle}</p>
                                </div>
                                <ChevronRight size={18} className="op-alert-arrow" />
                            </div>
                        ))
                    )}
                </div>

                {/* LAYER 3: Classes Status (Right) */}
                <div className="op-turmas-col">
                    <h3 className="op-section-title">
                        <BookOpen size={16} />
                        Minhas Turmas
                    </h3>
                    {classes_status.length === 0 ? (
                        <div className="op-empty-state">
                            <Users size={24} />
                            <span>Nenhuma turma cadastrada</span>
                        </div>
                    ) : (
                        classes_status.map((t) => {
                            const sem = SEMAFORO[t.estado] || SEMAFORO['ok'];
                            return (
                                <div
                                    key={t.turma_id}
                                    className={`op-turma-row ${sem.className}`}
                                    onClick={() => navigate(`/dashboard/turma/${t.turma_id}`)}
                                >
                                    <span className="op-turma-dot">{sem.dot}</span>
                                    <div className="op-turma-info">
                                        <span className="op-turma-name">{t.nome}</span>
                                        {t.disciplina && <span className="op-turma-disc">{t.disciplina}</span>}
                                    </div>
                                    <span className="op-turma-label">{sem.label}</span>
                                    <ChevronRight size={16} />
                                </div>
                            );
                        })
                    )}
                </div>

                {/* LAYER 4: Recent History (Bottom) */}
                <div className="op-history-col">
                    <h3 className="op-section-title">
                        <Clock size={16} />
                        Histórico Recente
                    </h3>
                    {recent_activity.length === 0 ? (
                        <div className="op-empty-state">
                            <Clock size={24} />
                            <span>Nenhuma atividade recente</span>
                        </div>
                    ) : (
                        <div className="op-history-list">
                            {recent_activity.map((item, i) => (
                                <div key={i} className="op-history-item">
                                    <div className="op-history-dot" />
                                    <div className="op-history-body">
                                        <span className="op-history-text">{item.text}</span>
                                        {item.detail && <span className="op-history-detail">{item.detail}</span>}
                                    </div>
                                    <span className="op-history-time">{getTimeAgo(item.timestamp)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};