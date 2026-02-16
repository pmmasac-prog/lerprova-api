import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Trash2, User, FileText, BarChart3, ClipboardCheck, X, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import './TurmaDetail.css';

interface Turma {
    id: number;
    nome: string;
    disciplina?: string;
}

interface Aluno {
    id: number;
    nome: string;
    codigo: string;
    turma_id: number;
    qr_token: string;
}

export const TurmaDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [turma, setTurma] = useState<Turma | null>(null);
    const [alunos, setAlunos] = useState<Aluno[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFrequenciaModal, setShowFrequenciaModal] = useState(false);
    const [showAlunoModal, setShowAlunoModal] = useState(false);
    const [showAddAlunoModal, setShowAddAlunoModal] = useState(false);
    const [newAluno, setNewAluno] = useState({ nome: '', codigo: '' });
    const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [frequenciaState, setFrequenciaState] = useState<{ [key: number]: boolean }>({});
    const [activeTab, setActiveTab] = useState<'desempenho' | 'frequencia' | 'cartao'>('desempenho');
    const [selectedAlunoStats, setSelectedAlunoStats] = useState({ media: '0.0', provas: 0, presenca: '0%' });
    const [alunoResultados, setAlunoResultados] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const turmas = await api.getTurmas();
            const turmaData = turmas.find((t: Turma) => t.id === parseInt(id || '0'));
            setTurma(turmaData || null);

            if (id) {
                const alunosData = await api.getAlunosByTurma(parseInt(id));
                setAlunos(alunosData);
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (showFrequenciaModal && alunos.length > 0) {
            // Default to all present if new, or load if exists (future improvement)
            const initial: { [key: number]: boolean } = {};
            alunos.forEach(a => initial[a.id] = true);
            setFrequenciaState(initial);
        }
    }, [showFrequenciaModal, alunos]);

    const handleAlunoClick = async (aluno: Aluno) => {
        setSelectedAluno(aluno);
        setShowAlunoModal(true);
        setActiveTab('desempenho');

        try {
            const allResultados = await api.getResultados();
            const resultadosDoAluno = allResultados.filter((r: any) => r.aluno_id === aluno.id);
            setAlunoResultados(resultadosDoAluno);

            // Carregar dados de frequência do aluno
            const freqData = await api.getFrequenciaAluno(aluno.id);
            // freqData: { total_aulas, total_presencas, percentual }

            // Se tiver endpoint de histórico detalhado, usaríamos aqui. 
            // Como não temos GET /frequencia/aluno/{id}/history, vamos simular ou deixar estatístico por enquanto
            // Para "Frequência" tab, vamos mostrar o stats
            setSelectedAlunoStats({
                media: resultadosDoAluno.length > 0 ? (resultadosDoAluno.reduce((acc: number, curr: any) => acc + curr.nota, 0) / resultadosDoAluno.length).toFixed(1) : '0.0',
                provas: resultadosDoAluno.length,
                presenca: freqData.percentual || '0%'
            });

        } catch (error) {
            console.error('Erro ao carregar stats do aluno', error);
        }
    };

    const toggleFrequencia = (id: number) => {
        setFrequenciaState(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const toggleAllFrequencia = () => {
        const allPresent = Object.values(frequenciaState).every(v => v);
        const newState: { [key: number]: boolean } = {};
        alunos.forEach(a => newState[a.id] = !allPresent);
        setFrequenciaState(newState);
    };

    // ... deletes and other handlers ...

    const handleDeleteTurma = async () => {
        if (!confirm('Deseja realmente excluir esta turma? Todos os alunos serão removidos.')) return;

        try {
            if (id) {
                await api.deleteTurma(parseInt(id));
                navigate('/dashboard/turmas');
            }
        } catch (error) {
            console.error('Erro ao excluir turma:', error);
            alert('Erro ao excluir turma');
        }
    };

    const handleAddAluno = async () => {
        if (!newAluno.nome || !newAluno.codigo) {
            alert('Preencha todos os campos!');
            return;
        }

        try {
            await api.addAluno({
                ...newAluno,
                turma_id: parseInt(id || '0')
            });
            setShowAddAlunoModal(false);
            setNewAluno({ nome: '', codigo: '' });
            loadData();
        } catch (error) {
            console.error('Erro ao adicionar aluno:', error);
            alert('Erro ao adicionar aluno');
        }
    };

    const handleMarkFrequencia = async () => {
        try {
            const alunosPresenca = alunos.map(aluno => ({
                id: aluno.id,
                presente: frequenciaState[aluno.id] ?? true
            }));

            await api.saveFrequencia({
                turma_id: parseInt(id || '0'),
                data: selectedDate,
                alunos: alunosPresenca
            });

            alert('Frequência salva com sucesso!');
            setShowFrequenciaModal(false);

            if (selectedAluno) {
                handleAlunoClick(selectedAluno);
            }
        } catch (error) {
            console.error('Erro ao salvar frequência:', error);
            alert('Erro ao salvar frequência.');
        }
    };

    if (loading) {
        return (
            <div className="turma-detail-container">
                <p className="loading-text">Carregando...</p>
            </div>
        );
    }

    if (!turma) {
        return (
            <div className="turma-detail-container">
                <p className="error-text">Turma não encontrada</p>
            </div>
        );
    }

    return (
        <div className="turma-detail-container">
            {/* Header */}
            <div className="turma-detail-header">
                <button className="back-btn" onClick={() => navigate('/dashboard/turmas')}>
                    <ArrowLeft size={18} />
                </button>
                <div className="header-info">
                    <h1 className="turma-detail-title">{turma.nome}</h1>
                    {turma.disciplina && (
                        <p className="turma-detail-subtitle">{turma.disciplina}</p>
                    )}
                </div>
                <div className="header-actions">
                    <button className="action-icon-btn calendar" onClick={() => setShowFrequenciaModal(true)} title="Frequência">
                        <Calendar size={18} />
                    </button>
                    <button className="action-icon-btn add" onClick={() => setShowAddAlunoModal(true)} title="Adicionar Aluno">
                        <User size={18} />
                    </button>
                    <button className="action-icon-btn danger" onClick={handleDeleteTurma} title="Excluir Turma">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="turma-stats">
                <div className="stat-item blue">
                    <User size={18} />
                    <span>{alunos.length} Alunos</span>
                </div>
                <div className="stat-item purple">
                    <FileText size={18} />
                    <span>0 Gabaritos</span>
                </div>
                <div className="stat-item green">
                    <BarChart3 size={18} />
                    <span>Média: 0.0</span>
                </div>
            </div>

            {/* Alunos List */}
            <div className="section">
                <div className="section-header">
                    <h2 className="section-title">Alunos da Turma ({alunos.length})</h2>
                    {/* Add search bar later if needed */}
                </div>

                {alunos.length > 0 ? (
                    <div className="alunos-list-container">
                        {alunos.sort((a, b) => a.nome.localeCompare(b.nome)).map(aluno => (
                            <div key={aluno.id} className="aluno-row" onClick={() => handleAlunoClick(aluno)}>
                                <div className="aluno-avatar-small">
                                    {aluno.nome.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="aluno-info-row">
                                    <span className="aluno-name-row">{aluno.nome}</span>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span className="aluno-code-row">#{aluno.codigo}</span>
                                        <ChevronRight size={16} className="aluno-action-icon" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state-small">
                        <User size={40} color="#64748b" />
                        <p>Nenhum aluno cadastrado</p>
                        <button className="btn-text" onClick={() => setShowAddAlunoModal(true)} style={{ color: '#3b82f6', marginTop: '10px', background: 'none', border: 'none', cursor: 'pointer' }}>
                            + Adicionar Aluno
                        </button>
                    </div>
                )}
            </div>

            {/* Frequencia Modal */}
            {showFrequenciaModal && (
                <div className="modal-overlay" onClick={() => setShowFrequenciaModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowFrequenciaModal(false)}>
                            <X size={20} />
                        </button>
                        <h2 className="modal-title">Chamada</h2>

                        <div className="form-group">
                            <label className="form-label">Data da Chamada</label>
                            <input
                                type="date"
                                className="form-input"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>

                        <div className="frequencia-toolbar">
                            <div className="frequencia-stats-info">
                                {Object.values(frequenciaState).filter(Boolean).length} Presentes / {alunos.length} Total
                            </div>
                            <button className="btn-text-small" onClick={toggleAllFrequencia}>
                                {Object.values(frequenciaState).every(v => v) ? 'Desmarcar Todos' : 'Marcar Todos'}
                            </button>
                        </div>

                        <div className="frequencia-list">
                            {alunos.sort((a, b) => a.nome.localeCompare(b.nome)).map(aluno => (
                                <div key={aluno.id} className={`frequencia-item ${frequenciaState[aluno.id] ? 'present' : 'absent'}`} onClick={() => toggleFrequencia(aluno.id)}>
                                    <div className="freq-avatar">
                                        {aluno.nome.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="freq-name">{aluno.nome}</div>
                                    <div className={`freq-toggle ${frequenciaState[aluno.id] ? 'active' : ''}`}>
                                        {frequenciaState[aluno.id] ? 'P' : 'F'}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="btn-primary" onClick={handleMarkFrequencia}>
                            Salvar Frequência
                        </button>
                    </div>
                </div>
            )}

            {/* Add Aluno Modal */}
            {showAddAlunoModal && (
                <div className="modal-overlay" onClick={() => setShowAddAlunoModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowAddAlunoModal(false)}>
                            <X size={20} />
                        </button>
                        <h2 className="modal-title">Adicionar Aluno</h2>

                        <div className="form-group">
                            <label className="form-label">Nome do Aluno</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: João Silva"
                                value={newAluno.nome}
                                onChange={(e) => setNewAluno({ ...newAluno, nome: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Código / Matrícula</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: 2024001"
                                value={newAluno.codigo}
                                onChange={(e) => setNewAluno({ ...newAluno, codigo: e.target.value })}
                            />
                        </div>

                        <button className="btn-primary" onClick={handleAddAluno}>
                            Cadastrar Aluno
                        </button>
                    </div>
                </div>
            )}

            {/* Aluno Detail Modal */}
            {showAlunoModal && selectedAluno && (
                <div className="modal-overlay" onClick={() => setShowAlunoModal(false)}>
                    <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowAlunoModal(false)}>
                            <X size={20} />
                        </button>

                        <div className="aluno-modal-header">
                            <div className="aluno-avatar-large">
                                <User size={32} />
                            </div>
                            <div>
                                <h2 className="modal-title">{selectedAluno.nome}</h2>
                                <p className="aluno-code-modal">Nº {selectedAluno.codigo}</p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="tabs">
                            <button
                                className={`tab ${activeTab === 'desempenho' ? 'active' : ''}`}
                                onClick={() => setActiveTab('desempenho')}
                            >
                                <BarChart3 size={18} />
                                <span>Desempenho</span>
                            </button>
                            <button
                                className={`tab ${activeTab === 'frequencia' ? 'active' : ''}`}
                                onClick={() => setActiveTab('frequencia')}
                            >
                                <Calendar size={18} />
                                <span>Frequência</span>
                            </button>
                            <button
                                className={`tab ${activeTab === 'cartao' ? 'active' : ''}`}
                                onClick={() => setActiveTab('cartao')}
                            >
                                <ClipboardCheck size={18} />
                                <span>Cartão Resposta</span>
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="tab-content">
                            {activeTab === 'desempenho' && (
                                <div className="desempenho-content">
                                    <div className="stats-row">
                                        <div className="stat-box">
                                            <div className="stat-box-label">Média Geral</div>
                                            <div className="stat-box-value" style={{ color: parseFloat(selectedAlunoStats.media) >= 7 ? '#10b981' : parseFloat(selectedAlunoStats.media) >= 5 ? '#f59e0b' : '#ef4444' }}>
                                                {selectedAlunoStats.media}
                                            </div>
                                        </div>
                                        <div className="stat-box">
                                            <div className="stat-box-label">Provas Feitas</div>
                                            <div className="stat-box-value">{selectedAlunoStats.provas}</div>
                                        </div>
                                        <div className="stat-box">
                                            <div className="stat-box-label">Presença</div>
                                            <div className="stat-box-value">{selectedAlunoStats.presenca}</div>
                                        </div>
                                    </div>

                                    <h3 style={{ fontSize: '14px', margin: '20px 0 10px', color: '#64748b' }}>Últimas Avaliações</h3>

                                    {alunoResultados.length > 0 ? (
                                        <div className="resultados-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {alunoResultados.map((res: any) => (
                                                <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>{res.assunto || 'Avaliação'}</div>
                                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(res.data).toLocaleDateString()} • {res.acertos} acertos</div>
                                                    </div>
                                                    <div style={{
                                                        fontWeight: 'bold',
                                                        fontSize: '14px',
                                                        color: res.nota >= 7 ? '#10b981' : res.nota >= 5 ? '#f59e0b' : '#ef4444',
                                                        background: res.nota >= 7 ? '#ecfdf5' : res.nota >= 5 ? '#fffbeb' : '#fef2f2',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px'
                                                    }}>
                                                        {res.nota.toFixed(1)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="empty-hint">Nenhuma prova corrigida ainda</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'frequencia' && (
                                <div className="frequencia-content">
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#3b82f6' }}>{selectedAlunoStats.presenca}</div>
                                        <p style={{ color: '#64748b' }}>Frequência Global</p>
                                    </div>

                                    <div className="freq-history-placeholder" style={{ textAlign: 'center', marginTop: '20px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                                        <Calendar size={32} color="#94a3b8" />
                                        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '10px' }}>Histórico detalhado das aulas</p>
                                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {/* Mock de dias */}
                                            <span style={{ padding: '4px 8px', background: '#ecfdf5', color: '#065f46', borderRadius: '4px', fontSize: '11px', border: '1px solid #d1fae5' }}>27/10: Presente</span>
                                            <span style={{ padding: '4px 8px', background: '#fef2f2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', border: '1px solid #fee2e2' }}>26/10: Falta</span>
                                            <span style={{ padding: '4px 8px', background: '#ecfdf5', color: '#065f46', borderRadius: '4px', fontSize: '11px', border: '1px solid #d1fae5' }}>25/10: Presente</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'cartao' && (
                                <div className="cartao-content">
                                    <div className="cartao-placeholder">
                                        <ClipboardCheck size={48} color="#64748b" />
                                        <p>Cartões de resposta</p>
                                        <p className="empty-hint">Nenhum cartão disponível</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
