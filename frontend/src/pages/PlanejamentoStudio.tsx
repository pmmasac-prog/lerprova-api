import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, BookOpen, ChevronRight, GripVertical } from 'lucide-react';
import { api } from '../services/api';
import './PlanejamentoStudio.css';

interface CurriculoItem { id: number; name: string; title?: string; order_index?: number; }

interface TeachingStudioProps {
    onClose: () => void;
    onCreated: () => void;
    turmaId: number;
    turmaNome: string;
    disciplinaPre: string;
}

const DIAS_SEMANA = [
    { id: 0, label: 'Seg' },
    { id: 1, label: 'Ter' },
    { id: 2, label: 'Qua' },
    { id: 3, label: 'Qui' },
    { id: 4, label: 'Sex' }
];

export const PlanejamentoStudio: React.FC<TeachingStudioProps> = ({ onClose, onCreated, turmaId, turmaNome, disciplinaPre }) => {
    // STATE: Config
    const [titulo, setTitulo] = useState('');
    const [disciplina, setDisciplina] = useState(disciplinaPre);
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [diasSemana, setDiasSemana] = useState<number[]>([0, 2]); // Seg, Qua default

    // STATE: Canvas
    const [lessons, setLessons] = useState<{ id: string, title: string, dateDisplay: string }[]>([
        { id: '1', title: '', dateDisplay: '' }
    ]);

    // STATE: Curriculum
    const [subjects, setSubjects] = useState<CurriculoItem[]>([]);
    const [units, setUnits] = useState<CurriculoItem[]>([]);
    const [topics, setTopics] = useState<CurriculoItem[]>([]);
    const [selectedSub, setSelectedSub] = useState<number | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<number | null>(null);

    // EFFECT: Load Subjects
    useEffect(() => {
        api.getCurriculoSubjects().then(setSubjects);
    }, []);

    // EFFECT: Load Units
    useEffect(() => {
        if (selectedSub) {
            api.getCurriculoUnits(selectedSub).then(setUnits);
            setTopics([]);
            setSelectedUnit(null);

            // Auto-fill discipline name
            const sub = subjects.find(s => s.id === selectedSub);
            if (sub) setDisciplina(sub.name);
        }
    }, [selectedSub]);

    // EFFECT: Load Topics
    useEffect(() => {
        if (selectedUnit) {
            api.getCurriculoTopics(selectedUnit).then(setTopics);
        }
    }, [selectedUnit]);

    // EFFECT: Recalculate Dates
    useEffect(() => {
        reconcileDates();
    }, [dataInicio, diasSemana, lessons.length]);

    const reconcileDates = () => {
        if (diasSemana.length === 0) return;

        let currentDate = new Date(dataInicio + 'T00:00:00');
        // Find first valid day
        while (!diasSemana.includes(currentDate.getDay())) {
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const newLessons = [...lessons];
        newLessons.forEach((lesson, index) => {
            if (index > 0) {
                // Advance to next valid day
                do {
                    currentDate.setDate(currentDate.getDate() + 1);
                } while (!diasSemana.includes(currentDate.getDay()));
            }
            lesson.dateDisplay = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' });
        });
        setLessons(newLessons);
    };

    const toggleDay = (dayId: number) => {
        const newDays = diasSemana.includes(dayId)
            ? diasSemana.filter(d => d !== dayId)
            : [...diasSemana, dayId].sort();
        setDiasSemana(newDays);
    };

    const addLesson = (title = '') => {
        setLessons([...lessons, { id: Math.random().toString(36).substr(2, 9), title, dateDisplay: '' }]);
    };

    const removeLesson = (index: number) => {
        const newLessons = [...lessons];
        newLessons.splice(index, 1);
        setLessons(newLessons);
    };

    const updateLesson = (index: number, title: string) => {
        const newLessons = [...lessons];
        newLessons[index].title = title;
        setLessons(newLessons);
    };

    const handleSave = async () => {
        if (!titulo || lessons.length === 0) return;

        const validLessons = lessons.filter(l => l.title.trim() !== '').map((l, i) => ({
            ordem: i + 1,
            titulo: l.title
        }));

        if (validLessons.length === 0) return;

        try {
            await api.createPlano({
                turma_id: turmaId,
                titulo,
                disciplina,
                data_inicio: dataInicio,
                aulas: validLessons,
                dias_semana: diasSemana
            });
            onCreated();
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar planejamento');
        }
    };

    return (
        <div className="studio-container">
            {/* HEADER */}
            <header className="studio-header">
                <div className="studio-title">
                    <BookOpen size={20} color="#3b82f6" />
                    Teaching Studio: {turmaNome}
                </div>
                <div className="studio-actions">
                    <button className="btn-studio cancel" onClick={onClose}>Cancelar</button>
                    <button className="btn-studio save" onClick={handleSave}>
                        <Save size={16} style={{ marginRight: 8, display: 'inline' }} />
                        Publicar Planejamento
                    </button>
                </div>
            </header>

            <div className="studio-grid">
                {/* 1. CONFIG PANEL */}
                <div className="studio-panel left">
                    <div className="panel-title">Configurações Gerais</div>

                    <div className="studio-input-group">
                        <label className="studio-label">Título da Sequência</label>
                        <input
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
                        <input
                            type="text"
                            className="studio-input"
                            value={disciplina}
                            onChange={e => setDisciplina(e.target.value)}
                        />
                    </div>

                    <div className="studio-input-group">
                        <label className="studio-label">Início das Aulas</label>
                        <input
                            type="date"
                            className="studio-input"
                            value={dataInicio}
                            onChange={e => setDataInicio(e.target.value)}
                        />
                    </div>

                    <div className="studio-input-group">
                        <label className="studio-label">Dias de Aula (Semanal)</label>
                        <div className="weekday-visual">
                            {DIAS_SEMANA.map(day => (
                                <button
                                    key={day.id}
                                    className={`weekday-btn ${diasSemana.includes(day.id) ? 'active' : ''}`}
                                    onClick={() => toggleDay(day.id)}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. CANVAS PANEL */}
                <div className="studio-panel center">
                    <div className="timeline-canvas">
                        {lessons.map((lesson, index) => (
                            <div key={lesson.id} className="lesson-card">
                                <div className="card-header">
                                    <span className="card-order">AULA {index + 1}</span>
                                    <span className="card-date">{lesson.dateDisplay}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <GripVertical size={16} color="#475569" style={{ cursor: 'move' }} />
                                    <input
                                        type="text"
                                        className="card-input"
                                        placeholder="O que será ensinado?"
                                        value={lesson.title}
                                        onChange={e => updateLesson(index, e.target.value)}
                                    />
                                    <button className="btn-remove-aula" onClick={() => removeLesson(index)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button className="btn-add-lesson" onClick={() => addLesson()}>
                            <Plus size={18} /> Adicionar Aula
                        </button>
                    </div>
                </div>

                {/* 3. CURRICULUM PANEL */}
                <div className="studio-panel right">
                    <div className="curriculum-header">
                        <select
                            className="studio-input"
                            onChange={e => setSelectedSub(Number(e.target.value))}
                            value={selectedSub || ''}
                        >
                            <option value="">Selecione a Disciplina...</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="curriculum-content">
                        {selectedSub && !selectedUnit && (
                            <>
                                <div style={{ color: '#94a3b8', fontSize: '0.8rem', padding: 10, marginBottom: 10 }}>Selecione uma Unidade:</div>
                                {units.map(u => (
                                    <div key={u.id} className="curr-item" onClick={() => setSelectedUnit(u.id)}>
                                        <ChevronRight size={14} />
                                        {u.title}
                                    </div>
                                ))}
                            </>
                        )}

                        {selectedUnit && (
                            <>
                                <button
                                    className="btn-studio cancel"
                                    style={{ marginBottom: 10, width: '100%', fontSize: '0.8rem' }}
                                    onClick={() => setSelectedUnit(null)}
                                >
                                    ← Voltar para Unidades
                                </button>
                                <div style={{ padding: 5 }}>
                                    {topics.map(t => (
                                        <div key={t.id} className="curr-topic">
                                            <span>{t.name}</span>
                                            <button className="btn-add-topic" onClick={() => addLesson(t.name)}>
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
