import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Trash2, User, Users, FileText, BarChart3, ClipboardCheck, X, ChevronRight, FileUp, Edit3, UserMinus } from 'lucide-react';
import { api } from '../services/api';
import { EditResultadoModal } from './Relatorios/components/EditResultadoModal';
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
    const [gabaritos, setGabaritos] = useState<any[]>([]);
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
    const [alunoFreqHistory, setAlunoFreqHistory] = useState<any[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [selectedResultadoForCard, setSelectedResultadoForCard] = useState<any | null>(null);
    const [editingResultado, setEditingResultado] = useState<any | null>(null);
    const [editingGabarito, setEditingGabarito] = useState<any | null>(null);

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
                const [alunosData, gabaritosData] = await Promise.all([
                    api.getAlunosByTurma(parseInt(id)),
                    api.getGabaritos()
                ]);
                setAlunos(alunosData);
                setGabaritos(gabaritosData);
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
        setEditingResultado(null);
        setEditingGabarito(null);

        const turmaId = parseInt(id || '0');

        try {
            // 1. Carregar resultados do aluno apenas NESTA turma
            const resultadosDoAluno = await api.getResultadosAlunoTurma(turmaId, aluno.id);
            setAlunoResultados(resultadosDoAluno);
            if (resultadosDoAluno.length > 0) {
                setSelectedResultadoForCard(resultadosDoAluno[0]);
            } else {
                setSelectedResultadoForCard(null);
            }

            // 2. Carregar estatísticas de frequência do aluno apenas NESTA turma
            const freqData = await api.getFrequenciaAlunoTurma(turmaId, aluno.id);
            // freqData: { total_aulas, total_presencas, percentual, historico: [...] }

            // Usar o histórico retornado pelo novo endpoint (já filtrado por aluno e turma)
            const studentHistory = (freqData.historico || []).sort((a: any, b: any) => b.data.localeCompare(a.data));
            setAlunoFreqHistory(studentHistory);

            setSelectedAlunoStats({
                media: resultadosDoAluno.length > 0 ? (resultadosDoAluno.reduce((acc: number, curr: any) => acc + curr.nota, 0) / resultadosDoAluno.length).toFixed(1) : '0.0',
                provas: resultadosDoAluno.length,
                presenca: freqData.percentual || '0%'
            });

        } catch (error) {
            console.error('Erro ao carregar stats do aluno para esta turma', error);
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

            setShowFrequenciaModal(false);

            if (selectedAluno) {
                handleAlunoClick(selectedAluno);
            }
        } catch (error) {
            console.error('Erro ao salvar frequência:', error);
            alert('Erro ao salvar frequência.');
        }
    };

    const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !id) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split(/\r?\n/);

                // Get headers and clean them
                const rawHeaders = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase());
                const nomeIdx = rawHeaders.indexOf('nome');
                const codigoIdx = rawHeaders.indexOf('codigo') !== -1 ? rawHeaders.indexOf('codigo') : rawHeaders.indexOf('matricula');

                if (nomeIdx === -1) {
                    alert('CSV inválido. Certifique-se de ter uma coluna chamada "nome".');
                    return;
                }

                let successCount = 0;
                let errorCount = 0;

                // Process data lines
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const values = line.split(/[;,]/);
                    const nome = values[nomeIdx]?.trim();
                    const codigo = codigoIdx !== -1 ? values[codigoIdx]?.trim() : (i + (alunos.length || 0)).toString();

                    if (nome) {
                        try {
                            await api.addAluno({
                                nome,
                                codigo: codigo || (Date.now() + i).toString(),
                                turma_id: parseInt(id),
                                qr_token: `ALUNO_${codigo}`
                            });
                            successCount++;
                        } catch (err) {
                            errorCount++;
                        }
                    }
                }

                if (errorCount > 0) {
                    alert(`Importação concluída com erros.\nSucesso: ${successCount}\nErros: ${errorCount}`);
                }
                loadData();
            } catch (err) {
                console.error('Erro ao processar CSV:', err);
                alert('Erro ao processar o arquivo CSV.');
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleUnlinkAluno = async () => {
        if (!selectedAluno || !id || !confirm(`Remover ${selectedAluno.nome} desta turma? O histórico de notas e frequências desse aluno nesta turma será preservado, mas ele não aparecerá mais nesta lista.`)) return;

        try {
            await api.unlinkAlunoFromTurma(parseInt(id), selectedAluno.id);
            setShowAlunoModal(false);
            loadData();
        } catch (error) {
            console.error('Erro ao desvincular aluno:', error);
            alert('Erro ao remover aluno da turma');
        }
    };

    const handleDeleteAluno = async () => {
        if (!selectedAluno || !confirm(`AVISO CRÍTICO: Excluir ${selectedAluno.nome} permanentemente do sistema? Isso removerá o aluno de TODAS as turmas e excluirá todo o seu histórico. Esta ação não pode ser desfeita.`)) return;

        try {
            await api.deleteAluno(selectedAluno.id);
            setShowAlunoModal(false);
            loadData();
        } catch (error) {
            console.error('Erro ao excluir aluno:', error);
            alert('Erro ao excluir aluno permanentemente');
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
                    <div className="icon-bg icon-bg-sm icon-purple">
                        <Users size={18} />
                    </div>
                    <div>
                        <h1 className="turma-detail-title">{turma.nome}</h1>
                        {turma.disciplina && (
                            <p className="turma-detail-subtitle">{turma.disciplina}</p>
                        )}
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="action-icon-btn blue"
                        onClick={() => fileInputRef.current?.click()}
                        title="Importar CSV"
                        disabled={importing}
                    >
                        {importing ? <div className="spinner-small" /> : <FileUp size={18} />}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".csv"
                        onChange={handleImportCSV}
                    />
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
                <div className="stat-item">
                    <div className="icon-bg icon-bg-sm icon-blue">
                        <User size={18} />
                    </div>
                    <span>{alunos.length} Alunos</span>
                </div>
                <div className="stat-item">
                    <div className="icon-bg icon-bg-sm icon-purple">
                        <FileText size={18} />
                    </div>
                    <span>0 Gabaritos</span>
                </div>
                <div className="stat-item">
                    <div className="icon-bg icon-bg-sm icon-green">
                        <BarChart3 size={18} />
                    </div>
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

                        <div className="aluno-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div className="aluno-avatar-large">
                                    <User size={32} />
                                </div>
                                <div>
                                    <h2 className="modal-title" style={{ marginBottom: '4px' }}>{selectedAluno.nome}</h2>
                                    <p className="aluno-code-modal">Nº {selectedAluno.codigo}</p>
                                </div>
                            </div>
                            <div className="header-actions" style={{ marginTop: '4px' }}>
                                <button
                                    className="action-icon-btn"
                                    onClick={handleUnlinkAluno}
                                    title="Remover desta Turma"
                                    style={{ color: '#f59e0b', background: '#fffbeb', border: '1px solid #fef3c7' }}
                                >
                                    <UserMinus size={18} />
                                </button>
                                <button
                                    className="action-icon-btn danger"
                                    onClick={handleDeleteAluno}
                                    title="Excluir Permanentemente"
                                >
                                    <Trash2 size={18} />
                                </button>
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
                                                    <div className="flex items-center gap-2">
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
                                                        <button
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Editar Nota"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const gab = gabaritos.find(g => g.id === res.gabarito_id);
                                                                if (gab) {
                                                                    setEditingGabarito(gab);
                                                                    setEditingResultado({
                                                                        ...res,
                                                                        aluno: selectedAluno // Precisamos do objeto aluno para o modal
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
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

                                    <div className="freq-history-real" style={{ marginTop: '20px' }}>
                                        <h3 style={{ fontSize: '14px', margin: '0 0 10px', color: '#64748b' }}>Histórico de Presenças</h3>
                                        {alunoFreqHistory.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {alunoFreqHistory.map((entry: any) => (
                                                    <span key={entry.id} style={{
                                                        padding: '6px 12px',
                                                        background: entry.presente ? '#ecfdf5' : '#fef2f2',
                                                        color: entry.presente ? '#065f46' : '#991b1b',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                        fontWeight: '500',
                                                        border: `1px solid ${entry.presente ? '#d1fae5' : '#fee2e2'}`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        {entry.presente ? <ClipboardCheck size={14} /> : <X size={14} />}
                                                        {new Date(entry.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: {entry.presente ? 'Presente' : 'Falta'}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                                                <Calendar size={32} color="#94a3b8" />
                                                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '10px' }}>Nenhuma aula registrada ainda</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'cartao' && (
                                <div className="cartao-content">
                                    {alunoResultados.length > 0 ? (
                                        <>
                                            <div className="chip-scroll" style={{ marginBottom: '15px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                                                {alunoResultados.map(res => (
                                                    <button
                                                        key={res.id}
                                                        className={`chip ${selectedResultadoForCard?.id === res.id ? 'chip-active' : ''}`}
                                                        onClick={() => setSelectedResultadoForCard(res)}
                                                        style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                                                    >
                                                        {res.assunto || 'Prova'}
                                                    </button>
                                                ))}
                                            </div>

                                            {selectedResultadoForCard && (
                                                <div className="omr-grid-view" style={{ background: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                                                        <h4 style={{ fontSize: '14px', color: '#0f172a' }}>{selectedResultadoForCard.assunto}</h4>
                                                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#3b82f6' }}>
                                                            {selectedResultadoForCard.acertos} / {JSON.parse(selectedResultadoForCard.respostas_aluno || '[]').length} Acertos
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(45px, 1fr))', gap: '10px' }}>
                                                        {(() => {
                                                            try {
                                                                const respAluno = JSON.parse(selectedResultadoForCard.respostas_aluno || '[]');
                                                                const gabId = selectedResultadoForCard.gabarito_id;
                                                                const gabData = gabaritos.find(g => g.id === gabId);
                                                                const respCorretas = JSON.parse(gabData?.respostas_corretas || '[]');

                                                                return respAluno.map((resp: string, idx: number) => {
                                                                    const correta = respCorretas[idx];
                                                                    const isCorrect = resp === correta;
                                                                    return (
                                                                        <div key={idx} style={{
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            alignItems: 'center',
                                                                            gap: '4px'
                                                                        }}>
                                                                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>{idx + 1}</span>
                                                                            <div style={{
                                                                                width: '32px',
                                                                                height: '32px',
                                                                                borderRadius: '8px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                fontSize: '14px',
                                                                                fontWeight: 'bold',
                                                                                background: isCorrect ? '#dcfce7' : '#fee2e2',
                                                                                color: isCorrect ? '#166534' : '#991b1b',
                                                                                border: `1px solid ${isCorrect ? '#10b981' : '#ef4444'}`
                                                                            }}>
                                                                                {resp}
                                                                            </div>
                                                                            {!isCorrect && (
                                                                                <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 'bold' }}>→{correta}</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                });
                                                            } catch (e) {
                                                                return <div key="error">Erro ao processar cartão</div>;
                                                            }
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="cartao-placeholder">
                                            <ClipboardCheck size={48} color="#64748b" />
                                            <p>Nenhum cartão disponível</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Score Modal */}
            {editingResultado && editingGabarito && (
                <EditResultadoModal
                    resultado={editingResultado}
                    gabarito={editingGabarito}
                    onClose={() => {
                        setEditingResultado(null);
                        setEditingGabarito(null);
                    }}
                    onSuccess={() => {
                        if (selectedAluno) {
                            handleAlunoClick(selectedAluno);
                        }
                    }}
                />
            )}
        </div >
    );
};
