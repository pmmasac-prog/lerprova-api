import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2, AlertCircle, BookOpen, Calendar as CalendarIcon, ChevronDown, List, Book } from 'lucide-react';
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

const PERCEPCOES = [
    { key: 'engajados', label: '🔥 Engajados', color: '#10b981' },
    { key: 'duvida', label: '🤔 Muita Dúvida', color: '#f59e0b' },
    { key: 'tempo', label: '⏳ Faltou Tempo', color: '#ef4444' },
    { key: 'lab', label: '🧪 Prática Lab', color: '#3b82f6' }
];

const DIAS_SEMANA = [
    { id: 0, label: 'Seg' },
    { id: 1, label: 'Ter' },
    { id: 2, label: 'Qua' },
    { id: 3, label: 'Qui' },
    { id: 4, label: 'Sex' }
];

export const Planejamento: React.FC = () => {
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [selectedTurmaId, setSelectedTurmaId] = useState<number | null>(null);
    const [planos, setPlanos] = useState<Plano[]>([]);
    const [selectedPlanoId, setSelectedPlanoId] = useState<number | null>(null);
    const [aulas, setAulas] = useState<Aula[]>([]);
    const [aulaHoje, setAulaHoje] = useState<Aula | null>(null);
    const [proximaAula, setProximaAula] = useState<Aula | null>(null);

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
            if (data.length > 0 && !selectedTurmaId) {
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
                <NewPlanoModal
                    onClose={() => setShowNewPlanoModal(false)}
                    onCreated={() => loadPlanos(selectedTurmaId)}
                    turmaId={selectedTurmaId}
                    turmaNome={turmas.find(t => t.id === selectedTurmaId)?.nome || ''}
                    disciplinaPre={turmas.find(t => t.id === selectedTurmaId)?.disciplina || ''}
                />
            )}
        </div>
    );
};

interface CurriculoItem { id: number; name: string; title?: string; order_index?: number; }

const NewPlanoModal: React.FC<{ onClose: () => void, onCreated: () => void, turmaId: number, turmaNome: string, disciplinaPre: string }> = ({ onClose, onCreated, turmaId, turmaNome, disciplinaPre }) => {
    const [data, setData] = useState({
        titulo: '',
        disciplina: disciplinaPre,
        aulas_raw: '',
        data_inicio: new Date().toISOString().split('T')[0],
        dias_semana: [0, 2] // Seg, Qua padrão
    });
    const [loading, setLoading] = useState(false);
    const [showCurriculoBrowser, setShowCurriculoBrowser] = useState(false);

    // Curriculum Browser State
    const [subjects, setSubjects] = useState<CurriculoItem[]>([]);
    const [units, setUnits] = useState<CurriculoItem[]>([]);
    const [topics, setTopics] = useState<CurriculoItem[]>([]);
    const [selectedSub, setSelectedSub] = useState<number | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
    const [selectedTopics, setSelectedTopics] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (showCurriculoBrowser) {
            api.getCurriculoSubjects().then(setSubjects);
        }
    }, [showCurriculoBrowser]);

    useEffect(() => {
        if (selectedSub) {
            api.getCurriculoUnits(selectedSub).then(setUnits);
            setTopics([]);
            setSelectedUnit(null);
        }
    }, [selectedSub]);

    useEffect(() => {
        if (selectedUnit) {
            api.getCurriculoTopics(selectedUnit).then(setTopics);
        }
    }, [selectedUnit]);

    const toggleDay = (dayId: number) => {
        const newDays = data.dias_semana.includes(dayId)
            ? data.dias_semana.filter(d => d !== dayId)
            : [...data.dias_semana, dayId].sort();
        setData({ ...data, dias_semana: newDays });
    };

    const handleApplyCurriculo = () => {
        const topicsText = topics
            .filter(t => selectedTopics.has(t.id))
            .map(t => t.name)
            .join('\n');

        setData({
            ...data,
            aulas_raw: data.aulas_raw ? data.aulas_raw + '\n' + topicsText : topicsText,
            disciplina: subjects.find(s => s.id === selectedSub)?.name || data.disciplina
        });
        setShowCurriculoBrowser(false);
    };

    const handleCreate = async () => {
        if (!data.titulo || !data.aulas_raw || data.dias_semana.length === 0) return;
        setLoading(true);
        try {
            const aulas_list = data.aulas_raw.split('\n').filter(l => l.trim() !== '').map((l, i) => ({ ordem: i + 1, titulo: l.trim() }));
            await api.createPlano({
                turma_id: turmaId,
                titulo: data.titulo,
                disciplina: data.disciplina,
                data_inicio: data.data_inicio,
                aulas: aulas_list,
                dias_semana: data.dias_semana
            });
            onCreated();
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-pedagogical">
            <div className="modal-content-ped wide">
                <header className="modal-header-ped">
                    <h2>Planejamento: {turmaNome}</h2>
                    <button onClick={onClose}>&times;</button>
                </header>

                <div className="modal-body-ped split">
                    <div className="setup-column">
                        <label className="ped-label">Identificação</label>
                        <input type="text" placeholder="Título da Sequência" value={data.titulo} onChange={e => setData({ ...data, titulo: e.target.value })} className="ped-input" />
                        <input type="text" placeholder="Disciplina" value={data.disciplina} onChange={e => setData({ ...data, disciplina: e.target.value })} className="ped-input" />

                        <label className="ped-label">Cronograma</label>
                        <div className="row">
                            <div className="input-group">
                                <span className="small-label">Início</span>
                                <input type="date" value={data.data_inicio} onChange={e => setData({ ...data, data_inicio: e.target.value })} className="ped-input" />
                            </div>
                        </div>

                        <div className="weekday-selector">
                            <span className="small-label">Dias de Aula</span>
                            <div className="days-grid">
                                {DIAS_SEMANA.map(d => (
                                    <button
                                        key={d.id}
                                        className={`day-toggle ${data.dias_semana.includes(d.id) ? 'active' : ''}`}
                                        onClick={() => toggleDay(d.id)}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="content-column">
                        <div className="header-actions">
                            <label className="ped-label">Sequência de Conteúdos</label>
                            <button className="btn-browse-curriculo" onClick={() => setShowCurriculoBrowser(true)}>
                                <Book size={14} /> Base Curricular
                            </button>
                        </div>
                        <textarea
                            placeholder="Conteúdos das aulas (um por linha)&#10;Ex: Frações&#10;Porcentagem..."
                            value={data.aulas_raw}
                            onChange={e => setData({ ...data, aulas_raw: e.target.value })}
                            className="ped-area large"
                        />
                        <p className="hint-text">As datas serão geradas automaticamente pulando feriados e dias sem aula.</p>
                    </div>
                </div>

                <footer className="modal-footer-ped">
                    <button className="btn-cancel-ped" onClick={onClose}>Cancelar</button>
                    <button className="btn-save-ped" onClick={handleCreate} disabled={loading}>{loading ? 'Criando...' : 'Gerar Planejamento Inteligente'}</button>
                </footer>

                {showCurriculoBrowser && (
                    <div className="curriculo-browser-overlay">
                        <div className="curriculo-browser-content">
                            <header>
                                <h3>Base Curricular (BNCC)</h3>
                                <button onClick={() => setShowCurriculoBrowser(false)}>&times;</button>
                            </header>
                            <div className="browser-body">
                                <select onChange={e => setSelectedSub(Number(e.target.value))} className="ped-input">
                                    <option value="">Selecione a Disciplina</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>

                                {selectedSub && (
                                    <select onChange={e => setSelectedUnit(Number(e.target.value))} className="ped-input">
                                        <option value="">Selecione a Unidade</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                )}

                                <div className="topics-list">
                                    {topics.map(t => (
                                        <label key={t.id} className="topic-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedTopics.has(t.id)}
                                                onChange={() => {
                                                    const next = new Set(selectedTopics);
                                                    next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                                                    setSelectedTopics(next);
                                                }}
                                            />
                                            <span>{t.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <footer>
                                <button className="btn-apply" onClick={handleApplyCurriculo} disabled={selectedTopics.size === 0}>
                                    Adicionar Selecionados ({selectedTopics.size})
                                </button>
                            </footer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
