import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, BookOpen, Edit2 } from 'lucide-react';
import { api } from '../services/api';
import './Turmas.css';

interface Turma {
    id: number;
    nome: string;
    disciplina?: string;
    dias_semana?: string | number[];
    quantidade_aulas?: number;
}

interface MasterTurma {
    id: number;
    nome: string;
}

export const Turmas: React.FC = () => {
    const navigate = useNavigate();
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingTurmaId, setEditingTurmaId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        nome: '',
        disciplina: '',
        dias_semana: [0, 2, 4] as number[],
        quantidade_aulas: 1
    });
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
        setFormData(prev => {
            const current = prev.dias_semana || [];
            const next = current.includes(dayId)
                ? current.filter(d => d !== dayId)
                : [...current, dayId];
            return { ...prev, dias_semana: next.sort() };
        });
    };

    const handleSaveTurma = async () => {
        if (!formData.nome || !formData.disciplina) {
            alert('Nome e disciplina são obrigatórios');
            return;
        }

        try {
            if (editingTurmaId) {
                await api.updateTurma(editingTurmaId, formData);
            } else {
                await api.addTurma(formData);
            }
            setShowModal(false);
            setEditingTurmaId(null);
            setFormData({ nome: '', disciplina: '', dias_semana: [0, 2, 4], quantidade_aulas: 1 });
            loadTurmas();
        } catch (error) {
            console.error('Erro ao salvar turma:', error);
            alert('Erro ao salvar turma');
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

    const openEditModal = (turma: Turma) => {
        setEditingTurmaId(turma.id);
        let ds = [0, 2, 4];
        if (typeof turma.dias_semana === 'string') {
            try { ds = JSON.parse(turma.dias_semana); } catch (e) { ds = []; }
        } else if (Array.isArray(turma.dias_semana)) {
            ds = turma.dias_semana;
        }

        setFormData({
            nome: turma.nome,
            disciplina: turma.disciplina || '',
            dias_semana: ds,
            quantidade_aulas: turma.quantidade_aulas || 1
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingTurmaId(null);
        setFormData({ nome: '', disciplina: '', dias_semana: [0, 2, 4], quantidade_aulas: 1 });
        setShowModal(true);
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
                    <button className="btn-primary" onClick={openCreateModal} title="Nova Turma">
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
                                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEditModal(turma); }} title="Editar Turma" style={{ color: '#60a5fa' }}>
                                        <Edit2 size={18} />
                                    </button>
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
                            <button className="btn-primary" onClick={openCreateModal}>
                                Criar Nova Turma
                            </button>
                            <button className="btn-secondary" onClick={() => setShowIncorporateModal(true)}>
                                Importar Central
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Criar/Editar Turma */}
            {showModal && (
                <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingTurmaId(null); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">{editingTurmaId ? 'Editar Turma' : 'Nova Turma'}</h2>
                        <div className="form-group">
                            <label className="form-label" htmlFor="turma-nome">Nome da Turma</label>
                            <input
                                id="turma-nome"
                                name="turma-nome"
                                type="text"
                                className="form-input"
                                placeholder="Ex: 3º Ano A"
                                value={formData.nome}
                                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="turma-disciplina">Disciplina</label>
                            <input
                                id="turma-disciplina"
                                name="turma-disciplina"
                                type="text"
                                className="form-input"
                                placeholder="Ex: Matemática"
                                value={formData.disciplina}
                                onChange={e => setFormData({ ...formData, disciplina: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="turma-qtd-aulas">Quantidade de Aulas (Semanal)</label>
                            <input
                                id="turma-qtd-aulas"
                                name="turma-qtd-aulas"
                                type="number"
                                className="form-input"
                                min="1"
                                max="40"
                                value={formData.quantidade_aulas}
                                onChange={e => setFormData({ ...formData, quantidade_aulas: parseInt(e.target.value) || 1 })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Dias de Aula</label>
                            <div className="weekday-selector">
                                {DIAS_SEMANA.map(day => (
                                    <button
                                        key={day.id}
                                        type="button"
                                        className={`weekday-btn ${formData.dias_semana.includes(day.id) ? 'active' : ''}`}
                                        onClick={() => toggleDay(day.id)}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => { setShowModal(false); setEditingTurmaId(null); }}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveTurma}>
                                {editingTurmaId ? 'Salvar Alterações' : 'Criar Turma'}
                            </button>
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
                            <label className="form-label" htmlFor="inc-turma-central">Turma (Base Central)</label>
                            <select
                                id="inc-turma-central"
                                name="inc-turma-central"
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
