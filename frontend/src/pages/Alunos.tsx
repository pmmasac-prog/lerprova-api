import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, FileUp, QrCode, Trash2, Plus, HelpCircle, BarChart3, ArrowLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import './Alunos.css';

interface Turma {
    id: number;
    nome: string;
}

interface Aluno {
    id: number;
    nome: string;
    codigo: string;
    turma_id: number;
    qr_token: string;
}

export const Alunos: React.FC = () => {
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [selectedTurma, setSelectedTurma] = useState<number | null>(null);
    const [alunos, setAlunos] = useState<Aluno[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
    const navigate = useNavigate();

    // Form states
    const [newAluno, setNewAluno] = useState({ nome: '', codigo: '' });

    useEffect(() => {
        loadTurmas();
    }, []);

    useEffect(() => {
        if (selectedTurma) {
            loadAlunos();
        }
    }, [selectedTurma]);

    const loadTurmas = async () => {
        try {
            setLoading(true);
            const data = await api.getTurmas();
            setTurmas(data);
            if (data.length > 0) {
                setSelectedTurma(data[0].id);
            }
        } catch (error) {
            console.error('Erro ao carregar turmas:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAlunos = async () => {
        if (!selectedTurma) return;
        try {
            setLoading(true);
            const data = await api.getAlunosByTurma(selectedTurma);
            setAlunos(data);

            // Calcular próximo código
            if (data.length > 0) {
                const maxCodigo = Math.max(...data.map((a: Aluno) => parseInt(a.codigo) || 0));
                setNewAluno(prev => ({ ...prev, codigo: String(maxCodigo + 1) }));
            } else {
                setNewAluno(prev => ({ ...prev, codigo: '1' }));
            }
        } catch (error) {
            console.error('Erro ao carregar alunos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAluno = async () => {
        if (!newAluno.nome || !newAluno.codigo || !selectedTurma) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            await api.addAluno({
                nome: newAluno.nome,
                codigo: newAluno.codigo,
                turma_id: selectedTurma,
                qr_token: `ALUNO_${newAluno.codigo}`
            });

            setNewAluno({ nome: '', codigo: '' });
            loadAlunos();
        } catch (error) {
            console.error('Erro ao adicionar aluno:', error);
            alert('Erro ao adicionar aluno');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Deseja realmente excluir este aluno?')) return;

        try {
            await api.deleteAluno(id);
            loadAlunos();
        } catch (error) {
            console.error('Erro ao excluir aluno:', error);
            alert('Erro ao excluir aluno');
        }
    };

    const handleShowQR = (aluno: Aluno) => {
        setSelectedAluno(aluno);
        setShowQRModal(true);
    };

    const handleImportCSV = () => {
        alert('Funcionalidade de importação CSV em desenvolvimento');
    };

    const selectedTurmaNome = turmas.find(t => t.id === selectedTurma)?.nome || 'Turma';

    return (
        <div className="alunos-container">
            {/* Header */}
            <div className="alunos-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button className="help-btn" onClick={() => navigate('/dashboard')} style={{ padding: '10px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="alunos-title">{selectedTurmaNome}</h1>
                        <p className="alunos-count">{alunos.length} alunos cadastrados</p>
                    </div>
                </div>
                <button className="help-btn" onClick={() => setShowHelpModal(true)}>
                    <HelpCircle size={18} />
                    <span>Tutorial CSV</span>
                </button>
            </div>

            {/* Turma Selector */}
            <div className="turma-selector">
                {turmas.map(t => (
                    <button
                        key={t.id}
                        className={`turma-chip ${selectedTurma === t.id ? 'active' : ''}`}
                        onClick={() => setSelectedTurma(t.id)}
                    >
                        {t.nome}
                    </button>
                ))}
            </div>

            {/* Add Form */}
            <div className="add-form">
                <h3 className="add-form-title">Adicionar Aluno</h3>
                <div className="add-form-row">
                    <input
                        type="text"
                        placeholder="Nome do Aluno"
                        className="form-input"
                        value={newAluno.nome}
                        onChange={(e) => setNewAluno({ ...newAluno, nome: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Nº"
                        className="form-input-small"
                        value={newAluno.codigo}
                        onChange={(e) => setNewAluno({ ...newAluno, codigo: e.target.value })}
                    />
                    <button className="add-btn" onClick={handleAddAluno}>
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* Alunos List */}
            <div className="alunos-list">
                {loading ? (
                    <p className="empty-text">Carregando...</p>
                ) : alunos.length > 0 ? (
                    alunos.map(aluno => (
                        <div key={aluno.id} className="aluno-card" onClick={() => handleShowQR(aluno)}>
                            <div className="aluno-avatar">
                                <User size={24} />
                            </div>
                            <div className="aluno-info">
                                <div className="aluno-name">{aluno.nome}</div>
                                <div className="aluno-code">#{aluno.codigo}</div>
                            </div>
                            <div className="aluno-actions" onClick={e => e.stopPropagation()}>
                                <button className="action-btn-qr" onClick={() => handleShowQR(aluno)}>
                                    <QrCode size={18} />
                                </button>
                                <button className="action-btn-delete" onClick={() => handleDelete(aluno.id)}>
                                    <Trash2 size={18} />
                                </button>
                                <ChevronRight size={16} color="#475569" />
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="empty-text">Nenhum aluno cadastrado</p>
                )}
            </div>

            {/* Footer Actions */}
            <div className="alunos-footer">
                <button className="footer-btn" onClick={handleImportCSV}>
                    <FileUp size={24} />
                    <span>Importar CSV</span>
                </button>
                <button className="footer-btn">
                    <BarChart3 size={24} />
                    <span>Relatórios</span>
                </button>
                <button className="footer-btn">
                    <QrCode size={24} />
                    <span>QR Codes</span>
                </button>
            </div>

            {/* Help Modal */}
            {showHelpModal && (
                <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <button className="back-btn-modal" onClick={() => setShowHelpModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                <ArrowLeft size={16} />
                            </button>
                            <h2 className="modal-title" style={{ margin: 0 }}>Modelo de Importação CSV</h2>
                        </div>
                        <p className="modal-text">
                            O arquivo deve ser um CSV comum com os nomes das colunas na primeira linha (cabeçalho).
                        </p>

                        <div className="csv-table">
                            <div className="csv-header">
                                <div className="csv-cell">nome</div>
                                <div className="csv-cell">codigo</div>
                            </div>
                            <div className="csv-row">
                                <div className="csv-cell">João Silva</div>
                                <div className="csv-cell">101</div>
                            </div>
                            <div className="csv-row">
                                <div className="csv-cell">Maria Souza</div>
                                <div className="csv-cell">102</div>
                            </div>
                        </div>

                        <div className="help-note">
                            <h4>Dicas importantes:</h4>
                            <ul>
                                <li>O código deve ser único para cada aluno.</li>
                                <li>Se o código já existir no sistema, o aluno será ignorado.</li>
                                <li>Você pode usar programas como Excel ou Google Sheets para criar o arquivo e salvar como CSV.</li>
                            </ul>
                        </div>

                        <button className="modal-btn" onClick={() => setShowHelpModal(false)}>
                            Entendi
                        </button>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {showQRModal && selectedAluno && (
                <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
                    <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <button className="back-btn-modal" onClick={() => setShowQRModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                <ArrowLeft size={16} />
                            </button>
                            <h2 className="modal-title" style={{ margin: 0 }}>{selectedAluno.nome}</h2>
                        </div>
                        <div className="qr-placeholder">
                            <QrCode size={120} />
                            <p>QR Code: {selectedAluno.qr_token}</p>
                        </div>
                        <p className="qr-hint">Escaneie este código para identificar o aluno</p>
                    </div>
                </div>
            )}
        </div>
    );
};
