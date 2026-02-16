import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, BookOpen } from 'lucide-react';
import { api } from '../services/api';
import './Turmas.css';

interface Turma {
    id: number;
    nome: string;
    disciplina?: string;
}

export const Turmas: React.FC = () => {
    const navigate = useNavigate();
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTurma, setNewTurma] = useState({ nome: '', disciplina: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTurmas();
    }, []);

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

    const handleAddTurma = async () => {
        if (!newTurma.nome) {
            alert('Nome da turma é obrigatório');
            return;
        }

        try {
            await api.addTurma(newTurma);
            setShowAddModal(false);
            setNewTurma({ nome: '', disciplina: '' });
            loadTurmas();
        } catch (error) {
            console.error('Erro ao criar turma:', error);
            alert('Erro ao criar turma');
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
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={20} />
                    Nova Turma
                </button>
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
                        <Users size={48} />
                        <h3>Nenhuma turma encontrada</h3>
                        <p>Crie sua primeira turma para começar</p>
                        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                            Criar Nova Turma
                        </button>
                    </div>
                )}
            </div>

            {/* Modal Nova Turma - Mantendo estrutura simples por enquanto */}
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
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleAddTurma}>Criar Turma</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
