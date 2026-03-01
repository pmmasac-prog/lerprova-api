import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, BookOpen } from 'lucide-react';
import { api } from '../services/api';
import './Turmas.css';

interface Turma {
    id: number;
    nome: string;
    disciplina?: string;
    dias_semana?: string | number[];
}

interface MasterTurma {
    id: number;
    nome: string;
}

export const Turmas: React.FC = () => {
    const navigate = useNavigate();
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTurma, setNewTurma] = useState<{
        nome: string;
        disciplina: string;
        dias_semana: number[];
    }>({ nome: '', disciplina: '', dias_semana: [0, 2, 4] });
    const [loading, setLoading] = useState(true);

    const [masterTurmas, setMasterTurmas] = useState<MasterTurma[]>([]);
    const [showIncorporateModal, setShowIncorporateModal] = useState(false);
    const [incData, setIncData] = useState({ master_turma_id: 0, disciplina: '' });

    const DIAS_SEMANA = [
        { id: 0, label: 'Seg' },
        { id: 1, label: 'Ter' },
        { id: 2, label: 'Qua' },
        { id: 3, label: 'Qui' },
        { id: 4, label: 'Sex' },
    ];

    useEffect(() => {
        loadTurmas();
        loadMasterTurmas();
    }, []);

    const loadMasterTurmas = async () => {
        try {
            const data = await api.getMasterTurmas();
            setMasterTurmas(data);
        } catch (error) {
            console.error('Erro ao carregar turmas master:', error);
        }
    };

    const loadTurmas = async () => {
        try {
            setLoading(true);
            const data = await api.getTurmas();
            setTurmas(data);
        } catch (error) {
            console.error('Erro ao carregar turmas:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleDay = (dayId: number) => {
        setNewTurma(prev => {
            const current = prev.dias_semana || [];
            const next = current.includes(dayId)
                ? current.filter(d => d !== dayId)
                : [...current, dayId];
            return { ...prev, dias_semana: next.sort() };
        });
    };

    const handleAddTurma = async () => {
        if (!newTurma.nome || !newTurma.disciplina || newTurma.dias_semana.length === 0) {
            alert('Nome, disciplina e pelo menos um dia da semana são obrigatórios');
            return;
        }

        try {
            await api.addTurma(newTurma);
            setShowAddModal(false);
            setNewTurma({ nome: '', disciplina: '', dias_semana: [0, 2, 4] });
            loadTurmas();
        } catch (error) {
            console.error('Erro ao criar turma:', error);
            alert('Erro ao criar turma');
        }
    };

    const handleIncorporate = async () => {
        if (!incData.master_turma_id || !incData.disciplina) {
            alert('Selecione uma turma e informe a disciplina');
            return;
        }

        try {
            await api.incorporateTurma(incData);
            setShowIncorporateModal(false);
            setIncData({ master_turma_id: 0, disciplina: '' });
            loadTurmas();
        } catch (error) {
            console.error('Erro ao incorporar:', error);
            alert('Erro ao incorporar turma');
        }
    };

    const handleDeleteTurma = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir esta turma?')) return;

        try {
            await api.deleteTurma(id);
            loadTurmas();
        } catch (error) {
            console.error('Erro ao excluir turma:', error);
            alert('Erro ao excluir turma');
        }
    };

    return (
        <div className="turmas-container">
            <div className="turmas-header">
                <div>
                    <h1 className="turmas-title">Minhas Turmas</h1>
                    <p className="turmas-subtitle">Gerencie suas salas de aula</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary" onClick={() => setShowIncorporateModal(true)} title="Importar da Base Central">
                        Importar Central
                    </button>
                    <button className="btn-primary" onClick={() => setShowAddModal(true)} title="Nova Turma">
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            <div className="turmas-content">
                {loading ? (
                    <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>Carregando turmas...</p>
                ) : turmas.length > 0 ? (
                    <div className="turmas-grid">
                        {turmas.map(turma => (
                            <div key={turma.id} className="turma-card" onClick={() => navigate(`/dashboard/turma/${turma.id}`)}>
                                <div className="turma-left">
                                    <div className="turma-icon">
                                        <BookOpen size={20} />
                                    </div>
                                    <div className="turma-info">
                                        <h3 className="turma-name">{turma.nome}</h3>
                                        <p className="turma-disciplina">{turma.disciplina || 'Geral'}</p>
                                    </div>
                                </div>

                                <div className="turma-actions">
                                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleDeleteTurma(turma.id); }} title="Excluir Turma">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="icon-bg icon-blue mb-4" style={{ width: '80px', height: '80px', borderRadius: '24px' }}>
                            <Users size={40} />
                        </div>
                        <h3>Nenhuma turma encontrada</h3>
                        <p>Crie sua primeira turma para começar</p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                                Criar Nova Turma
                            </button>
                            <button className="btn-secondary" onClick={() => setShowIncorporateModal(true)}>
                                Importar Central
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Nova Turma */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Nova Turma</h2>
                        <div className="form-group">
                            <label className="form-label">Nome da Turma</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: 3º Ano A"
                                value={newTurma.nome}
                                onChange={e => setNewTurma({ ...newTurma, nome: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Disciplina</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: Matemática"
                                value={newTurma.disciplina}
                                onChange={e => setNewTurma({ ...newTurma, disciplina: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Dias de Aula</label>
                            <div className="weekday-selector">
                                {DIAS_SEMANA.map(day => (
                                    <button
                                        key={day.id}
                                        type="button"
                                        className={`weekday-btn ${newTurma.dias_semana.includes(day.id) ? 'active' : ''}`}
                                        onClick={() => toggleDay(day.id)}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleAddTurma}>Criar Turma</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Incorporar Turma */}
            {showIncorporateModal && (
                <div className="modal-overlay" onClick={() => setShowIncorporateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Central de Turmas</h2>
                        <p className="modal-subtitle">Escolha uma lista de alunos da base central e indique sua disciplina</p>

                        <div className="form-group">
                            <label className="form-label">Turma (Base Central)</label>
                            <select
                                className="form-input"
                                value={incData.master_turma_id}
                                onChange={e => setIncData({ ...incData, master_turma_id: parseInt(e.target.value) })}
                            >
                                <option value={0}>Selecione uma sala...</option>
                                {masterTurmas.map(m => (
                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Sua Disciplina</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: Química, Geografia..."
                                value={incData.disciplina}
                                onChange={e => setIncData({ ...incData, disciplina: e.target.value })}
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowIncorporateModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleIncorporate}>Vincular à minha conta</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
