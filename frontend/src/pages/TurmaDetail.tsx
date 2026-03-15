import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Trash2, User, Users, BarChart3, ClipboardCheck, X, ChevronRight, FileUp, Edit3, UserMinus, BookOpen, Phone, Save, Mail } from 'lucide-react';
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
    nome_responsavel?: string;
    telefone_responsavel?: string;
    email_responsavel?: string;
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
    const [newAluno, setNewAluno] = useState({ nome: '', codigo: '', nome_responsavel: '', telefone_responsavel: '' });
    const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [frequenciaState, setFrequenciaState] = useState<{ [key: number]: boolean }>({});
    const [activeTab, setActiveTab] = useState<'desempenho' | 'frequencia' | 'cartao' | 'dados'>('desempenho');
    const [selectedAlunoStats, setSelectedAlunoStats] = useState({ media: '0.0', provas: 0, presenca: '0%' });
    const [alunoResultados, setAlunoResultados] = useState<any[]>([]);
    const [alunoFreqHistory, setAlunoFreqHistory] = useState<any[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [selectedResultadoForCard, setSelectedResultadoForCard] = useState<any | null>(null);
    const [editingResultado, setEditingResultado] = useState<any | null>(null);
    const [editingGabarito, setEditingGabarito] = useState<any | null>(null);
    const [editingAluno, setEditingAluno] = useState(false);
    const [editAlunoData, setEditAlunoData] = useState({ nome: '', codigo: '', nome_responsavel: '', telefone_responsavel: '', email_responsavel: '' });
    const [showEditTurmaModal, setShowEditTurmaModal] = useState(false);
    const [editTurmaData, setEditTurmaData] = useState({ nome: '', disciplina: '' });

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
        setEditingAluno(false);

        const turmaId = parseInt(id || '0');

        try {
            // 0. Carregar dados completos do aluno (incluindo responsável)
            const alunoCompleto = await api.getAluno(aluno.id);
            setEditAlunoData({
                nome: alunoCompleto.nome || '',
                codigo: alunoCompleto.codigo || '',
                nome_responsavel: alunoCompleto.nome_responsavel || '',
                telefone_responsavel: alunoCompleto.telefone_responsavel || '',
                email_responsavel: alunoCompleto.email_responsavel || ''
            });
            // Atualizar selectedAluno com dados completos
            setSelectedAluno({ ...aluno, ...alunoCompleto });

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

    const handleSaveAlunoEdit = async () => {
        if (!selectedAluno) return;
        try {
            await api.updateAluno(selectedAluno.id, editAlunoData);
            setEditingAluno(false);
            // Atualizar lista de alunos
            loadData();
            // Atualizar selectedAluno
            setSelectedAluno({ ...selectedAluno, ...editAlunoData });
        } catch (error) {
            console.error('Erro ao salvar edição:', error);
            alert('Erro ao salvar alterações');
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
            setNewAluno({ nome: '', codigo: '', nome_responsavel: '', telefone_responsavel: '' });
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
                const rawHeaders = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
                const nomeIdx = rawHeaders.indexOf('nome');
                const codigoIdx = rawHeaders.indexOf('codigo') !== -1 ? rawHeaders.indexOf('codigo') : rawHeaders.indexOf('matricula');
                const responsavelIdx = rawHeaders.findIndex(h => h.includes('responsavel') && h.includes('nome') || h === 'responsavel');
                const telefoneIdx = rawHeaders.findIndex(h => h.includes('telefone') || h.includes('celular') || h.includes('whatsapp'));
                const emailIdx = rawHeaders.findIndex(h => h.includes('email'));
                const nascimentoIdx = rawHeaders.findIndex(h => h.includes('nascimento') || h === 'data_nascimento');

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
                    const nomeResponsavel = responsavelIdx !== -1 ? values[responsavelIdx]?.trim() : undefined;
                    const telefoneResponsavel = telefoneIdx !== -1 ? values[telefoneIdx]?.trim() : undefined;
                    const emailResponsavel = emailIdx !== -1 ? values[emailIdx]?.trim() : undefined;
                    const dataNascimento = nascimentoIdx !== -1 ? values[nascimentoIdx]?.trim() : undefined;

                    if (nome) {
                        try {
                            await api.addAluno({
                                nome,
                                codigo: codigo || (Date.now() + i).toString(),
                                turma_id: parseInt(id),
                                qr_token: `ALUNO_${codigo}`,
                                nome_responsavel: nomeResponsavel || null,
                                telefone_responsavel: telefoneResponsavel || null,
                                email_responsavel: emailResponsavel || null,
                                data_nascimento: dataNascimento || null
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

    const handleEditTurma = () => {
        if (!turma) return;
        setEditTurmaData({
            nome: turma.nome,
            disciplina: turma.disciplina || ''
        });
        setShowEditTurmaModal(true);
    };

    const handleUpdateTurma = async () => {
        if (!id || !editTurmaData.nome || !editTurmaData.disciplina) return;
        try {
            setLoading(true);
            await api.updateTurma(parseInt(id), editTurmaData);
            setShowEditTurmaModal(false);
            await loadData();
        } catch (error) {
            console.error('Erro ao atualizar turma:', error);
            alert('Erro ao atualizar turma');
        } finally {
            setLoading(false);
        }
    }

    const handleWipeTurma = async () => {
        if (!id) return;
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const isAdmin = currentUser.role === 'admin';
        if (!isAdmin) {
            alert('Apenas administradores podem realizar esta ação.');
            return;
        }
        const confirm1 = confirm(`AVISO CRÍTICO: Você está prestes a excluir a turma "${turma?.nome}" E TODOS OS SEUS ${alunos.length} ALUNOS permanentemente.`);
        if (!confirm1) return;
        const confirm2 = confirm("ESTA AÇÃO NÃO PODE SER DESFEITA. Todos os resultados de provas, frequências e dados dos alunos serão APAGADOS PARA SEMPRE. Tem certeza absoluta?");
        if (!confirm2) return;
        try {
            setLoading(true);
            await api.wipeTurma(parseInt(id));
            alert('Turma e alunos excluídos com sucesso.');
            navigate('/dashboard/turmas');
        } catch (error) {
            console.error('Erro ao realizar WIPE:', error);
            alert('Erro ao excluir turma e alunos.');
        } finally {
            setLoading(false);
        }
    };;

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
            <div className="turma-detail-header sticky-header">
                <div className="header-navigation-row">
                    <button className="back-btn-modern" onClick={() => navigate('/dashboard/turmas')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="header-main-content">
                        <div className="title-group">
                            <h1 className="turma-detail-title-premium">{turma.nome}</h1>
                            <div className="turma-quick-meta">
                                <span className="meta-item"><Users size={14} /> {alunos.length} Alunos</span>
                                <span className="meta-divider"></span>
                                <span className="meta-item"><BookOpen size={14} /> {gabaritos.length} Gabaritos</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="header-actions-scroll">
                    <button
                        className="action-btn blue"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                    >
                        {importing ? <div className="spinner-small" /> : <FileUp size={16} />}
                        <span>Importar</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".csv"
                        onChange={handleImportCSV}
                        aria-label="Importar alunos via CSV"
                        tabIndex={-1}
                    />
                    <button className="action-btn calendar" onClick={() => setShowFrequenciaModal(true)}>
                        <Calendar size={16} />
                        <span>Frequência</span>
                    </button>
                    <button className="action-btn blue" onClick={() => navigate(`/dashboard/planejamento?turmaId=${id}`)}>
                        <BookOpen size={16} />
                        <span>Plano</span>
                    </button>
                    <button className="action-btn blue" onClick={handleEditTurma}>
                        <Edit3 size={16} />
                        <span>Editar</span>
                    </button>
                    <button className="action-btn add" onClick={() => setShowAddAlunoModal(true)}>
                        <User size={16} />
                        <span>Aluno+</span>
                    </button>
                    {JSON.parse(localStorage.getItem('user') || '{}').role === 'admin' && (
                        <button className="action-btn danger" onClick={handleWipeTurma} title="Apagar Turma e Alunos de uma vez">
                            <Trash2 size={16} />
                            <span>Apagar Tudo</span>
                        </button>
                    )}

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
                        {alunos.sort((a, b) => a.nome.localeCompare(b.nome)).map((aluno, index) => (
                            <div key={aluno.id} className="aluno-row" onClick={() => handleAlunoClick(aluno)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '800', width: '20px' }}>
                                        {(index + 1).toString().padStart(2, '0')}
                                    </span>
                                    <div className="aluno-avatar-small">
                                        {aluno.nome.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="aluno-name-row">{aluno.nome}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="aluno-code-row">#{aluno.codigo}</span>
                                    <ChevronRight size={16} className="aluno-action-icon" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state-small">
                        <User size={40} color="var(--color-text-muted)" />
                        <p>Nenhum aluno cadastrado</p>
                        <button className="btn-text" onClick={() => setShowAddAlunoModal(true)} style={{ color: 'var(--color-primary)', marginTop: '12px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                            + Adicionar Aluno
                        </button>
                    </div>
                )}
            </div>

            {/* Frequencia Modal */}
            {showFrequenciaModal && (
                <div className="modal-overlay" onClick={() => setShowFrequenciaModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <button className="back-btn-modal" onClick={() => setShowFrequenciaModal(false)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                <ArrowLeft size={16} />
                            </button>
                            <h2 className="modal-title" style={{ margin: 0, color: 'var(--color-text)' }}>Chamada</h2>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="freq-data">Data da Chamada</label>
                            <input
                                id="freq-data"
                                name="freq-data"
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
                        <div className="modal-header-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <button className="back-btn-modal" onClick={() => setShowAddAlunoModal(false)} style={{ background: 'var(--color-text)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                <ArrowLeft size={16} />
                            </button>
                            <h2 className="modal-title" style={{ margin: 0 }}>Adicionar Aluno</h2>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="add-aluno-nome">Nome do Aluno</label>
                            <input
                                id="add-aluno-nome"
                                name="add-aluno-nome"
                                type="text"
                                className="form-input"
                                placeholder="Ex: João Silva"
                                value={newAluno.nome}
                                onChange={(e) => setNewAluno({ ...newAluno, nome: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="add-aluno-codigo">Código / Matrícula</label>
                            <input
                                id="add-aluno-codigo"
                                name="add-aluno-codigo"
                                type="text"
                                className="form-input"
                                placeholder="Ex: 2024001"
                                value={newAluno.codigo}
                                onChange={(e) => setNewAluno({ ...newAluno, codigo: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="add-aluno-responsavel">Nome do Responsável (opcional)</label>
                            <input
                                id="add-aluno-responsavel"
                                name="add-aluno-responsavel"
                                type="text"
                                className="form-input"
                                placeholder="Ex: Maria Silva"
                                value={newAluno.nome_responsavel}
                                onChange={(e) => setNewAluno({ ...newAluno, nome_responsavel: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="add-aluno-telefone">Telefone do Responsável (opcional)</label>
                            <input
                                id="add-aluno-telefone"
                                name="add-aluno-telefone"
                                type="tel"
                                className="form-input"
                                placeholder="Ex: 11999998888"
                                value={newAluno.telefone_responsavel}
                                onChange={(e) => setNewAluno({ ...newAluno, telefone_responsavel: e.target.value })}
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
                        <div className="modal-header-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <button className="back-btn-modal" onClick={() => setShowAlunoModal(false)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                <ArrowLeft size={16} />
                            </button>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Detalhes do Aluno</span>
                        </div>

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
                            <div className="header-actions" style={{ marginTop: '4px', marginRight: '30px' }}>
                                <button
                                    className="action-icon-btn"
                                    onClick={handleUnlinkAluno}
                                    title="Remover desta Turma"
                                    style={{ color: 'var(--color-warning)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
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
                            <button
                                className={`tab ${activeTab === 'dados' ? 'active' : ''}`}
                                onClick={() => setActiveTab('dados')}
                            >
                                <User size={18} />
                                <span>Dados/Responsável</span>
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="tab-content">
                            {activeTab === 'desempenho' && (
                                <div className="desempenho-content">
                                    <div className="stats-row">
                                        <div className="stat-box">
                                            <div className="stat-box-label">Média Geral</div>
                                            <div className="stat-box-value" style={{ color: parseFloat(selectedAlunoStats.media) >= 7 ? 'var(--color-success)' : parseFloat(selectedAlunoStats.media) >= 5 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
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

                                    <h3 style={{ fontSize: '14px', margin: '20px 0 10px', color: 'var(--color-text-muted)' }}>Últimas Avaliações</h3>

                                    {alunoResultados.length > 0 ? (
                                        <div className="resultados-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {alunoResultados.map((res: any) => (
                                                <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--color-text)' }}>{res.assunto || 'Avaliação'}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{new Date(res.data).toLocaleDateString()} • {res.acertos} acertos</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div style={{
                                                            fontWeight: 'bold',
                                                            fontSize: '14px',
                                                            color: res.nota >= 7 ? 'var(--color-success)' : res.nota >= 5 ? 'var(--color-warning)' : 'var(--color-danger)',
                                                            background: res.nota >= 7 ? 'rgba(16,185,129,0.1)' : res.nota >= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                            padding: '4px 10px',
                                                            borderRadius: '8px'
                                                        }}>
                                                            {res.nota.toFixed(1)}
                                                        </div>
                                                        <button
                                                            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '6px', transition: 'color 0.2s' }}
                                                            title="Editar Nota"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const gab = gabaritos.find(g => g.id === res.gabarito_id);
                                                                if (gab) {
                                                                    setEditingGabarito(gab);
                                                                    setEditingResultado({
                                                                        ...res,
                                                                        aluno: selectedAluno
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
                                        <div style={{ fontSize: '48px', fontWeight: 'bold', color: 'var(--color-primary)' }}>{selectedAlunoStats.presenca}</div>
                                        <p style={{ color: 'var(--color-text-muted)' }}>Frequência Global</p>
                                    </div>

                                    <div className="freq-history-real" style={{ marginTop: '20px' }}>
                                        <h3 style={{ fontSize: '14px', margin: '0 0 10px', color: 'var(--color-text-muted)' }}>Histórico de Presenças</h3>
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
                                            <div style={{ textAlign: 'center', padding: '30px', background: 'var(--bg-primary)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                                                <Calendar size={32} color="var(--color-text-muted)" />
                                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '10px' }}>Nenhuma aula registrada ainda</p>
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
                                                <div className="omr-grid-view" style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                                                        <h4 style={{ fontSize: '14px', color: 'var(--color-text)' }}>{selectedResultadoForCard.assunto}</h4>
                                                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
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
                                                                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>{idx + 1}</span>
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
                                                                                border: `1px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-danger)'}`
                                                                            }}>
                                                                                {resp}
                                                                            </div>
                                                                            {!isCorrect && (
                                                                                <span style={{ fontSize: '9px', color: 'var(--color-success)', fontWeight: 'bold' }}>→{correta}</span>
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
                                            <ClipboardCheck size={48} color="var(--color-text-muted)" />
                                            <p>Nenhum cartão disponível</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'dados' && (
                                <div className="dados-content" style={{ padding: '10px 0' }}>
                                    <div style={{ 
                                        background: 'var(--bg-primary)', 
                                        borderRadius: '16px', 
                                        border: '1px solid var(--border-color)',
                                        padding: '20px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                            <h3 style={{ fontSize: '14px', color: 'var(--color-text)', margin: 0 }}>Dados do Aluno e Responsável</h3>
                                            {!editingAluno ? (
                                                <button 
                                                    onClick={() => setEditingAluno(true)}
                                                    style={{ 
                                                        background: 'var(--color-primary)', 
                                                        border: 'none', 
                                                        color: 'white', 
                                                        padding: '8px 16px', 
                                                        borderRadius: '8px', 
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    <Edit3 size={14} /> Editar
                                                </button>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button 
                                                        onClick={() => setEditingAluno(false)}
                                                        style={{ 
                                                            background: 'var(--border-color)', 
                                                            border: '1px solid var(--border-color)', 
                                                            color: 'var(--color-text-muted)', 
                                                            padding: '8px 16px', 
                                                            borderRadius: '8px', 
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button 
                                                        onClick={handleSaveAlunoEdit}
                                                        style={{ 
                                                            background: 'var(--color-success)', 
                                                            border: 'none', 
                                                            color: 'white', 
                                                            padding: '8px 16px', 
                                                            borderRadius: '8px', 
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        <Save size={14} /> Salvar
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {!editingAluno ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Nome do Aluno</div>
                                                        <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>{selectedAluno.nome}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Matrícula</div>
                                                        <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>{selectedAluno.codigo}</div>
                                                    </div>
                                                </div>
                                                
                                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px', fontWeight: 600 }}>Contato do Responsável</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Nome</div>
                                                            <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                                                                {editAlunoData.nome_responsavel || <span style={{ color: 'var(--color-text-muted)' }}>Não informado</span>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                                                                <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                                Telefone
                                                            </div>
                                                            <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                                                                {editAlunoData.telefone_responsavel ? (
                                                                    <a 
                                                                        href={`https://wa.me/55${editAlunoData.telefone_responsavel.replace(/\D/g, '')}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        style={{ color: 'var(--color-success)', textDecoration: 'none' }}
                                                                    >
                                                                        {editAlunoData.telefone_responsavel}
                                                                    </a>
                                                                ) : <span style={{ color: 'var(--color-text-muted)' }}>Não informado</span>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                                                                <Mail size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                                E-mail
                                                            </div>
                                                            <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                                                                {editAlunoData.email_responsavel || <span style={{ color: 'var(--color-text-muted)' }}>Não informado</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Nome do Aluno</label>
                                                        <input 
                                                            type="text"
                                                            value={editAlunoData.nome}
                                                            onChange={(e) => setEditAlunoData({ ...editAlunoData, nome: e.target.value })}
                                                            className="form-input"
                                                            style={{ width: '100%' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Matrícula</label>
                                                        <input 
                                                            type="text"
                                                            value={editAlunoData.codigo}
                                                            onChange={(e) => setEditAlunoData({ ...editAlunoData, codigo: e.target.value })}
                                                            className="form-input"
                                                            style={{ width: '100%' }}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px', fontWeight: 600 }}>Contato do Responsável</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                        <div>
                                                            <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Nome do Responsável</label>
                                                            <input 
                                                                type="text"
                                                                value={editAlunoData.nome_responsavel}
                                                                onChange={(e) => setEditAlunoData({ ...editAlunoData, nome_responsavel: e.target.value })}
                                                                className="form-input"
                                                                placeholder="Nome do responsável"
                                                                style={{ width: '100%' }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Telefone (WhatsApp)</label>
                                                            <input 
                                                                type="tel"
                                                                value={editAlunoData.telefone_responsavel}
                                                                onChange={(e) => setEditAlunoData({ ...editAlunoData, telefone_responsavel: e.target.value })}
                                                                className="form-input"
                                                                placeholder="11999998888"
                                                                style={{ width: '100%' }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>E-mail</label>
                                                            <input 
                                                                type="email"
                                                                value={editAlunoData.email_responsavel}
                                                                onChange={(e) => setEditAlunoData({ ...editAlunoData, email_responsavel: e.target.value })}
                                                                className="form-input"
                                                                placeholder="email@exemplo.com"
                                                                style={{ width: '100%' }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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


            {/* Edit Turma Modal */}
            {showEditTurmaModal && (
                <div className="modal-overlay" onClick={() => setShowEditTurmaModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <button className="back-btn-modal" onClick={() => setShowEditTurmaModal(false)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                <ArrowLeft size={16} />
                            </button>
                            <h2 className="modal-title" style={{ margin: 0, color: 'var(--color-text)' }}>Editar Turma</h2>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="edit-turma-nome">Nome da Turma</label>
                            <input
                                id="edit-turma-nome"
                                type="text"
                                className="form-input"
                                value={editTurmaData.nome}
                                onChange={(e) => setEditTurmaData({ ...editTurmaData, nome: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="edit-turma-disciplina">Disciplina</label>
                            <input
                                id="edit-turma-disciplina"
                                type="text"
                                className="form-input"
                                value={editTurmaData.disciplina}
                                onChange={(e) => setEditTurmaData({ ...editTurmaData, disciplina: e.target.value })}
                            />
                        </div>

                        <button className="btn-primary" onClick={handleUpdateTurma} disabled={loading}>
                            <Save size={18} style={{ marginRight: '8px' }} />
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
