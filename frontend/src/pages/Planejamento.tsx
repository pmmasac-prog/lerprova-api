// Planejamento.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, CheckCircle2, AlertCircle, BookOpen, Pencil } from 'lucide-react';
import { api } from '../services/api';
import './Planejamento.css';
import { PlanejamentoStudio } from './PlanejamentoStudio';

interface Turma {
    id: number;
    nome: string;
    disciplina?: string;
    dias_semana?: string | number[];
}

interface Plano {
    id: number;
    titulo: string;
    disciplina?: string;
    data_inicio: string;
    total_aulas: number;
    aulas_concluidas: number;
    progresso: number;
    dias_semana?: number[];
}

type AulaStatus = 'pending' | 'done' | 'skipped' | 'canceled' | string;

interface Aula {
    id: number;
    titulo: string;
    ordem: number;
    scheduled_date: string;
    status: AulaStatus;
    registros?: unknown[];
    conteudos?: string[];
}

const PERCEPCOES = [
    { key: 'engajados', label: '🔥 Engajados', color: '#10b981' },
    { key: 'duvida', label: '🤔 Muita Dúvida', color: '#f59e0b' },
    { key: 'tempo', label: '⏳ Faltou Tempo', color: '#ef4444' },
    { key: 'lab', label: '🧪 Prática Lab', color: '#3b82f6' },
] as const;

type PercepcaoKey = (typeof PERCEPCOES)[number]['key'];

function safeParseISODate(iso: string): Date | null {
    // iso esperado: YYYY-MM-DD
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatBRShort(iso: string): string {
    const dt = safeParseISODate(iso);
    if (!dt) return '--/--';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(dt);
}

export const Planejamento: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [selectedTurmaId, setSelectedTurmaId] = useState<number | null>(null);

    const [planos, setPlanos] = useState<Plano[]>([]);
    const [selectedPlanoId, setSelectedPlanoId] = useState<number | null>(null);

    const [aulas, setAulas] = useState<Aula[]>([]);
    const [percepcoesSelecionadas, setPercepcoesSelecionadas] = useState<Set<PercepcaoKey>>(new Set());
    const [showSugestaoReforco, setShowSugestaoReforco] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showNewPlanoModal, setShowNewPlanoModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingPlanoData, setEditingPlanoData] = useState<Plano | null>(null);

    const [loadingTurmas, setLoadingTurmas] = useState(false);
    const [loadingPlanos, setLoadingPlanos] = useState(false);
    const [loadingAulas, setLoadingAulas] = useState(false);

    const lastLoadToken = useRef(0);

    const currentPlano = useMemo(() => planos.find(p => p.id === selectedPlanoId) ?? null, [planos, selectedPlanoId]);
    const currentTurma = useMemo(() => turmas.find(t => t.id === selectedTurmaId) ?? null, [turmas, selectedTurmaId]);

    const aulaHoje = useMemo(() => aulas.find(a => a.status === 'pending') ?? null, [aulas]);
    const proximaAula = useMemo(() => {
        const pend = aulas.filter(a => a.status === 'pending');
        return pend.length > 1 ? pend[1] : null;
    }, [aulas]);

    const dataHoje = useMemo(() => {
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date());
    }, []);

    const loadTurmas = useCallback(async () => {
        setLoadingTurmas(true);
        const token = ++lastLoadToken.current;
        try {
            const data = await api.getTurmas();
            if (token !== lastLoadToken.current) return;
            setTurmas(data);

            const urlTurmaId = searchParams.get('turmaId');
            const urlId = urlTurmaId ? Number(urlTurmaId) : null;
            const exists = urlId && data.some((t: Turma) => t.id === urlId);

            if (exists) {
                setSelectedTurmaId(urlId!);
            } else if (data.length > 0) {
                setSelectedTurmaId(prev => prev ?? data[0].id);
            } else {
                setSelectedTurmaId(null);
            }
        } catch (e) {
            console.error('Erro ao carregar turmas:', e);
        } finally {
            if (token === lastLoadToken.current) setLoadingTurmas(false);
        }
    }, [searchParams]);

    const loadPlanos = useCallback(async (turmaId: number) => {
        setLoadingPlanos(true);
        const token = ++lastLoadToken.current;
        try {
            const data = await api.getPlanosturma(turmaId);
            if (token !== lastLoadToken.current) return;

            setPlanos(data);
            if (data.length > 0) {
                setSelectedPlanoId(data[0].id);
            } else {
                setSelectedPlanoId(null);
                setAulas([]);
                setPercepcoesSelecionadas(new Set());
                setShowSugestaoReforco(false);
            }
        } catch (e) {
            console.error('Erro ao carregar planos:', e);
        } finally {
            if (token === lastLoadToken.current) setLoadingPlanos(false);
        }
    }, []);

    const loadPlanoDetails = useCallback(async (planoId: number) => {
        setLoadingAulas(true);
        const token = ++lastLoadToken.current;
        try {
            const allAulas: Aula[] = await api.getPlanoAulas(planoId);
            if (token !== lastLoadToken.current) return;
            setAulas(allAulas);
        } catch (e) {
            console.error('Erro ao carregar detalhes do plano:', e);
        } finally {
            if (token === lastLoadToken.current) setLoadingAulas(false);
        }
    }, []);

    const handleEditPlano = useCallback(async () => {
        if (currentPlano && selectedPlanoId) {
            let fullPlano = currentPlano;
            // Fetch full details if needed (e.g. days)
            try {
                const p = await api.getPlano(selectedPlanoId);
                fullPlano = { ...currentPlano, ...p };
            } catch (e) {
                console.error('Erro ao buscar plano full', e);
            }

            setEditingPlanoData(fullPlano);
            setIsEditing(true);
            setShowNewPlanoModal(true);
        }
    }, [currentPlano, selectedPlanoId]);

    useEffect(() => {
        loadTurmas();
    }, [loadTurmas]);

    useEffect(() => {
        if (selectedTurmaId && selectedTurmaId > 0) {
            loadPlanos(selectedTurmaId);
            setSearchParams(prev => {
                const p = new URLSearchParams(prev);
                p.set('turmaId', String(selectedTurmaId));
                return p;
            });
        }
    }, [selectedTurmaId, loadPlanos, setSearchParams]);

    useEffect(() => {
        if (selectedPlanoId && selectedPlanoId > 0) {
            loadPlanoDetails(selectedPlanoId);
        }
    }, [selectedPlanoId, loadPlanoDetails]);

    const togglePercepcao = useCallback((key: PercepcaoKey) => {
        setPercepcoesSelecionadas(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            const hasDuvida = next.has('duvida');
            setShowSugestaoReforco(hasDuvida);
            return next;
        });
    }, []);

    const handleInserirReforco = useCallback(async () => {
        if (!aulaHoje?.id) return;
        try {
            await api.inserirReforco(aulaHoje.id);
            if (selectedPlanoId) await loadPlanoDetails(selectedPlanoId);
        } catch (e) {
            console.error('Erro ao inserir reforço:', e);
        }
    }, [aulaHoje?.id, selectedPlanoId, loadPlanoDetails]);

    const handleConcluirAula = useCallback(async () => {
        if (!aulaHoje?.id || saving) return;

        setSaving(true);
        try {
            const response = await api.concluirAula(aulaHoje.id, {
                percepcoes: Array.from(percepcoesSelecionadas),
                observacoes: null,
            });

            if (response?.ajustes_feitos?.avaliação_adiada) {
                // Ideal: trocar por toast/modal do app. Mantido simples.
                window.alert(
                    `📢 Inteligência Pedagógica:\nDevido às dúvidas constantes, adiei a '${response.ajustes_feitos.avaliação_adiada}' em 7 dias p/ reforço.`
                );
            }

            setPercepcoesSelecionadas(new Set());
            setShowSugestaoReforco(false);

            if (selectedPlanoId) await loadPlanoDetails(selectedPlanoId);
        } catch (e) {
            console.error('Erro ao concluir aula:', e);
        } finally {
            setSaving(false);
        }
    }, [aulaHoje?.id, percepcoesSelecionadas, selectedPlanoId, loadPlanoDetails, saving]);

    return (
        <div className="planejamento-momento">
            <header className="zona-orientacao pm-container">
                <div className="context-top">
                    <div className="class-info">
                        <select
                            value={selectedTurmaId ?? ''}
                            onChange={(e) => setSelectedTurmaId(Number(e.target.value))}
                            className="minimal-select"
                            aria-label="Selecionar turma"
                            disabled={loadingTurmas || !!searchParams.get('turmaId')}
                        >
                            {turmas.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.nome}
                                </option>
                            ))}
                        </select>

                        <span className="disciplina-tag" title={currentTurma?.disciplina ?? 'Pedagógico'}>
                            {currentTurma?.disciplina || 'Pedagógico'}
                        </span>
                    </div>

                    <div className="date-pill">HOJE, {dataHoje}</div>
                </div>

                <div className="plan-highlights">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h1 className="plan-title">{currentPlano?.titulo || 'Sem Plano Ativo'}</h1>
                        {currentPlano && (
                            <button className="btn-icon-subtle" onClick={handleEditPlano} title="Editar Planejamento">
                                <Pencil size={18} />
                            </button>
                        )}
                    </div>
                    <div className="plan-meta">
                        {loadingPlanos || loadingAulas ? (
                            <span className="meta-item">Carregando…</span>
                        ) : aulaHoje ? (
                            <>
                                <span className="meta-item">
                                    <BookOpen size={14} />
                                    Aula {aulaHoje.ordem}/{currentPlano?.total_aulas ?? '--'}
                                </span>
                                {proximaAula && <span className="meta-item next">Próxima: {proximaAula.titulo}</span>}
                            </>
                        ) : (
                            <span className="meta-item done">Sequência concluída 🎉</span>
                        )}
                    </div>
                </div>

                {currentPlano && (
                    <div className="progress-container" aria-label="Progresso do plano">
                        <div className="progress-bar-bg" role="progressbar" aria-valuenow={currentPlano.progresso} aria-valuemin={0} aria-valuemax={100}>
                            <div className="progress-bar-fill" style={{ width: `${currentPlano.progresso}%` }} />
                        </div>
                        <span className="progress-text">{currentPlano.progresso}%</span>
                    </div>
                )}
            </header>

            <main className="zona-decisao pm-container">
                {aulaHoje ? (
                    <div className="registro-hoje" aria-live="polite">
                        <div className="label-percepcao">
                            Conteúdo: <b>{aulaHoje.titulo}</b>
                        </div>
                        <p className="hint-percepcao">Como foi o clima da turma nesta aula?</p>

                        <div className="chips-grid" role="group" aria-label="Percepções da aula">
                            {PERCEPCOES.map(p => {
                                const active = percepcoesSelecionadas.has(p.key);
                                return (
                                    <button
                                        key={p.key}
                                        type="button"
                                        className="percepcao-chip"
                                        data-active={active ? 'true' : 'false'}
                                        onClick={() => togglePercepcao(p.key)}
                                        aria-pressed={active}
                                        style={active ? ({ backgroundColor: p.color } as React.CSSProperties) : undefined}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                        </div>

                        {showSugestaoReforco && (
                            <div className="intel-alert" role="status">
                                <AlertCircle size={18} />
                                <span>
                                    <b>Sugestão:</b> Inserir reforço agora?
                                </span>
                                <button type="button" onClick={handleInserirReforco}>
                                    Sim
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="empty-plan-state">
                        <CheckCircle2 size={48} color="var(--success-color)" />
                        <h3>Tudo em dia!</h3>
                        <p>Crie um novo planejamento para continuar evoluindo com esta turma.</p>
                        <button type="button" className="btn-create-floating" onClick={() => setShowNewPlanoModal(true)}>
                            <Plus size={20} /> Novo Planejamento
                        </button>
                    </div>
                )}
            </main>

            <section className="zona-sequencia pm-container" aria-label="Sequência didática">
                <h3 className="section-label">SEQUÊNCIA DIDÁTICA</h3>
                <div className="timeline-horizontal">
                    {aulas.map((aula) => (
                        <div
                            key={aula.id}
                            className={`step-bubble ${aula.status} ${aula.id === aulaHoje?.id ? 'active' : ''}`}
                            title={aula.titulo}
                        >
                            <div className="bubble-icon" aria-label={`Aula ${aula.ordem}`}>
                                {aula.status === 'done' ? <CheckCircle2 size={12} /> : <span>{aula.ordem}</span>}
                            </div>
                            <span className="bubble-date">{formatBRShort(aula.scheduled_date)}</span>
                            {aula.id === aulaHoje?.id && <div className="current-marker" />}
                        </div>
                    ))}

                    {planos.length > 0 && (
                        <button type="button" className="btn-add-step" onClick={() => setShowNewPlanoModal(true)} aria-label="Criar novo planejamento">
                            <Plus size={16} />
                        </button>
                    )}
                </div>
            </section>

            <footer className="zona-conclusao">
                <div className="pm-container">
                    {aulaHoje && (
                        <button
                            type="button"
                            className="btn-concluir-momento"
                            onClick={handleConcluirAula}
                            disabled={saving}
                            aria-busy={saving}
                        >
                            {saving ? 'SALVANDO...' : 'CONCLUIR REGISTRO'}
                        </button>
                    )}
                </div>
            </footer>

            {showNewPlanoModal && selectedTurmaId && selectedTurmaId > 0 && (
                <PlanejamentoStudio
                    onClose={() => {
                        setShowNewPlanoModal(false);
                        setIsEditing(false);
                        setEditingPlanoData(null);
                    }}
                    onCreated={() => {
                        setShowNewPlanoModal(false);
                        setIsEditing(false);
                        setEditingPlanoData(null);
                        loadPlanos(selectedTurmaId);
                        if (selectedPlanoId) loadPlanoDetails(selectedPlanoId);
                    }}
                    turmaId={selectedTurmaId}
                    turmaNome={currentTurma?.nome || ''}
                    disciplinaPre={currentTurma?.disciplina || ''}
                    diasSemanaPre={(() => {
                        try {
                            const ds = currentTurma?.dias_semana;
                            if (typeof ds === 'string') return JSON.parse(ds);
                            if (Array.isArray(ds)) return ds;
                        } catch { }
                        return [0, 2, 4]; // fallback
                    })()}
                    planoId={isEditing && editingPlanoData ? editingPlanoData.id : undefined}
                    initialData={isEditing && editingPlanoData ? {
                        titulo: editingPlanoData.titulo,
                        data_inicio: editingPlanoData.data_inicio,
                        dias_semana: editingPlanoData.dias_semana || [],
                        aulas: aulas.map(a => ({
                            titulo: a.titulo,
                            conteudos: a.conteudos || []
                        }))
                    } : undefined}
                />
            )}
        </div>
    );
};
