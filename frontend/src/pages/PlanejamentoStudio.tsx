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

// ... (imports remain)

// ...

type Lesson = { id: string; title: string; dateDisplay: string; conteudos: string[] };

export const PlanejamentoStudio: React.FC<TeachingStudioProps> = ({
    onClose,
    onCreated,
    turmaId,
    turmaNome,
    disciplinaPre,
}) => {
    const [activePanel, setActivePanel] = useState<PanelKey>('canvas');
    const [targetLessonId, setTargetLessonId] = useState<string | null>(null); // NEW: Track which lesson wants content

    // ... (Config state remains)
    const [titulo, setTitulo] = useState('');
    const [disciplina, setDisciplina] = useState(disciplinaPre);
    const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
    const [diasSemana, setDiasSemana] = useState<number[]>([0, 2]);

    // Canvas
    const [lessons, setLessons] = useState<Lesson[]>([{ id: '1', title: '', dateDisplay: '', conteudos: [] }]);

    // ... (Curriculum state remains)
    const [subjects, setSubjects] = useState<CurriculoItem[]>([]);
    const [units, setUnits] = useState<CurriculoItem[]>([]);
    const [topics, setTopics] = useState<CurriculoItem[]>([]);
    const [selectedSub, setSelectedSub] = useState<number | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<number | null>(null);

    const [saving, setSaving] = useState(false);
    const loadToken = useRef(0);

    // Load Subjects
    useEffect(() => {
        const token = ++loadToken.current;
        api.getCurriculoSubjects()
            .then((data: CurriculoItem[]) => {
                if (token !== loadToken.current) return;
                setSubjects(data);
            })
            .catch((e: unknown) => console.error(e));
    }, []);

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

                const sub = subjects.find(s => s.id === selectedSub);
                if (sub?.name) setDisciplina(sub.name);
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

    const reconcileDates = useCallback((baseISO: string, days: number[], ls: Lesson[]): Lesson[] => {
        if (days.length === 0) return ls.map(l => ({ ...l, dateDisplay: '' }));
        const base = safeParseISODate(baseISO);
        if (!base) return ls.map(l => ({ ...l, dateDisplay: '' }));

        const allowed = new Set(days); // 0=Seg..4=Sex (mas nosso conversor vai gerar 0..6)
        let cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate());

        // achar primeiro dia válido
        let guard = 0;
        while (!allowed.has(jsDayToMon0(cursor.getDay())) && guard < 14) {
            cursor.setDate(cursor.getDate() + 1);
            guard++;
        }

        const out: Lesson[] = ls.map((lesson, idx) => {
            if (idx === 0) {
                return { ...lesson, dateDisplay: formatLessonDate(cursor) };
            }
            // avançar até próximo dia válido
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

    const handleAddTopic = useCallback((topicName: string) => {
        if (targetLessonId) {
            // Add to specific lesson
            setLessons(prev => prev.map(l => {
                if (l.id === targetLessonId) {
                    return { ...l, conteudos: [...(l.conteudos || []), topicName] };
                }
                return l;
            }));
            setActivePanel('canvas'); // Go back to canvas
            setTargetLessonId(null); // Clear target
        } else {
            // Create new lesson with this topic as title
            addLesson(topicName);
        }
    }, [targetLessonId, addLesson]);

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
                conteudos: t.conteudos // Pass this to backend if supported, or just use title
            }));
    }, [lessons]);

    const canSave = useMemo(() => {
        return titulo.trim().length > 0 && validLessons.length > 0 && diasSemana.length > 0 && !saving;
    }, [titulo, validLessons.length, diasSemana.length, saving]);

    const handleSave = useCallback(async () => {
        if (!canSave) return;

        setSaving(true);
        try {
            await api.createPlano({
                turma_id: turmaId,
                titulo: titulo.trim(),
                disciplina: disciplina.trim() || disciplinaPre,
                data_inicio: dataInicio,
                aulas: validLessons,
                dias_semana: diasSemana, // mantém 0=Seg..4=Sex como você já usa
            });
            onCreated();
        } catch (e) {
            console.error(e);
            window.alert('Erro ao salvar planejamento');
        } finally {
            setSaving(false);
        }
    }, [canSave, turmaId, titulo, disciplina, disciplinaPre, dataInicio, validLessons, diasSemana, onCreated]);

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
                        <label className="studio-label" htmlFor="ps-disciplina">Disciplina</label>
                        <input
                            id="ps-disciplina"
                            type="text"
                            className="studio-input"
                            value={disciplina}
                            onChange={e => setDisciplina(e.target.value)}
                        />
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

                    <div className="studio-input-group">
                        <label className="studio-label">Dias de Aula (Semanal)</label>
                        <div className="weekday-visual" role="group" aria-label="Selecionar dias da semana">
                            {DIAS_SEMANA.map(day => (
                                <button
                                    key={day.id}
                                    type="button"
                                    className={`weekday-btn ${diasSemana.includes(day.id) ? 'active' : ''}`}
                                    onClick={() => toggleDay(day.id)}
                                    aria-pressed={diasSemana.includes(day.id)}
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
                                        <div key={t.id} className="curr-topic">
                                            <span>{t.name}</span>
                                            <button
                                                type="button"
                                                className="btn-add-topic"
                                                onClick={() => handleAddTopic(t.name)}
                                                aria-label={targetLessonId ? "Adicionar à aula selecionada" : "Criar aula com este tópico"}
                                            >
                                                <Plus size={16} />
                                            </button>
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
