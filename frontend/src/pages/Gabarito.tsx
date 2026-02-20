import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Trash2, Camera, Clock,
    BookOpen, Layout,
    Save, Search, Upload, Download,
    ClipboardList, PenLine, Keyboard,
    Calendar, CheckSquare, ArrowLeft
} from 'lucide-react';
import { api } from '../services/api';
import { useReactToPrint } from 'react-to-print';
import { GabaritoTemplate } from './Gabarito/components/GabaritoTemplate';
import { ScannerModal } from './Gabarito/components/ScannerModal';
import { ManualEntryModal } from './Gabarito/components/ManualEntryModal';
import './Gabarito.css';

interface Turma {
    id: number;
    nome: string;
}

interface Gabarito {
    id: number;
    assunto: string;
    num_questoes: number;
    turma_ids?: number[];
    turma_id?: number;
    turma_nome?: string;
    periodo: number;
    data: string;
    respostas_corretas: string;
    disciplina?: string;
}

export function Gabarito() {
    const [viewMode, setViewMode] = useState<'history' | 'create'>('history');
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [gabaritos, setGabaritos] = useState<Gabarito[]>([]);
    const [searchText, setSearchText] = useState('');

    // Form data
    const [assunto, setAssunto] = useState('');
    const [disciplina, setDisciplina] = useState('');
    const [availableDisciplinas, setAvailableDisciplinas] = useState<string[]>([]);
    const [data, setData] = useState(new Date().toLocaleDateString('pt-BR'));
    const [selectedTurmaIds, setSelectedTurmaIds] = useState<number[]>([]);
    const [numQuestions, setNumQuestions] = useState(10);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [periodo, setPeriodo] = useState<number>(1);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [filterTurmaId, setFilterTurmaId] = useState<number | null>(null);
    const [filterPeriodo, setFilterPeriodo] = useState<number | null>(null);

    // Printing & Scanning
    const [printData, setPrintData] = useState<{
        gabarito: Gabarito,
        items: { student: any, turmaNome: string }[]
    } | null>(null);
    const [activeScanner, setActiveScanner] = useState<{ id: number, numQuestions: number } | null>(null);
    const [manualEntryGabarito, setManualEntryGabarito] = useState<Gabarito | null>(null);
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
            const [turmasData, gabaritosData] = await Promise.all([
                api.getTurmas(),
                api.getGabaritos()
            ]);
            setTurmas(turmasData);
            setGabaritos(gabaritosData);

            const professorDisciplines = Array.from(new Set(turmasData.map((t: any) => t.disciplina).filter(Boolean)));
            setAvailableDisciplinas(professorDisciplines as string[]);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    };

    const handleTurmaToggle = (id: number) => {
        setSelectedTurmaIds(prev =>
            prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
        );
    };

    const handleAnswerChange = (qIndex: number, option: string) => {
        setAnswers(prev => ({ ...prev, [qIndex]: option }));
    };

    const handleSave = async () => {
        if (!assunto || !disciplina || selectedTurmaIds.length === 0) {
            alert('Preencha os campos obrigatórios (*)');
            return;
        }

        try {
            const respostasArray = Array.from({ length: numQuestions }, (_, i) => answers[i] || '');
            const payload = {
                assunto,
                disciplina,
                data,
                num_questoes: numQuestions,
                respostas_corretas: JSON.stringify(respostasArray),
                turma_ids: selectedTurmaIds,
                periodo
            };

            if (editingId) {
                await api.updateGabarito(editingId, payload);
            } else {
                await api.addGabarito(payload);
            }

            setViewMode('history');
            handleReset();
            loadData();
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
        if (failCount > 0) {
            alert(`Processamento em Lote concluído com falhas.\nSucesso: ${successCount}\nFalhas: ${failCount}`);
        }
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
        setPeriodo(1);
    };

    const handleEdit = (g: Gabarito) => {
        setEditingId(g.id);
        setAssunto(g.assunto);
        setDisciplina(g.disciplina || '');
        setData(g.data);
        setNumQuestions(g.num_questoes);
        setPeriodo(g.periodo || 1);

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

    const filteredGabaritos = gabaritos.filter(g => {
        const matchesSearch = (g.assunto?.toLowerCase() || '').includes(searchText.toLowerCase()) ||
            (g.disciplina?.toLowerCase() || '').includes(searchText.toLowerCase()) ||
            (g.turma_nome?.toLowerCase() || '').includes(searchText.toLowerCase());

        const matchesTurma = !filterTurmaId || g.turma_ids?.includes(filterTurmaId) || g.turma_id === filterTurmaId;
        const matchesPeriodo = !filterPeriodo || g.periodo === filterPeriodo;

        return matchesSearch && matchesTurma && matchesPeriodo;
    });

    const handlePreparePrint = async (g: Gabarito) => {
        try {
            const tIds = g.turma_ids || (g.turma_id ? [g.turma_id] : []);
            const allStudents: any[] = [];

            for (const tId of tIds) {
                const sData = await api.getAlunosByTurma(tId);
                const tName = turmas.find(t => t.id === tId)?.nome || 'Turma';
                sData.forEach((s: any) => allStudents.push({ student: s, turmaNome: tName }));
            }

            setPrintData({
                gabarito: g,
                items: allStudents.sort((a, b) => a.student.nome.localeCompare(b.student.nome))
            });
        } catch (err) {
            console.error('Erro ao preparar impressão:', err);
        }
    };

    return (
        <div className="gabarito-container">
            <header className="gabarito-header">
                <div className="header-top">
                    <div className="title-group">
                        <div className="icon-bg icon-blue">
                            <ClipboardList size={22} />
                        </div>
                        <div>
                            <h1>Gabaritos</h1>
                            <p>Gestão de avaliações e correções automáticas</p>
                        </div>
                    </div>
                    <button
                        className={`btn-primary-new ${viewMode === 'create' ? 'active' : ''}`}
                        onClick={() => {
                            if (viewMode === 'create') handleReset();
                            setViewMode(viewMode === 'history' ? 'create' : 'history');
                        }}
                    >
                        {viewMode === 'history' ? <Plus size={20} /> : <ArrowLeft size={20} />}
                        <span>{viewMode === 'history' ? 'Novo Gabarito' : 'Voltar ao Histórico'}</span>
                    </button>
                </div>

                <div className="header-tabs">
                    <button
                        className={`tab-btn ${viewMode === 'history' ? 'active' : ''}`}
                        onClick={() => setViewMode('history')}
                    >
                        Histórico de Provas
                    </button>
                    <button
                        className={`tab-btn ${viewMode === 'create' ? 'active' : ''}`}
                        onClick={() => setViewMode('create')}
                    >
                        {editingId ? 'Editar Gabarito' : 'Configurar Questões'}
                    </button>
                </div>
            </header>

            {viewMode === 'history' ? (
                <div className="history-section">
                    <div className="filters-bar">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por assunto ou disciplina..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                        </div>
                        <select
                            className="filter-select"
                            value={filterTurmaId || ''}
                            onChange={(e) => setFilterTurmaId(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">Todas as Turmas</option>
                            {turmas.map(t => (
                                <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                        </select>
                        <select
                            className="filter-select"
                            value={filterPeriodo || ''}
                            onChange={(e) => setFilterPeriodo(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">Todos Períodos</option>
                            {[1, 2, 3, 4].map(p => (
                                <option key={p} value={p}>{p}º Período</option>
                            ))}
                        </select>
                    </div>

                    <div className="history-grid">
                        {filteredGabaritos.length > 0 ? (
                            filteredGabaritos.map(g => (
                                <div key={g.id} className="history-card">
                                    <div className="card-top">
                                        <div className="card-info">
                                            <h3>{g.assunto}</h3>
                                            <div className="card-meta">
                                                <span className="discipline-badge">{g.disciplina}</span>
                                                <span className="dot">•</span>
                                                <span className="period-badge">{g.periodo}º Período</span>
                                                <span className="dot">•</span>
                                                <span>{g.num_questoes} questões</span>
                                                <span className="dot">•</span>
                                                <span style={{ fontWeight: 'bold', color: '#10b981' }}>{(g as any).total_resultados || 0} correções</span>
                                            </div>
                                        </div>

                                        <button className="primary-scan-btn" onClick={() => setActiveScanner({ id: g.id, numQuestions: g.num_questoes })}>
                                            <div className="icon-wrapper">
                                                <Camera size={22} />
                                            </div>
                                            <div className="btn-text">
                                                <span className="btn-main">Corrigir</span>
                                                <span className="btn-sub">Iniciar Escaner</span>
                                            </div>
                                        </button>
                                    </div>

                                    <div className="history-divider"></div>

                                    <div className="history-actions">
                                        <button className="action-btn edit" onClick={() => handleEdit(g)} title="Editar Gabarito">
                                            <PenLine size={20} />
                                        </button>
                                        <button className="action-btn manual" onClick={() => setManualEntryGabarito(g)} title="Lançamento Manual de Notas">
                                            <Keyboard size={20} />
                                        </button>
                                        <button className="action-btn upload" onClick={() => fileInputRef.current?.click()} title="Envio de Fotos em Lote">
                                            <Upload size={20} />
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                style={{ display: 'none' }}
                                                multiple
                                                accept="image/*"
                                                onChange={(e) => handleBatchUpload(e, g)}
                                            />
                                        </button>
                                        <button className="action-btn download" onClick={() => handlePreparePrint(g)} title="Imprimir Cartões Resposta">
                                            <Download size={20} />
                                        </button>
                                        <button className="action-btn delete" onClick={() => handleDelete(g.id)} title="Excluir Avaliação">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-history">
                                <div className="icon-bg icon-blue mb-4" style={{ width: '80px', height: '80px', borderRadius: '24px' }}>
                                    <ClipboardList size={40} />
                                </div>
                                <p>Nenhum gabarito cadastrado.</p>
                                <button className="empty-btn" onClick={() => setViewMode('create')}>
                                    Criar Primeiro Gabarito
                                </button>
                            </div>
                        )}
                    </div>
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
                                {availableDisciplinas.map(d => (
                                    <option key={d} value={d} />
                                ))}
                            </datalist>
                        </div>

                        <div className="row-group">
                            <div className="input-group">
                                <Calendar size={20} />
                                <input
                                    type="text"
                                    placeholder="Data (dd/mm/aaaa)"
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                />
                            </div>
                            <div className="input-group">
                                <Clock size={20} />
                                <select
                                    value={periodo}
                                    onChange={(e) => setPeriodo(Number(e.target.value))}
                                >
                                    <option value={1}>1º Período</option>
                                    <option value={2}>2º Período</option>
                                    <option value={3}>3º Período</option>
                                    <option value={4}>4º Período</option>
                                </select>
                            </div>
                        </div>

                        <div className="input-group">
                            <CheckSquare size={20} />
                            <label style={{ marginRight: '15px', color: '#94a3b8' }}>Nº de Questões:</label>
                            <select
                                value={numQuestions}
                                onChange={(e) => setNumQuestions(Number(e.target.value))}
                            >
                                {[10, 15, 20, 25, 30, 40, 50].map(n => (
                                    <option key={n} value={n}>{n} questões</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="questions-card">
                        <h2 className="section-title">Gabarito Oficial</h2>
                        <div className="questions-grid">
                            {Array.from({ length: numQuestions }).map((_, i) => (
                                <div key={i} className="question-row">
                                    <span className="q-number">#{String(i + 1).padStart(2, '0')}</span>
                                    <div className="options-group">
                                        {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                            <button
                                                key={opt}
                                                className={`opt-btn ${answers[i] === opt ? 'selected' : ''}`}
                                                onClick={() => handleAnswerChange(i, opt)}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="footer-actions-create">
                            <button className="save-btn-large" onClick={handleSave}>
                                <Save size={22} />
                                <span>{editingId ? 'Salvar Alterações' : 'Criar Gabarito Oficial'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeScanner && (
                <ScannerModal
                    gabaritoId={activeScanner.id}
                    numQuestions={activeScanner.numQuestions}
                    onClose={() => {
                        setActiveScanner(null);
                        loadData();
                    }}
                />
            )}

            {manualEntryGabarito && (
                <ManualEntryModal
                    gabarito={manualEntryGabarito}
                    turmas={turmas}
                    onClose={() => {
                        setManualEntryGabarito(null);
                        loadData();
                    }}
                    onSuccess={() => { }}
                />
            )}

            <div style={{ display: 'none' }}>
                {printData && (
                    <GabaritoTemplate
                        ref={printRef}
                        gabarito={printData.gabarito as any}
                        students={printData.items}
                    />
                )}
            </div>

            {/* Batch Processing Overlay */}
            {
                batchProcessing && (
                    <div className="batch-overlay">
                        <div className="batch-loader">
                            <div className="spinner"></div>
                            <p>Processando lote de provas... Por favor, aguarde.</p>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
