import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { api } from '../services/api';
import './Planejamento.css';

interface Plano {
    id: number;
    titulo: string;
    disciplina?: string;
    data_inicio: string;
    total_aulas: number;
    aulas_concluidas: number;
    progresso: number;
}

interface AulaHoje {
    id: number;
    titulo: string;
    ordem: number;
    scheduled_date: string;
    status: string;
}


interface HeatmapData {
    data: string;
    engajamento: number;
    alerta: number;
}

const PERCEPCOES = [
    { key: 'engajados', label: '🔥 Super Engajados', color: '#10b981' },
    { key: 'duvida', label: '🤔 Dúvidas na Base', color: '#f59e0b' },
    { key: 'tempo', label: '⏳ Faltou Tempo', color: '#ef4444' },
    { key: 'lab', label: '🧪 Prática Lab', color: '#3b82f6' }
];

export const Planejamento: React.FC = () => {
    const [aulaHoje, setAulaHoje] = useState<AulaHoje | null>(null);
    const [percepcoesSelecionadas, setPercepcoesSelecionadas] = useState<Set<string>>(new Set());
    const [showSugestaoReforco, setShowSugestaoReforco] = useState(false);
    const [saving, setSaving] = useState(false);
    const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
    const [planos, setPlanos] = useState<Plano[]>([]);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            // Carregar turmas do usuário
            const turmas = await api.getTurmas();
            if (turmas.length > 0) {
                const firstTurma = turmas[0];

                // Carregar planos da turma
                const planosData = await api.getPlanosturma(firstTurma.id);
                setPlanos(planosData);

                if (planosData.length > 0) {
                    const firstPlano = planosData[0];
                    setPlanoId(firstPlano.id);

                    // Carregar aula de hoje
                    const aulaData = await api.getAulaHoje(firstPlano.id);
                    if (aulaData && !aulaData.message) {
                        setAulaHoje(aulaData);
                    }
                }

                // Carregar heatmap
                const heatmap = await api.getHeatmap(firstTurma.id);
                setHeatmapData(heatmap);
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    };

    const togglePercepcao = (key: string) => {
        const newSet = new Set(percepcoesSelecionadas);
        if (newSet.has(key)) {
            newSet.delete(key);
            if (key === 'duvida') setShowSugestaoReforco(false);
        } else {
            newSet.add(key);
            if (key === 'duvida') setShowSugestaoReforco(true);
        }
        setPercepcoesSelecionadas(newSet);
    };

    const handleConcluirAula = async () => {
        if (!aulaHoje) return;

        setSaving(true);
        try {
            const response = await api.concluirAula(aulaHoje.id, {
                percepcoes: Array.from(percepcoesSelecionadas),
                observacoes: null
            });

            alert(`✅ Aula concluída com sucesso!${response.ajustes_feitos?.datas_recalculadas ? `\n📅 ${response.ajustes_feitos.datas_recalculadas} datas recalculadas` : ''}`);

            // Recarregar dados
            setPercepcoesSelecionadas(new Set());
            setShowSugestaoReforco(false);
            loadInitialData();
        } catch (error) {
            console.error('Erro ao concluir aula:', error);
            alert('Erro ao concluir aula');
        } finally {
            setSaving(false);
        }
    };

    const handleInserirReforco = async () => {
        if (!aulaHoje) return;

        try {
            const response = await api.inserirReforco(aulaHoje.id);
            alert(`✅ Reforço inserido!\n📅 ${response.ajustes_feitos.datas_recalculadas} datas recalculadas`);
            setShowSugestaoReforco(false);
            loadInitialData();
        } catch (error) {
            console.error('Erro ao inserir reforço:', error);
            alert('Erro ao inserir reforço');
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    const hoje = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: '2-digit'
    });

    if (!aulaHoje) {
        return (
            <div className="planejamento-container">
                <div className="planejamento-header">
                    <h1 className="planejamento-title">Planejamento</h1>
                    <p className="planejamento-subtitle">Nenhuma aula pendente para hoje</p>
                </div>
            </div>
        );
    }

    return (
        <div className="planejamento-container">
            <header className="planejamento-header">
                <div>
                    <div className="turma-selector">
                        {planos[0]?.disciplina || 'Disciplina'} ▾
                    </div>
                    <div className="subline">{hoje}</div>
                    <div className="meta-row">
                        <span className="pill">
                            <Calendar size={14} />
                            Aula {aulaHoje.ordem}/{planos[0]?.total_aulas || '?'}
                        </span>
                        <span className="pill">
                            <Clock size={14} />
                            Data: {formatDate(aulaHoje.scheduled_date)}
                        </span>
                    </div>
                </div>
                <div className="sequencia-badge">
                    {planos[0]?.titulo || 'Plano de Aulas'}
                </div>
            </header>

            <div className="action-card">
                <div className="card-header-row">
                    <div>
                        <h2 className="card-title">Registro de Hoje</h2>
                        <div className="subline">Marque a percepção da turma e conclua em 1 toque.</div>
                    </div>
                    <div className="topic-badge">
                        Conteúdo: {aulaHoje.titulo}
                    </div>
                </div>

                <div className="percepcao-grid">
                    {PERCEPCOES.map(p => (
                        <button
                            key={p.key}
                            className={`chip-btn ${percepcoesSelecionadas.has(p.key) ? 'active' : ''}`}
                            onClick={() => togglePercepcao(p.key)}
                            style={percepcoesSelecionadas.has(p.key) ? {
                                background: p.color,
                                borderColor: p.color,
                                color: '#fff'
                            } : {}}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {showSugestaoReforco && (
                    <div className="suggest-box">
                        <span>💡 <b>Sugestão:</b> Inserir "Aula de Reforço" antes de avançar?</span>
                        <button onClick={handleInserirReforco}>Sim, ajustar</button>
                    </div>
                )}
            </div>

            <div className="action-card panel-dashed">
                <h3 className="insights-title">Insights da Turma</h3>
                <p className="insights-subtitle">Frequência de engajamento nos últimos 15 dias:</p>

                <div className="heatmap">
                    {Array.from({ length: 15 }).map((_, i) => {
                        const dataPoint = heatmapData[i];
                        const isActive = dataPoint && (dataPoint.engajamento > 0.5 || dataPoint.alerta > 0.5);
                        return (
                            <div
                                key={i}
                                className={`heat-cell ${isActive ? 'active' : ''}`}
                                title={dataPoint ? `${dataPoint.data}: Eng ${dataPoint.engajamento} / Alerta ${dataPoint.alerta}` : ''}
                            />
                        );
                    })}
                </div>

                <div className="grid2">
                    <div className="mini-card">
                        <div className="mini-label">CLIMA MÉDIO</div>
                        <div className="mini-value">😊 Estável</div>
                    </div>
                    <div className="mini-card">
                        <div className="mini-label">RITMO</div>
                        <div className="mini-value">⚡ Normal</div>
                    </div>
                </div>
            </div>

            <div
                className={`save-bar ${saving ? 'disabled' : ''}`}
                onClick={handleConcluirAula}
            >
                {saving ? '⌛ REGISTRANDO...' : 'CONCLUIR REGISTRO (1 TOQUE)'}
            </div>
        </div>
    );
};
