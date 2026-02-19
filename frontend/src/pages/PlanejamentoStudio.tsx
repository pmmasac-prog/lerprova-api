// PlanejamentoStudio.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save, Plus, Trash2, BookOpen, ChevronRight, GripVertical } from 'lucide-react';
import { api } from '../services/api';
import './PlanejamentoStudio.css';

interface CurriculoItem {
    id: number;
    name: string;
    title?: string;
    order_index?: number;
}

interface TeachingStudioProps {
    onClose: () => void;
    onCreated: () => void;
    turmaId: number;
    turmaNome: string;
    disciplinaPre: string;
    diasSemanaPre: number[]; // Novo: herdado da turma
    planoId?: number; // Optional: for editing
    initialData?: {
        titulo: string;
        data_inicio: string;
        dias_semana: number[];
        aulas: { titulo: string; conteudos?: string[] }[];
    } | null;
}

type PanelKey = 'config' | 'canvas' | 'curriculo';

const DIAS_SEMANA = [
    { id: 0, label: 'Seg' },
    { id: 1, label: 'Ter' },
    { id: 2, label: 'Qua' },
    { id: 3, label: 'Qui' },
    { id: 4, label: 'Sex' },
] as const;

function safeParseISODate(iso: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

// Converte JS getDay() (0=Dom..6=Sáb) para nosso índice (0=Seg..6=Dom)
function jsDayToMon0(jsDay: number): number {
    return (jsDay + 6) % 7;
}

function formatLessonDate(dt: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
    }).format(dt);
}

type Lesson = { id: string; title: string; dateDisplay: string; conteudos: string[] };

export const PlanejamentoStudio: React.FC<TeachingStudioProps> = ({
    onClose,
    onCreated,
    turmaId,
    turmaNome,
    disciplinaPre,
    diasSemanaPre,
    planoId,
    initialData
}) => {
    const [activePanel, setActivePanel] = useState<PanelKey>('canvas');
    const [targetLessonId, setTargetLessonId] = useState<string | null>(null);

    // Config - Init with initialData if present
    const [titulo, setTitulo] = useState(initialData?.titulo || '');
    const [dataInicio, setDataInicio] = useState(() => initialData?.data_inicio ? initialData.data_inicio.slice(0, 10) : new Date().toISOString().slice(0, 10));
    const [diasSemana, setDiasSemana] = useState<number[]>(initialData?.dias_semana || (diasSemanaPre.length > 0 ? diasSemanaPre : [0, 2]));

    // Canvas - Init with initialData
    const [lessons, setLessons] = useState<Lesson[]>(() => {
        if (initialData?.aulas && initialData.aulas.length > 0) {
            return initialData.aulas.map(a => ({
                id: Math.random().toString(36).slice(2, 10),
                title: a.titulo,
                dateDisplay: '', // will be recalc
                conteudos: a.conteudos || []
            }));
        }
        return [{ id: '1', title: '', dateDisplay: '', conteudos: [] }];
    });

    // ... Curriculum State remains ...
    const [subjects, setSubjects] = useState<CurriculoItem[]>([]);
    const [units, setUnits] = useState<CurriculoItem[]>([]);
    const [topics, setTopics] = useState<CurriculoItem[]>([]);
    const [selectedSub, setSelectedSub] = useState<number | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<number | null>(null); // Novo: para sugestões

    // Base Curricular Estática (V4)
    const [methodologies, setMethodologies] = useState<CurriculoItem[]>([]);
    const [resources, setResources] = useState<CurriculoItem[]>([]);
    const [suggestedMeths, setSuggestedMeths] = useState<number[]>([]);
    const [suggestedRes, setSuggestedRes] = useState<number[]>([]);

    const [saving, setSaving] = useState(false);
    const loadToken = useRef(0);

    // Load Subjects (with Filter)
    useEffect(() => {
        const token = ++loadToken.current;
        api.getCurriculoSubjects()
            .then((data: CurriculoItem[]) => {
                if (token !== loadToken.current) return;

                // Filter by disciplinaPre if provided (Strict Mode)
                let filtered = data;
                if (disciplinaPre) {
                    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const target = normalize(disciplinaPre);
                    filtered = data.filter(s => normalize(s.name).includes(target) || target.includes(normalize(s.name)));
                }

                setSubjects(filtered);

                const exact = filtered.find(s => s.name === disciplinaPre);
                if (exact) {
                    setSelectedSub(exact.id);
                } else if (filtered.length === 1) {
                    setSelectedSub(filtered[0].id);
                }
            })
            .catch((e: unknown) => console.error(e));
    }, [disciplinaPre]);

    // Load Units
    useEffect(() => {
        if (!selectedSub) return;

        const token = ++loadToken.current;
        api.getCurriculoUnits(selectedSub)
            .then((data: CurriculoItem[]) => {
                if (token !== loadToken.current) return;
                setUnits(data);
                setTopics([]);
                setSelectedUnit(null);
            })
            .catch((e: unknown) => console.error(e));
    }, [selectedSub, subjects]);

    // Load Topics
    useEffect(() => {
        if (!selectedUnit) return;

        const token = ++loadToken.current;
        api.getCurriculoTopics(selectedUnit)
            .then((data: CurriculoItem[]) => {
                if (token !== loadToken.current) return;
                setTopics(data);
            })
            .catch((e: unknown) => console.error(e));
    }, [selectedUnit]);

    // Carregar Metodologias e Recursos Base
    useEffect(() => {
        api.getCurriculoMethodologies().then(setMethodologies).catch(console.error);
        api.getCurriculoResources().then(setResources).catch(console.error);
    }, []);

    // Carregar Sugestões quando tópico é selecionado
    useEffect(() => {
        if (!selectedTopic) {
            setSuggestedMeths([]);
            setSuggestedRes([]);
            return;
        }
        api.getCurriculoSuggestions(selectedTopic)
            .then((data: { methodologies: any[], resources: any[] }) => {
                setSuggestedMeths(data.methodologies.map(m => m.id));
                setSuggestedRes(data.resources.map(r => r.id));
            })
            .catch(console.error);
    }, [selectedTopic]);

    const reconcileDates = useCallback((baseISO: string, days: number[], ls: Lesson[]): Lesson[] => {
        if (days.length === 0) return ls.map(l => ({ ...l, dateDisplay: '' }));
        const base = safeParseISODate(baseISO);
        if (!base) return ls.map(l => ({ ...l, dateDisplay: '' }));

        const allowed = new Set(days);
        let cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate());

        let guard = 0;
        while (!allowed.has(jsDayToMon0(cursor.getDay())) && guard < 14) {
            cursor.setDate(cursor.getDate() + 1);
            guard++;
        }

        const out: Lesson[] = ls.map((lesson, idx) => {
            if (idx === 0) {
                return { ...lesson, dateDisplay: formatLessonDate(cursor) };
            }
            let g = 0;
            do {
                cursor.setDate(cursor.getDate() + 1);
                g++;
            } while (!allowed.has(jsDayToMon0(cursor.getDay())) && g < 14);

            return { ...lesson, dateDisplay: formatLessonDate(cursor) };
        });

        return out;
    }, []);

    // Recalculate Dates
    useEffect(() => {
        setLessons(prev => reconcileDates(dataInicio, diasSemana, prev));
    }, [dataInicio, diasSemana, reconcileDates]);

    const toggleDay = useCallback((dayId: number) => {
        setDiasSemana(prev => {
            const next = prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId];
            return next.sort((a, b) => a - b);
        });
    }, []);

    const addLesson = useCallback((title = '') => {
        setLessons(prev => {
            const next: Lesson[] = [
                ...prev,
                { id: Math.random().toString(36).slice(2, 10), title, dateDisplay: '', conteudos: [] },
            ];
            return reconcileDates(dataInicio, diasSemana, next);
        });
        setActivePanel('canvas');
        setTargetLessonId(null);
    }, [dataInicio, diasSemana, reconcileDates]);

    const removeLesson = useCallback((index: number) => {
        setLessons(prev => {
            const next = prev.slice();
            next.splice(index, 1);
            const safe = next.length === 0 ? [{ id: '1', title: '', dateDisplay: '', conteudos: [] }] : next;
            return reconcileDates(dataInicio, diasSemana, safe);
        });
    }, [dataInicio, diasSemana, reconcileDates]);

    const updateLesson = useCallback((index: number, title: string) => {
        setLessons(prev => {
            const next = prev.map((l, i) => (i === index ? { ...l, title } : l));
            return next;
        });
    }, []);

    const handleAddTopic = useCallback((topic: CurriculoItem) => {
        setSelectedTopic(topic.id); // Ativa carregamento de sugestões

        if (targetLessonId) {
            setLessons(prev => prev.map(l => {
                if (l.id === targetLessonId) {
                    return { ...l, title: l.title || topic.name };
                }
                return l;
            }));
        } else {
            addLesson(topic.name);
        }
    }, [targetLessonId, addLesson]);

    const handleAddComplement = useCallback((name: string) => {
        if (!targetLessonId) return;
        setLessons(prev => prev.map(l => {
            if (l.id === targetLessonId) {
                const current = l.conteudos || [];
                if (current.includes(name)) return l;
                return { ...l, conteudos: [...current, name] };
            }
            return l;
        }));
    }, [targetLessonId]);

    const requestContentFor = useCallback((lessonId: string) => {
        setTargetLessonId(lessonId);
        setActivePanel('curriculo');
    }, []);

    const removeContent = useCallback((lessonId: string, contentIndex: number) => {
        setLessons(prev => prev.map(l => {
            if (l.id === lessonId) {
                const newC = [...(l.conteudos || [])];
                newC.splice(contentIndex, 1);
                return { ...l, conteudos: newC };
            }
            return l;
        }));
    }, []);

    const validLessons = useMemo(() => {
        return lessons
            .filter(l => l.title.trim() || (l.conteudos && l.conteudos.length > 0))
            .map((t, i) => ({
                ordem: i + 1,
                titulo: t.title || t.conteudos[0] || 'Aula sem título',
                conteudos: t.conteudos
            }));
    }, [lessons]);

    const canSave = useMemo(() => {
        return titulo.trim().length > 0 && validLessons.length > 0 && !saving;
    }, [titulo, validLessons.length, saving]);

    const handleSave = useCallback(async () => {
        if (!canSave) return;

        setSaving(true);
        try {
            if (planoId) {
                await api.updatePlano(planoId, {
                    titulo: titulo.trim(),
                    disciplina: disciplinaPre,
                    aulas: validLessons,
                    dias_semana: diasSemana
                });
            } else {
                await api.createPlano({
                    turma_id: turmaId,
                    titulo: titulo.trim(),
                    disciplina: disciplinaPre,
                    data_inicio: dataInicio,
                    aulas: validLessons,
                    dias_semana: diasSemana,
                });
            }
            onCreated();
        } catch (e) {
            console.error(e);
            window.alert('Erro ao salvar planejamento');
        } finally {
            setSaving(false);
        }
    }, [canSave, turmaId, titulo, disciplinaPre, dataInicio, validLessons, diasSemana, onCreated, planoId]);

    return (
        <div className="studio-container" role="dialog" aria-modal="true" aria-label="Editor de planejamento">
            <header className="studio-header">
                <div className="studio-title">
                    <BookOpen size={20} color="#3b82f6" />
                    Planejamento: {turmaNome}
                </div>

                <div className="studio-tabs" role="tablist" aria-label="Navegação do editor">
                    <button
                        type="button"
                        className="studio-tab"
                        data-active={activePanel === 'config' ? 'true' : 'false'}
                        onClick={() => setActivePanel('config')}
                        role="tab"
                        aria-selected={activePanel === 'config'}
                    >
                        Config
                    </button>
                    <button
                        type="button"
                        className="studio-tab"
                        data-active={activePanel === 'canvas' ? 'true' : 'false'}
                        onClick={() => setActivePanel('canvas')}
                        role="tab"
                        aria-selected={activePanel === 'canvas'}
                    >
                        Sequência
                    </button>
                    <button
                        type="button"
                        className="studio-tab"
                        data-active={activePanel === 'curriculo' ? 'true' : 'false'}
                        onClick={() => setActivePanel('curriculo')}
                        role="tab"
                        aria-selected={activePanel === 'curriculo'}
                    >
                        Currículo
                    </button>
                </div>

                <div className="studio-actions">
                    <button type="button" className="btn-studio cancel" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="button" className="btn-studio save" onClick={handleSave} disabled={!canSave} aria-busy={saving}>
                        <Save size={16} />
                        Publicar
                    </button>
                </div>
            </header>

            <div className="studio-grid">
                <div className="studio-panel left" data-visible={activePanel === 'config' ? 'true' : 'false'}>
                    <div className="panel-title">Configurações Gerais</div>

                    <div className="studio-input-group">
                        <label className="studio-label" htmlFor="ps-titulo">Título da Sequência</label>
                        <input
                            id="ps-titulo"
                            type="text"
                            className="studio-input"
                            placeholder="Ex: Geometria Espacial"
                            value={titulo}
                            onChange={e => setTitulo(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="studio-input-group">
                        <label className="studio-label">Disciplina</label>
                        <div className="studio-input" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                            {disciplinaPre || 'Geral'}
                        </div>
                    </div>

                    <div className="studio-input-group">
                        <label className="studio-label" htmlFor="ps-data">Início das Aulas</label>
                        <input
                            id="ps-data"
                            type="date"
                            className="studio-input"
                            value={dataInicio}
                            onChange={e => setDataInicio(e.target.value)}
                        />
                    </div>

                    <div className="studio-input-group" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                        <label className="studio-label">Dias de Aula (Herdados da Turma)</label>
                        <div className="weekday-visual">
                            {DIAS_SEMANA.map(day => (
                                <button
                                    key={day.id}
                                    type="button"
                                    className={`weekday-btn ${diasSemana.includes(day.id) ? 'active' : ''}`}
                                    onClick={() => toggleDay(day.id)}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="studio-panel center" data-visible={activePanel === 'canvas' ? 'true' : 'false'}>
                    <div className="timeline-canvas">
                        {lessons.map((lesson, index) => (
                            <div key={lesson.id} className="lesson-card">
                                <div className="card-header">
                                    <span className="card-order">AULA {index + 1}</span>
                                    <span className="card-date">{lesson.dateDisplay}</span>
                                </div>

                                <div className="lesson-row">
                                    <span className="drag-hint" aria-hidden="true" title="Reordenar (futuro)">
                                        <GripVertical size={16} />
                                    </span>

                                    <input
                                        type="text"
                                        className="card-input"
                                        placeholder="O que será ensinado?"
                                        value={lesson.title}
                                        onChange={e => updateLesson(index, e.target.value)}
                                        aria-label={`Título da aula ${index + 1}`}
                                    />

                                    <button
                                        type="button"
                                        className="btn-remove-aula"
                                        onClick={() => removeLesson(index)}
                                        aria-label={`Remover aula ${index + 1}`}
                                        disabled={lessons.length === 1}
                                        title={lessons.length === 1 ? 'Mantenha pelo menos 1 aula' : 'Remover'}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="lesson-contents">
                                    {lesson.conteudos?.map((c, i) => (
                                        <div key={i} className="content-tag">
                                            <span>{c}</span>
                                            <button
                                                className="btn-remove-content"
                                                onClick={() => removeContent(lesson.id, i)}
                                                type="button"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        className="btn-add-content-small"
                                        onClick={() => requestContentFor(lesson.id)}
                                        type="button"
                                    >
                                        + Conteúdo
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button type="button" className="btn-add-lesson" onClick={() => addLesson()}>
                            <Plus size={18} /> Adicionar Aula
                        </button>
                    </div>
                </div>

                <div className="studio-panel right" data-visible={activePanel === 'curriculo' ? 'true' : 'false'}>
                    <div className="curriculum-header">
                        <select
                            className="studio-input"
                            onChange={e => setSelectedSub(e.target.value ? Number(e.target.value) : null)}
                            value={selectedSub ?? ''}
                            aria-label="Selecionar disciplina do currículo"
                        >
                            <option value="">Selecione a Disciplina…</option>
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="curriculum-content">
                        {selectedSub && !selectedUnit && (
                            <>
                                <div className="curr-hint">Selecione uma Unidade:</div>
                                {units.map(u => (
                                    <div key={u.id} className="curr-item" onClick={() => setSelectedUnit(u.id)} role="button" tabIndex={0}>
                                        <ChevronRight size={14} />
                                        {u.title}
                                    </div>
                                ))}
                            </>
                        )}

                        {selectedUnit && (
                            <>
                                <button
                                    type="button"
                                    className="btn-studio cancel"
                                    style={{ width: '100%', marginBottom: 10 }}
                                    onClick={() => setSelectedUnit(null)}
                                >
                                    ← Voltar para Unidades
                                </button>

                                <div style={{ padding: 2 }}>
                                    {topics.map(t => (
                                        <div key={t.id} style={{ marginBottom: 16 }}>
                                            <div className="curr-topic" style={{ background: selectedTopic === t.id ? 'rgba(59, 130, 246, 0.1)' : undefined }}>
                                                <span onClick={() => setSelectedTopic(t.id)} style={{ cursor: 'pointer', flex: 1 }}>{t.name}</span>
                                                <button
                                                    type="button"
                                                    className="btn-add-topic"
                                                    onClick={() => handleAddTopic(t)}
                                                    aria-label={targetLessonId ? "Selecionar este tópico" : "Criar aula com este tópico"}
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>

                                            {selectedTopic === t.id && (
                                                <div className="topic-complements" style={{ paddingLeft: 12, marginTop: 8 }}>
                                                    {/* Metodologias */}
                                                    <div className="complement-section">
                                                        <div className="curr-hint" style={{ fontSize: 10, opacity: 0.8 }}>METODOLOGIAS SUGERIDAS</div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                                            {methodologies.filter(m => suggestedMeths.includes(m.id)).map(m => (
                                                                <button key={m.id} className="btn-complement suggested" onClick={() => handleAddComplement(m.name)}>
                                                                    {m.name}
                                                                </button>
                                                            ))}
                                                            <select
                                                                className="studio-input"
                                                                style={{ fontSize: 10, height: 24, padding: '0 4px', width: 'auto' }}
                                                                onChange={(e) => { if (e.target.value) handleAddComplement(e.target.value); e.target.value = ''; }}
                                                            >
                                                                <option value="">Outras...</option>
                                                                {methodologies.filter(m => !suggestedMeths.includes(m.id)).map(m => (
                                                                    <option key={m.id} value={m.name}>{m.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Recursos */}
                                                    <div className="complement-section" style={{ marginTop: 12 }}>
                                                        <div className="curr-hint" style={{ fontSize: 10, opacity: 0.8 }}>RECURSOS SUGERIDOS</div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                                            {resources.filter(r => suggestedRes.includes(r.id)).map(r => (
                                                                <button key={r.id} className="btn-complement suggested" onClick={() => handleAddComplement(r.name)}>
                                                                    {r.name}
                                                                </button>
                                                            ))}
                                                            <select
                                                                className="studio-input"
                                                                style={{ fontSize: 10, height: 24, padding: '0 4px', width: 'auto' }}
                                                                onChange={(e) => { if (e.target.value) handleAddComplement(e.target.value); e.target.value = ''; }}
                                                            >
                                                                <option value="">Outros...</option>
                                                                {resources.filter(r => !suggestedRes.includes(r.id)).map(r => (
                                                                    <option key={r.id} value={r.name}>{r.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
