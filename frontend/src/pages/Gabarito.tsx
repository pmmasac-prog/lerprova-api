import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, Plus, Search, Download, Trash2, Save, Edit3, BookOpen, Calendar, Layout, CheckSquare, Camera, History as HistoryIcon, Upload } from 'lucide-react';
import { api } from '../services/api';
import { useReactToPrint } from 'react-to-print';
import { GabaritoTemplate } from './Gabarito/components/GabaritoTemplate';
import { ScannerModal } from './Gabarito/components/ScannerModal';
import './Gabarito.css';

interface Turma {
    id: number;
    nome: string;
}

interface Gabarito {
    id: number;
    turma_id: number;
    turma_nome?: string;
    assunto: string;
    disciplina?: string;
    data: string;
    num_questoes: number;
    respostas_corretas: string;
    turma_ids?: number[];
}

export const Gabarito: React.FC = () => {
    const [viewMode, setViewMode] = useState<'history' | 'create'>('history');
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [selectedTurmaIds, setSelectedTurmaIds] = useState<number[]>([]);
    const [gabaritos, setGabaritos] = useState<Gabarito[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [availableDisciplinas, setAvailableDisciplinas] = useState<string[]>([]);

    // Form states
    const [numQuestions, setNumQuestions] = useState(10);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [assunto, setAssunto] = useState('');
    const [disciplina, setDisciplina] = useState('');
    const [data, setData] = useState(new Date().toLocaleDateString('pt-BR'));
    const [editingId, setEditingId] = useState<number | null>(null);

    // Printing & Scanning
    const [printData, setPrintData] = useState<{ gabarito: Gabarito, turmaNome: string } | null>(null);
    const [activeScanner, setActiveScanner] = useState<{ id: number, numQuestions: number } | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [batchProcessing, setBatchProcessing] = useState(false);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Gabarito_${printData?.gabarito.assunto || 'Prova'}`,
    });

    useEffect(() => {
        if (printData) {
            handlePrint();
            setPrintData(null);
        }
    }, [printData, handlePrint]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [turmasData, gabaritosData, disciplinasData] = await Promise.all([
                api.getTurmas(),
                api.getGabaritos(),
                api.getDisciplinas()
            ]);
            setTurmas(turmasData);
            setGabaritos(gabaritosData);
            setAvailableDisciplinas(disciplinasData);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (qIdx: number, val: string) => {
        setAnswers(prev => ({ ...prev, [qIdx]: val }));
    };

    const handleTurmaToggle = (id: number) => {
        setSelectedTurmaIds(prev =>
            prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        const totalAnswers = Object.keys(answers).length;
        if (totalAnswers < numQuestions) {
            alert('Por favor, preencha todas as respostas antes de salvar.');
            return;
        }

        if (selectedTurmaIds.length === 0) {
            alert('Por favor, selecione pelo menos uma turma.');
            return;
        }

        if (!assunto.trim() || !disciplina.trim() || !data.trim()) {
            alert('Por favor, preencha o assunto, disciplina e data.');
            return;
        }

        try {
            const gabaritoArray = Array.from({ length: numQuestions }).map((_, i) => answers[i]);
            const payload = {
                turma_ids: selectedTurmaIds,
                assunto,
                disciplina,
                data,
                num_questoes: numQuestions,
                respostas: gabaritoArray
            };

            if (editingId) {
                await api.updateGabarito(editingId, payload);
                alert('Gabarito atualizado com sucesso!');
            } else {
                await api.addGabarito(payload);
                alert('Gabarito salvo com sucesso!');
            }

            loadData();
            handleReset();
            setViewMode('history');
        } catch (error) {
            console.error('Erro ao salvar gabarito:', error);
            alert('Erro ao salvar gabarito');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Deseja realmente excluir este gabarito?')) return;
        try {
            await api.deleteGabarito(id);
            loadData();
        } catch (error) {
            console.error('Erro ao excluir gabarito:', error);
            alert('Erro ao excluir gabarito');
        }
    };

    const handleBatchUpload = async (event: React.ChangeEvent<HTMLInputElement>, g: Gabarito) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setBatchProcessing(true);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();

            const processFile = () => new Promise<void>((resolve) => {
                reader.onload = async (e) => {
                    const base64 = e.target?.result as string;
                    try {
                        const res = await api.processarProva({
                            image: base64,
                            num_questions: g.num_questoes,
                            gabarito_id: g.id
                        });
                        if (res.success) successCount++;
                        else failCount++;
                    } catch {
                        failCount++;
                    }
                    resolve();
                };
                reader.readAsDataURL(file);
            });

            await processFile();
        }

        setBatchProcessing(false);
        alert(`Processamento em Lote concluído!\nSucesso: ${successCount}\nFalhas: ${failCount}`);
        loadData();
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleReset = () => {
        setEditingId(null);
        setAnswers({});
        setAssunto('');
        setDisciplina('');
        setData(new Date().toLocaleDateString('pt-BR'));
        setSelectedTurmaIds([]);
        setNumQuestions(10);
    };

    const handleEdit = (g: Gabarito) => {
        setEditingId(g.id);
        setAssunto(g.assunto);
        setDisciplina(g.disciplina || '');
        setData(g.data);
        setNumQuestions(g.num_questoes);

        try {
            const parsedRespostas = JSON.parse(g.respostas_corretas);
            const answersObj: Record<number, string> = {};
            parsedRespostas.forEach((ans: string, i: number) => {
                answersObj[i] = ans;
            });
            setAnswers(answersObj);
        } catch (e) {
            console.error('Erro ao carregar respostas', e);
        }

        if (g.turma_ids) {
            setSelectedTurmaIds(g.turma_ids);
        } else if (g.turma_id) {
            setSelectedTurmaIds([g.turma_id]);
        }

        setViewMode('create');
    };

    const filteredGabaritos = gabaritos.filter(g =>
        (g.assunto?.toLowerCase() || '').includes(searchText.toLowerCase()) ||
        (g.disciplina?.toLowerCase() || '').includes(searchText.toLowerCase()) ||
        (g.turma_nome?.toLowerCase() || '').includes(searchText.toLowerCase())
    );

    const renderOption = (qIdx: number, option: string) => {
        const isSelected = answers[qIdx] === option;
        return (
            <button
                key={option}
                className={`option-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(qIdx, option)}
            >
                {option}
            </button>
        );
    };

    return (
        <div className="gabarito-container">
            <div className="gabarito-header">
                <div className="header-info">
                    <ClipboardList size={24} color="#10b981" />
                    <h1 className="gabarito-title">Gabaritos</h1>
                </div>
                {editingId && (
                    <div className="status-badge" style={{ background: '#3b82f6' }}>
                        <span>Editando</span>
                    </div>
                )}
            </div>

            <div className="tab-container">
                <button
                    className={`tab ${viewMode === 'history' ? 'active' : ''}`}
                    onClick={() => setViewMode('history')}
                >
                    <HistoryIcon size={18} />
                    <span>Cadastrados</span>
                </button>
                <button
                    className={`tab ${viewMode === 'create' ? 'active' : ''}`}
                    onClick={() => setViewMode('create')}
                >
                    <Plus size={18} />
                    <span>Novo Gabarito</span>
                </button>
            </div>

            <div className="gabarito-content">
                {viewMode === 'history' ? (
                    <div className="history-section">
                        <div className="search-bar">
                            <Search size={20} />
                            <input
                                type="text"
                                placeholder="Buscar gabarito por assunto ou turma..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <p className="empty-text">Carregando...</p>
                        ) : filteredGabaritos.length > 0 ? (
                            filteredGabaritos.map(g => (
                                <div key={g.id} className="history-card">
                                    <div className="history-info">
                                        <h3 className="history-turma">{g.turma_nome || 'Todas as Turmas'}</h3>
                                        <div className="history-meta">
                                            <span>{g.assunto}</span>
                                            {g.disciplina && (
                                                <>
                                                    <span className="dot">•</span>
                                                    <span>{g.disciplina}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="history-meta">
                                            <Calendar size={12} />
                                            <span>{g.data}</span>
                                            <span className="dot">•</span>
                                            <span>{g.num_questoes} questões</span>
                                        </div>
                                    </div>

                                    <div className="history-divider"></div>

                                    <div className="history-actions">
                                        <button className="action-btn edit" onClick={() => handleEdit(g)}>
                                            <Edit3 size={20} />
                                            <span>Editar</span>
                                        </button>
                                        <button className="action-btn scan" onClick={() => setActiveScanner({ id: g.id, numQuestions: g.num_questoes })}>
                                            <Camera size={20} />
                                            <span>Corrigir</span>
                                        </button>
                                        <button className="action-btn upload" onClick={() => fileInputRef.current?.click()}>
                                            <Upload size={20} />
                                            <span>Lote</span>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                style={{ display: 'none' }}
                                                multiple
                                                accept="image/*"
                                                onChange={(e) => handleBatchUpload(e, g)}
                                            />
                                        </button>
                                        <button className="action-btn download" onClick={() => setPrintData({ gabarito: g, turmaNome: g.turma_nome || 'Todas as Turmas' })}>
                                            <Download size={20} />
                                            <span>Cartões</span>
                                        </button>
                                        <button className="action-btn delete" onClick={() => handleDelete(g.id)}>
                                            <Trash2 size={20} />
                                            <span>Excluir</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-history">
                                <ClipboardList size={48} color="#cbd5e1" />
                                <p>Nenhum gabarito cadastrado.</p>
                                <button className="empty-btn" onClick={() => setViewMode('create')}>
                                    Criar Primeiro Gabarito
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="create-section">
                        <div className="config-card">
                            <h2 className="section-title">Nova Avaliação</h2>

                            <label className="label">1. Selecione a(s) Turma(s) *</label>
                            <div className="turma-scroll">
                                {turmas.map(t => (
                                    <button
                                        key={t.id}
                                        className={`turma-badge ${selectedTurmaIds.includes(t.id) ? 'active' : ''}`}
                                        onClick={() => handleTurmaToggle(t.id)}
                                    >
                                        {t.nome}
                                    </button>
                                ))}
                            </div>

                            <label className="label">2. Detalhes da Prova</label>

                            <div className="input-group">
                                <Layout size={20} />
                                <input
                                    type="text"
                                    placeholder="Título (ex: Prova Bimestral) *"
                                    value={assunto}
                                    onChange={(e) => setAssunto(e.target.value)}
                                />
                            </div>

                            <div className="input-group">
                                <BookOpen size={20} />
                                <input
                                    type="text"
                                    placeholder="Disciplina (ex: Matemática) *"
                                    value={disciplina}
                                    onChange={(e) => setDisciplina(e.target.value)}
                                    list="disciplinas-list"
                                />
                                <datalist id="disciplinas-list">
                                    {availableDisciplinas.map(d => <option key={d} value={d} />)}
                                </datalist>
                            </div>

                            <div className="input-row">
                                <div className="input-group">
                                    <Calendar size={20} />
                                    <input
                                        type="text"
                                        placeholder="Data *"
                                        value={data}
                                        onChange={(e) => setData(e.target.value)}
                                    />
                                </div>
                                <div className="input-group">
                                    <CheckSquare size={20} />
                                    <input
                                        type="number"
                                        placeholder="Qtd. Questões"
                                        value={numQuestions}
                                        onChange={(e) => {
                                            const n = parseInt(e.target.value) || 0;
                                            setNumQuestions(Math.min(n, 100));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="questions-grid">
                            {Array.from({ length: numQuestions }).map((_, i) => (
                                <div key={i} className="question-row">
                                    <span className="question-num">{String(i + 1).padStart(2, '0')}</span>
                                    <div className="options">
                                        {['A', 'B', 'C', 'D', 'E'].map(opt => renderOption(i, opt))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {viewMode === 'create' && (
                <div className="gabarito-footer">
                    <button className="save-btn" onClick={handleSave}>
                        <Save size={20} />
                        <span>{editingId ? 'Atualizar Gabarito' : 'Salvar Gabarito'}</span>
                    </button>
                    {editingId && (
                        <button className="reset-btn" onClick={handleReset} style={{ marginLeft: '10px', background: '#94a3b8' }}>
                            <span>Cancelar Edição</span>
                        </button>
                    )}
                </div>
            )}

            {/* Hidden Printable Area */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {printData && (
                        <GabaritoTemplate
                            gabarito={printData.gabarito}
                            turmaNome={printData.turmaNome}
                        />
                    )}
                </div>
            </div>

            {/* Scanner Modal */}
            {activeScanner && (
                <ScannerModal
                    onClose={() => setActiveScanner(null)}
                    gabaritoId={activeScanner.id}
                    numQuestions={activeScanner.numQuestions}
                    onSuccess={() => loadData()}
                />
            )}

            {/* Batch Processing Overlay */}
            {batchProcessing && (
                <div className="batch-overlay">
                    <div className="batch-loader">
                        <div className="spinner"></div>
                        <p>Processando lote de provas... Por favor, aguarde.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
