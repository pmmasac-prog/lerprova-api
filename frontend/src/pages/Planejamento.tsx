import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';
import { api } from '../services/api';
import './Planejamento.css';
import { PlanejamentoStudio } from './PlanejamentoStudio';

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

const PERCEPCOES = [
    { key: 'engajados', label: '🔥 Engajados', color: '#10b981' },
    { key: 'duvida', label: '🤔 Muita Dúvida', color: '#f59e0b' },
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
    const [proximaAula, setProximaAula] = useState<Aula | null>(null);
    const [searchParams] = useSearchParams();

    const [percepcoesSelecionadas, setPercepcoesSelecionadas] = useState<Set<string>>(new Set());
    const [showSugestaoReforco, setShowSugestaoReforco] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showNewPlanoModal, setShowNewPlanoModal] = useState(false);

    useEffect(() => {
        loadTurmas();
    }, []);

    useEffect(() => {
        if (selectedTurmaId && selectedTurmaId > 0) {
            loadPlanos(selectedTurmaId);
        }
    }, [selectedTurmaId]);

    useEffect(() => {
        if (selectedPlanoId && selectedPlanoId > 0) {
            loadPlanoDetails(selectedPlanoId);
        }
    }, [selectedPlanoId]);

    const loadTurmas = async () => {
        try {
            const data = await api.getTurmas();
            setTurmas(data);

            const urlTurmaId = searchParams.get('turmaId');
            if (urlTurmaId) {
                setSelectedTurmaId(Number(urlTurmaId));
            } else if (data.length > 0 && !selectedTurmaId) {
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
            const allAulas = await api.getPlanoAulas(planoId);
            setAulas(allAulas);

            // Aula de hoje: primeira pending
            const hoje = allAulas.find((a: Aula) => a.status === 'pending');
            setAulaHoje(hoje || null);

            // Próxima aula: segunda pending
            const pendentes = allAulas.filter((a: Aula) => a.status === 'pending');
            setProximaAula(pendentes.length > 1 ? pendentes[1] : null);
        } catch (error) {
            console.error('Erro ao carregar detalhes do plano:', error);
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
        if (!aulaHoje || !aulaHoje.id || isNaN(aulaHoje.id)) return;

        setSaving(true);
        try {
            const response = await api.concluirAula(aulaHoje.id, {
                percepcoes: Array.from(percepcoesSelecionadas),
                observacoes: null
            });

            if (response.ajustes_feitos?.avaliação_adiada) {
                alert(`📢 Inteligência Pedagógica:\nDevido às dúvidas constantes, adiei a '${response.ajustes_feitos.avaliação_adiada}' em 7 dias p/ reforço.`);
            }

            setPercepcoesSelecionadas(new Set());
            setShowSugestaoReforco(false);
            if (selectedPlanoId) loadPlanoDetails(selectedPlanoId);
        } catch (error) {
            console.error('Erro ao concluir aula:', error);
        } finally {
            setSaving(false);
        }
    };

    const formatDateShort = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    const currentPlano = planos.find(p => p.id === selectedPlanoId);
    const currentTurma = turmas.find(t => t.id === selectedTurmaId);
    const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    return (
        <div className="planejamento-momento">
            {/* ZONA 1: CABEÇALHO (Contexto Automático) */}
            <header className="zona-orientacao">
                <div className="context-top">
                    <div className="class-info">
                        <select
                            value={selectedTurmaId || ''}
                            onChange={(e) => setSelectedTurmaId(Number(e.target.value))}
                            className="minimal-select"
                        >
                            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </select>
                        <span className="disciplina-tag">{currentTurma?.disciplina || 'Pedagógico'}</span>
                    </div>
                    <div className="date-pill">HOJE, {dataHoje}</div>
                </div>

                <div className="plan-highlights">
                    <h1 className="plan-title">{currentPlano?.titulo || 'Sem Plano Ativo'}</h1>
                    <div className="plan-meta">
                        {aulaHoje ? (
                            <>
                                <span className="meta-item"><BookOpen size={14} /> Aula {aulaHoje.ordem}/{currentPlano?.total_aulas}</span>
                                {proximaAula && <span className="meta-item next">Próxima: {proximaAula.titulo}</span>}
                            </>
                        ) : (
                            <span className="meta-item done">Sequência concluída 🎉</span>
                        )}
                    </div>
                </div>

                {currentPlano && (
                    <div className="progress-container">
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${currentPlano.progresso}%` }} />
                        </div>
                        <span className="progress-text">{currentPlano.progresso}%</span>
                    </div>
                )}
            </header>

            {/* ZONA 2: DECISÃO (Ação Humana) */}
            <main className="zona-decisao">
                {aulaHoje ? (
                    <div className="registro-hoje">
                        <div className="label-percepcao">Conteúdo: <b>{aulaHoje.titulo}</b></div>
                        <p className="hint-percepcao">Como foi o clima da turma nesta aula?</p>

                        <div className="chips-grid">
                            {PERCEPCOES.map(p => (
                                <button
                                    key={p.key}
                                    className={`percepcao-chip ${percepcoesSelecionadas.has(p.key) ? 'active' : ''}`}
                                    onClick={() => togglePercepcao(p.key)}
                                    style={percepcoesSelecionadas.has(p.key) ? { backgroundColor: p.color } : {}}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {showSugestaoReforco && (
                            <div className="intel-alert">
                                <AlertCircle size={18} />
                                <span><b>Sugestão:</b> Inserir reforço agora?</span>
                                <button onClick={() => api.inserirReforco(aulaHoje.id).then(() => loadPlanoDetails(selectedPlanoId!))}>Sim</button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="empty-plan-state">
                        <CheckCircle2 size={48} color="var(--success-color)" />
                        <h3>Tudo em dia!</h3>
                        <p>Crie um novo planejamento para continuar evoluindo com esta turma.</p>
                        <button className="btn-create-floating" onClick={() => setShowNewPlanoModal(true)}>
                            <Plus size={20} /> Novo Planejamento
                        </button>
                    </div>
                )}
            </main>

            {/* ZONA 3: SEQUÊNCIA (Confiança) */}
            <section className="zona-sequencia">
                <h3 className="section-label">SEQUÊNCIA DIDÁTICA</h3>
                <div className="timeline-horizontal">
                    {aulas.map((aula) => (
                        <div
                            key={aula.id}
                            className={`step-bubble ${aula.status} ${aula.id === aulaHoje?.id ? 'active' : ''}`}
                            title={aula.titulo}
                        >
                            <div className="bubble-icon">
                                {aula.status === 'done' ? <CheckCircle2 size={12} /> : <span>{aula.ordem}</span>}
                            </div>
                            <span className="bubble-date">{formatDateShort(aula.scheduled_date)}</span>
                            {aula.id === aulaHoje?.id && <div className="current-marker" />}
                        </div>
                    ))}
                    {planos.length > 0 && (
                        <button className="btn-add-step" onClick={() => setShowNewPlanoModal(true)}>
                            <Plus size={16} />
                        </button>
                    )}
                </div>
            </section>

            {/* ZONA 4: CONCLUSÃO (Fechamento Cognitivo) */}
            <footer className="zona-conclusao">
                {aulaHoje && (
                    <button
                        className={`btn-concluir-momento ${saving ? 'loading' : ''}`}
                        onClick={handleConcluirAula}
                        disabled={saving}
                    >
                        {saving ? 'SALVANDO...' : 'CONCLUIR REGISTRO'}
                    </button>
                )}
            </footer>

            {showNewPlanoModal && selectedTurmaId && selectedTurmaId > 0 && (
                <PlanejamentoStudio
                    onClose={() => setShowNewPlanoModal(false)}
                    onCreated={() => {
                        setShowNewPlanoModal(false);
                        loadPlanos(selectedTurmaId);
                    }}
                    turmaId={selectedTurmaId}
                    turmaNome={turmas.find(t => t.id === selectedTurmaId)?.nome || ''}
                    disciplinaPre={turmas.find(t => t.id === selectedTurmaId)?.disciplina || ''}
                />
            )}
        </div>
    );
};
