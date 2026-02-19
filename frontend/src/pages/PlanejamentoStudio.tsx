// PlanejamentoStudio.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Plus, Trash2, BookOpen, ChevronRight, GripVertical, Target, Search, X } from 'lucide-react';
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
    diasSemanaPre: number[];
    planoId?: number;
    initialData?: {
        titulo: string;
        data_inicio: string;
        dias_semana: number[];
        aulas: { titulo: string; metodologia_recurso?: string[]; bncc_skills?: string[] }[];
    } | null;
}

type PanelKey = 'config' | 'canvas' | 'curriculo' | 'bncc';

function safeParseISODate(iso: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

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

type Lesson = { id: string; title: string; dateDisplay: string; metodologia_recurso: string[]; bncc_skills: string[] };

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

    // Config
    const [titulo, setTitulo] = useState(initialData?.titulo || '');
    const [dataInicio, setDataInicio] = useState(() => initialData?.data_inicio ? initialData.data_inicio.slice(0, 10) : new Date().toISOString().slice(0, 10));
    const [diasSemana] = useState<number[]>(initialData?.dias_semana || (diasSemanaPre.length > 0 ? diasSemanaPre : [0, 2, 4]));

    // Canvas
    const [lessons, setLessons] = useState<Lesson[]>(() => {
        if (initialData?.aulas && initialData.aulas.length > 0) {
            return initialData.aulas.map(a => ({
                id: Math.random().toString(36).slice(2, 10),
                title: a.titulo,
                dateDisplay: '',
                metodologia_recurso: a.metodologia_recurso || [],
                bncc_skills: a.bncc_skills || []
            }));
        }
        return [{ id: Math.random().toString(36).slice(2, 10), title: '', dateDisplay: '', metodologia_recurso: [], bncc_skills: [] }];
    });

    const [subjects, setSubjects] = useState<CurriculoItem[]>([]);
    const [units, setUnits] = useState<CurriculoItem[]>([]);
    const [topics, setTopics] = useState<CurriculoItem[]>([]);
    const [selectedSub, setSelectedSub] = useState<number | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<number | null>(null);

    // BNCC State
    const [bnccSearch, setBnccSearch] = useState('');
    const [bnccResults, setBnccResults] = useState<any[]>([]);
    const [searchingBncc, setSearchingBncc] = useState(false);

    const [methodologies, setMethodologies] = useState<CurriculoItem[]>([]);
    const [resources, setResources] = useState<CurriculoItem[]>([]);
    const [suggestedMeths, setSuggestedMeths] = useState<number[]>([]);
    const [suggestedRes, setSuggestedRes] = useState<number[]>([]);

    const [saving, setSaving] = useState(false);
    const loadToken = useRef(0);

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

    // Load Subjects
    useEffect(() => {
        const token = ++loadToken.current;
        api.getCurriculoSubjects()
            .then((data: CurriculoItem[]) => {
                if (token !== loadToken.current) return;
                let filtered = data;
                if (disciplinaPre) {
                    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const target = normalize(disciplinaPre);
                    filtered = data.filter(s => normalize(s.name).includes(target) || target.includes(normalize(s.name)));
                }
                setSubjects(filtered);
                if (filtered.length === 1) setSelectedSub(filtered[0].id);
            });
    }, [disciplinaPre]);

    useEffect(() => {
        if (!selectedSub) return;
        api.getCurriculoUnits(selectedSub).then(setUnits);
    }, [selectedSub]);

    useEffect(() => {
        if (!selectedUnit) return;
        api.getCurriculoTopics(selectedUnit).then(setTopics);
    }, [selectedUnit]);

    useEffect(() => {
        api.getCurriculoMethodologies().then(setMethodologies);
        api.getCurriculoResources().then(setResources);
    }, []);

    useEffect(() => {
        if (!selectedTopic) {
            setSuggestedMeths([]);
            setSuggestedRes([]);
            return;
        }
        api.getCurriculoSuggestions(selectedTopic).then((data: any) => {
            setSuggestedMeths(data.methodologies.map((m: any) => m.id));
            setSuggestedRes(data.resources.map((r: any) => r.id));
        });
    }, [selectedTopic]);

    // BNCC Search Effect
    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (bnccSearch.trim().length < 2) {
                setBnccResults([]);
                return;
            }
            setSearchingBncc(true);
            try {
                const res = await api.searchBNCCSkills(bnccSearch);
                setBnccResults(res);
            } catch (e) {
                console.error(e);
            } finally {
                setSearchingBncc(false);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [bnccSearch]);

    // Auto-select target lesson if null and panel changes
    useEffect(() => {
        if ((activePanel === 'bncc' || activePanel === 'curriculo') && !targetLessonId && lessons.length > 0) {
            setTargetLessonId(lessons[0].id);
        }
    }, [activePanel, targetLessonId, lessons]);

    // Reconcile dates 
    useEffect(() => {
        setLessons(prev => reconcileDates(dataInicio, diasSemana, prev));
    }, [dataInicio, diasSemana, reconcileDates]);

    const addLesson = useCallback((title = '') => {
        setLessons(prev => {
            const next: Lesson[] = [
                ...prev,
                { id: Math.random().toString(36).slice(2, 10), title, dateDisplay: '', metodologia_recurso: [], bncc_skills: [] },
            ];
            return reconcileDates(dataInicio, diasSemana, next);
        });
        setActivePanel('canvas');
    }, [dataInicio, diasSemana, reconcileDates]);

    const removeLesson = useCallback((index: number) => {
        setLessons(prev => {
            if (prev.length <= 1) return prev;
            const next = [...prev];
            next.splice(index, 1);
            return reconcileDates(dataInicio, diasSemana, next);
        });
    }, [dataInicio, diasSemana, reconcileDates]);

    const updateLesson = (index: number, title: string) => {
        setLessons(prev => prev.map((l, i) => (i === index ? { ...l, title } : l)));
    };

    const handleAddBNCC = (code: string) => {
        if (!targetLessonId) return;
        setLessons(prev => prev.map(l => {
            if (l.id !== targetLessonId) return l;
            const current = l.bncc_skills || [];
            if (current.includes(code)) return l;
            return { ...l, bncc_skills: [...current, code] };
        }));
    };

    const handleAddComplement = (name: string) => {
        if (!targetLessonId) return;
        setLessons(prev => prev.map(l => {
            if (l.id !== targetLessonId) return l;
            const current = l.metodologia_recurso || [];
            if (current.includes(name)) return l;
            return { ...l, metodologia_recurso: [...current, name] };
        }));
    };

    // Drag and Drop Logic
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggingIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Add a class for styling
        (e.target as HTMLElement).classList.add('is-dragging');
    };

    const onDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggingIndex === null || draggingIndex === index) return;

        setLessons(prev => {
            const next = [...prev];
            const [moved] = next.splice(draggingIndex, 1);
            next.splice(index, 0, moved);
            return reconcileDates(dataInicio, diasSemana, next);
        });
        setDraggingIndex(index);
    };

    const onDragEnd = (e: React.DragEvent) => {
        setDraggingIndex(null);
        (e.target as HTMLElement).classList.remove('is-dragging');
    };

    const handleSave = async () => {
        if (titulo.trim().length === 0 || saving) return;
        setSaving(true);
        try {
            const valid = lessons.filter(l => l.title.trim() || l.metodologia_recurso.length > 0 || l.bncc_skills.length > 0)
                .map((t, i) => ({
                    ordem: i + 1,
                    titulo: t.title || 'Aula sem título',
                    metodologia_recurso: t.metodologia_recurso,
                    bncc_skills: t.bncc_skills
                }));

            const data = {
                turma_id: turmaId,
                titulo: titulo.trim(),
                disciplina: disciplinaPre,
                data_inicio: dataInicio,
                aulas: valid,
                dias_semana: diasSemana
            };
            if (planoId) await api.updatePlano(planoId, data);
            else await api.createPlano(data);
            onCreated();
        } catch (e) {
            console.error(e);
            window.alert('Erro ao salvar planejamento');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="studio-container">
            <header className="studio-header">
                <div className="studio-title"><BookOpen size={20} color="#3b82f6" /> Studio: {turmaNome}</div>
                <div className="studio-tabs">
                    <button className="studio-tab" data-active={activePanel === 'config'} onClick={() => setActivePanel('config')}>Config</button>
                    <button className="studio-tab" data-active={activePanel === 'canvas'} onClick={() => setActivePanel('canvas')}>Sequência</button>
                    <button className="studio-tab" data-active={activePanel === 'curriculo'} onClick={() => setActivePanel('curriculo')}>Currículo</button>
                    <button className="studio-tab" data-active={activePanel === 'bncc'} onClick={() => setActivePanel('bncc')}>BNCC</button>
                </div>
                <div className="studio-actions">
                    <button className="btn-studio cancel" onClick={onClose}>Sair</button>
                    <button className="btn-studio save" onClick={handleSave} disabled={saving || !titulo.trim()}>
                        {saving ? '...' : <><Save size={16} /> Publicar</>}
                    </button>
                </div>
            </header>

            <div className="studio-grid">
                <div className="studio-panel left" data-visible={activePanel === 'config'}>
                    <div className="panel-title">Configurações</div>
                    <div className="studio-input-group">
                        <label className="studio-label">Título</label>
                        <input className="studio-input" value={titulo} onChange={e => setTitulo(e.target.value)} />
                    </div>
                    <div className="studio-input-group">
                        <label className="studio-label">Início</label>
                        <input type="date" className="studio-input" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                    </div>
                </div>

                <div className="studio-panel center" data-visible={activePanel === 'canvas'}>
                    <div className="timeline-canvas">
                        {lessons.map((lesson, index) => (
                            <div
                                key={lesson.id}
                                className={`lesson-card ${draggingIndex === index ? 'is-dragging' : ''} ${targetLessonId === lesson.id ? 'active-target' : ''}`}
                                draggable
                                onDragStart={(e) => onDragStart(e, index)}
                                onDragOver={(e) => onDragOver(e, index)}
                                onDragEnd={onDragEnd}
                                onClick={() => setTargetLessonId(lesson.id)}
                            >
                                <div className="card-header">
                                    <span className="card-order">AULA {index + 1}</span>
                                    <span className="card-date">{lesson.dateDisplay}</span>
                                </div>
                                <div className="lesson-row">
                                    <GripVertical size={16} className="drag-handle" />
                                    <input className="card-input" value={lesson.title} onChange={e => updateLesson(index, e.target.value)} placeholder="Título da aula..." />
                                    <button className="btn-remove-aula" onClick={() => removeLesson(index)} disabled={lessons.length === 1}><Trash2 size={16} /></button>
                                </div>
                                <div className="lesson-contents">
                                    {lesson.bncc_skills.map(s => (
                                        <div key={s} className="bncc-tag"><Target size={12} /> {s} <X size={12} onClick={() => setLessons(ls => ls.map(x => x.id === lesson.id ? { ...x, bncc_skills: x.bncc_skills.filter(y => y !== s) } : x))} /></div>
                                    ))}
                                    {lesson.metodologia_recurso.map(m => (
                                        <div key={m} className="content-tag">{m} <X size={12} onClick={() => setLessons(ls => ls.map(x => x.id === lesson.id ? { ...x, metodologia_recurso: x.metodologia_recurso.filter(y => y !== m) } : x))} /></div>
                                    ))}
                                    <button className="btn-add-content-small" onClick={(e) => { e.stopPropagation(); setTargetLessonId(lesson.id); setActivePanel('curriculo'); }}>+ Met/Rec</button>
                                    <button className="btn-add-bncc-small" onClick={(e) => { e.stopPropagation(); setTargetLessonId(lesson.id); setActivePanel('bncc'); }}>+ BNCC</button>
                                </div>
                            </div>
                        ))}
                        <button className="btn-add-lesson" onClick={() => addLesson()}><Plus size={18} /> Adicionar Aula</button>
                    </div>
                </div>

                <div className="studio-panel right" data-visible={activePanel === 'curriculo'}>
                    <div className="panel-header">
                        <select className="studio-input" value={selectedSub ?? ''} onChange={e => setSelectedSub(Number(e.target.value))}>
                            <option value="">Disciplina...</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="panel-content">
                        {targetLessonId && <div className="target-hint">Alvo: Aula {lessons.findIndex(l => l.id === targetLessonId) + 1}</div>}
                        {!selectedUnit && units.map(u => <div key={u.id} className="curr-item" onClick={() => setSelectedUnit(u.id)}><ChevronRight size={14} /> {u.title}</div>)}
                        {selectedUnit && (
                            <>
                                <button className="btn-back" onClick={() => setSelectedUnit(null)}>← Unidades</button>
                                {topics.map(t => (
                                    <div key={t.id} className="topic-box">
                                        <div className="topic-header" onClick={() => setSelectedTopic(t.id)}><span>{t.name}</span> <Plus size={16} onClick={(e) => { e.stopPropagation(); addLesson(t.name); }} /></div>
                                        {selectedTopic === t.id && (
                                            <div className="suggestions">
                                                {methodologies.filter(m => suggestedMeths.includes(m.id)).map(m => <button key={m.id} className="suggest-btn" onClick={() => handleAddComplement(m.name)}>{m.name}</button>)}
                                                {resources.filter(r => suggestedRes.includes(r.id)).map(r => <button key={r.id} className="suggest-btn" onClick={() => handleAddComplement(r.name)}>{r.name}</button>)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                <div className="studio-panel right" data-visible={activePanel === 'bncc'}>
                    <div className="panel-header">
                        <div className="search-box"><Search size={16} /><input placeholder="Habilidade/Código..." value={bnccSearch} onChange={e => setBnccSearch(e.target.value)} /></div>
                    </div>
                    <div className="panel-content">
                        {targetLessonId && <div className="target-hint">Vinculando à Aula {lessons.findIndex(l => l.id === targetLessonId) + 1}</div>}
                        {searchingBncc && <div className="loading">Buscando...</div>}
                        {!searchingBncc && bnccSearch.trim().length >= 2 && bnccResults.length === 0 && <div className="loading">Nenhuma habilidade encontrada.</div>}
                        {!searchingBncc && bnccResults.map(s => (
                            <div key={s.id} className="bncc-item" onClick={() => handleAddBNCC(s.code)}><strong>{s.code}</strong><p>{s.description}</p></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
