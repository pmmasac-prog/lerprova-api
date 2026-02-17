import React, { useState, useEffect } from 'react';
import { Calendar, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import './Planejamento.css';

interface Turma {
    id: number;
    nome: string;
    disciplina?: string;
}

interface Plano {
    id: number;
    titulo: string;
    disciplina?: string;
    data_inicio: string;
    total_aulas: number;
    aulas_concluidas: number;
    progresso: number;
}

interface Aula {
    id: number;
    titulo: string;
    ordem: number;
    scheduled_date: string;
    status: string;
    registros?: any[];
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
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [selectedTurmaId, setSelectedTurmaId] = useState<number | null>(null);
    const [planos, setPlanos] = useState<Plano[]>([]);
    const [selectedPlanoId, setSelectedPlanoId] = useState<number | null>(null);
    const [aulas, setAulas] = useState<Aula[]>([]);
    const [aulaHoje, setAulaHoje] = useState<Aula | null>(null);

    const [percepcoesSelecionadas, setPercepcoesSelecionadas] = useState<Set<string>>(new Set());
    const [showSugestaoReforco, setShowSugestaoReforco] = useState(false);
    const [saving, setSaving] = useState(false);
    const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);

    const [showNewPlanoModal, setShowNewPlanoModal] = useState(false);
    const [newPlanoData, setNewPlanoData] = useState({
        titulo: '',
        disciplina: '',
        data_inicio: new Date().toISOString().split('T')[0],
        aulas_raw: '',
        intervalo: 2
    });

    useEffect(() => {
        loadTurmas();
    }, []);

    useEffect(() => {
        if (selectedTurmaId) {
            loadPlanos(selectedTurmaId);
            loadHeatmap(selectedTurmaId);
        }
    }, [selectedTurmaId]);

    useEffect(() => {
        if (selectedPlanoId) {
            loadPlanoDetails(selectedPlanoId);
        }
    }, [selectedPlanoId]);

    const loadTurmas = async () => {
        try {
            const data = await api.getTurmas();
            setTurmas(data);
            if (data.length > 0) {
                setSelectedTurmaId(data[0].id);
            }
        } catch (error) {
            console.error('Erro ao carregar turmas:', error);
        }
    };

    const loadPlanos = async (turmaId: number) => {
        try {
            const data = await api.getPlanosturma(turmaId);
            setPlanos(data);
            if (data.length > 0) {
                setSelectedPlanoId(data[0].id);
            } else {
                setSelectedPlanoId(null);
                setAulas([]);
                setAulaHoje(null);
            }
        } catch (error) {
            console.error('Erro ao carregar planos:', error);
        }
    };

    const loadPlanoDetails = async (planoId: number) => {
        try {
            // Carregar aula de hoje/próxima
            const todayData = await api.getAulaHoje(planoId);
            if (todayData && !todayData.message) {
                setAulaHoje(todayData);
            } else {
                setAulaHoje(null);
            }

            // Carregar todas as aulas (Timeline)
            const allAulas = await api.getPlanoAulas(planoId);
            setAulas(allAulas);
        } catch (error) {
            console.error('Erro ao carregar detalhes do plano:', error);
        }
    };

    const loadHeatmap = async (turmaId: number) => {
        try {
            const heatmap = await api.getHeatmap(turmaId);
            setHeatmapData(heatmap);
        } catch (error) {
            console.error('Erro ao carregar heatmap:', error);
        }
    };

    const handleCreatePlano = async () => {
        if (!selectedTurmaId || !newPlanoData.titulo || !newPlanoData.aulas_raw) return;

        setSaving(true);
        try {
            const aulas_list = newPlanoData.aulas_raw.split('\n')
                .filter(line => line.trim() !== '')
                .map((line, index) => ({
                    ordem: index + 1,
                    titulo: line.trim()
                }));

            await api.createPlano({
                turma_id: selectedTurmaId,
                titulo: newPlanoData.titulo,
                disciplina: newPlanoData.disciplina,
                data_inicio: newPlanoData.data_inicio,
                aulas: aulas_list,
                intervalo_dias: newPlanoData.intervalo
            });

            setShowNewPlanoModal(false);
            loadPlanos(selectedTurmaId);
        } catch (error) {
            console.error('Erro ao criar plano:', error);
            alert('Erro ao criar plano');
        } finally {
            setSaving(false);
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

            alert(`✅ Aula concluída!${response.ajustes_feitos?.datas_recalculadas ? `\n📅 ${response.ajustes_feitos.datas_recalculadas} datas recalculadas` : ''}`);

            setPercepcoesSelecionadas(new Set());
            setShowSugestaoReforco(false);
            if (selectedPlanoId) loadPlanoDetails(selectedPlanoId);
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
            if (selectedPlanoId) loadPlanoDetails(selectedPlanoId);
        } catch (error) {
            console.error('Erro ao inserir reforço:', error);
            alert('Erro ao inserir reforço');
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    const currentPlano = planos.find(p => p.id === selectedPlanoId);

    return (
        <div className="planejamento-container">
            <header className="planejamento-header">
                <div>
                    <h1 className="planejamento-title">Sequências Didáticas</h1>
                    <div className="selectors-row">
                        <select
                            value={selectedTurmaId || ''}
                            onChange={(e) => setSelectedTurmaId(Number(e.target.value))}
                            className="nav-select"
                        >
                            {turmas.map(t => (
                                <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                        </select>

                        {planos.length > 0 && (
                            <select
                                value={selectedPlanoId || ''}
                                onChange={(e) => setSelectedPlanoId(Number(e.target.value))}
                                className="nav-select plan-select"
                            >
                                {planos.map(p => (
                                    <option key={p.id} value={p.id}>{p.titulo}</option>
                                ))}
                            </select>
                        )}

                        <button className="btn-add-plano" onClick={() => setShowNewPlanoModal(true)}>
                            <Plus size={16} /> Novo
                        </button>
                    </div>
                </div>
                {currentPlano && (
                    <div className="progress-badge">
                        <div className="progress-label">{currentPlano.progresso}% Concluído</div>
                        <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${currentPlano.progresso}%` }} />
                        </div>
                    </div>
                )}
            </header>

            {aulaHoje ? (
                <div className="action-card highlight-card">
                    <div className="card-header-row">
                        <div>
                            <div className="tag-today">AULA DE HOJE</div>
                            <h2 className="card-title">{aulaHoje.titulo}</h2>
                            <div className="subline">Pilar: {currentPlano?.disciplina || 'Pedagógico'}</div>
                        </div>
                        <div className="meta-pill-large">
                            <Calendar size={18} />
                            {formatDate(aulaHoje.scheduled_date)}
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
                            <div className="suggest-text">
                                <AlertCircle size={18} />
                                <span><b>Sugestão:</b> Deseja inserir uma aula de reforço antes de prosseguir?</span>
                            </div>
                            <button className="btn-reforco" onClick={handleInserirReforco}>Sim, ajustar datas</button>
                        </div>
                    )}

                    <div
                        className={`btn-main-action ${saving ? 'loading' : ''}`}
                        onClick={handleConcluirAula}
                    >
                        {saving ? 'Registrando...' : 'CONCLUIR AULA (1 TOQUE)'}
                    </div>
                </div>
            ) : (
                <div className="action-card empty-state">
                    <CheckCircle2 size={40} color="var(--success-color)" />
                    <h3>Excelente!</h3>
                    <p>Você concluiu todas as aulas planejadas para esta sequência ou não há planos ativos.</p>
                </div>
            )}

            <div className="grid-panels">
                <div className="action-card panel-timeline">
                    <h3 className="panel-title">Linha do Tempo</h3>
                    <div className="timeline-list">
                        {aulas.map((aula, idx) => (
                            <div key={aula.id} className={`timeline-item ${aula.status} ${aula.id === aulaHoje?.id ? 'current' : ''}`}>
                                <div className="timeline-marker">
                                    {aula.status === 'done' ? <CheckCircle2 size={16} /> : <span>{idx + 1}</span>}
                                </div>
                                <div className="timeline-content">
                                    <div className="timeline-header">
                                        <span className="timeline-titulo">{aula.titulo}</span>
                                        <span className="timeline-date">{formatDate(aula.scheduled_date)}</span>
                                    </div>
                                    {aula.registros && aula.registros.length > 0 && (
                                        <div className="timeline-tags">
                                            {aula.registros[0].percepcoes.map((tag: string) => (
                                                <span key={tag} className="mini-tag">{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="action-card panel-insights">
                    <h3 className="panel-title">Insights da Turma</h3>
                    <div className="heatmap-container">
                        <div className="heatmap-label">Engajamento (Últimos 15 dias)</div>
                        <div className="heatmap-grid">
                            {Array.from({ length: 15 }).map((_, i) => {
                                const dataPoint = heatmapData[i];
                                const intensity = dataPoint ? Math.max(dataPoint.engajamento, dataPoint.alerta * 0.5) : 0;
                                return (
                                    <div
                                        key={i}
                                        className="heat-cell"
                                        style={{ opacity: 0.2 + (intensity * 0.8), background: intensity > 0 ? (dataPoint?.alerta > 0.5 ? 'var(--error-color)' : 'var(--primary-color)') : 'rgba(255,255,255,0.05)' }}
                                        title={dataPoint ? `${dataPoint.data}` : ''}
                                    />
                                );
                            })}
                        </div>
                    </div>
                    <div className="insights-metrics">
                        <div className="metric-item">
                            <div className="metric-label">CLIMA</div>
                            <div className="metric-value">😊 Estável</div>
                        </div>
                        <div className="metric-item">
                            <div className="metric-label">RITMO</div>
                            <div className="metric-value">⚡ Normal</div>
                        </div>
                    </div>
                </div>
            </div>

            {showNewPlanoModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="modal-title">Novo Planejamento</h2>
                        <div className="form-group">
                            <label>Nome da Sequência</label>
                            <input
                                type="text"
                                placeholder="Ex: Fotossíntese e Respiração Celular"
                                value={newPlanoData.titulo}
                                onChange={(e) => setNewPlanoData({ ...newPlanoData, titulo: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Tópicos das Aulas (um por linha)</label>
                            <textarea
                                rows={5}
                                placeholder="Tema da aula 1&#10;Tema da aula 2&#10;..."
                                value={newPlanoData.aulas_raw}
                                onChange={(e) => setNewPlanoData({ ...newPlanoData, aulas_raw: e.target.value })}
                            />
                        </div>
                        <div className="grid2">
                            <div className="form-group">
                                <label>Intervalo (dias)</label>
                                <input
                                    type="number"
                                    value={newPlanoData.intervalo}
                                    onChange={(e) => setNewPlanoData({ ...newPlanoData, intervalo: Number(e.target.value) })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Data de Início</label>
                                <input
                                    type="date"
                                    value={newPlanoData.data_inicio}
                                    onChange={(e) => setNewPlanoData({ ...newPlanoData, data_inicio: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowNewPlanoModal(false)}>Cancelar</button>
                            <button className="btn-save" onClick={handleCreatePlano}>Criar Planejamento</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
