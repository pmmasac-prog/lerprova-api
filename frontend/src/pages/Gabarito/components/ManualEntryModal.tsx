import React, { useState, useEffect } from 'react';
import { Save, ChevronRight, ArrowLeft } from 'lucide-react';
import { api } from '../../../services/api';
import './ManualEntryModal.css';

interface ManualEntryModalProps {
    gabarito: any;
    turmas: any[];
    onClose: () => void;
    onSuccess: () => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ gabarito, turmas, onClose, onSuccess }) => {
    const [step, setStep] = useState(0); // 0: Select Turma (if multiple), 1: Select Aluno, 2: Enter Nota
    const [alunos, setAlunos] = useState<any[]>([]);
    const [resultados, setResultados] = useState<any[]>([]);
    const [selectedTurmaId, setSelectedTurmaId] = useState<number | null>(null);
    const [selectedAlunoId, setSelectedAlunoId] = useState<number | null>(null);
    const [manualNota, setManualNota] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [availableTurmas, setAvailableTurmas] = useState<any[]>([]);
    const [registrarPresenca, setRegistrarPresenca] = useState(true);
    const [showAddAluno, setShowAddAluno] = useState(false);
    const [newAlunoNome, setNewAlunoNome] = useState('');

    useEffect(() => {
        loadData();
    }, [gabarito]);

    const loadData = async () => {
        try {
            setLoading(true);
            const tIds = gabarito.turma_ids || (gabarito.turma_id ? [gabarito.turma_id] : []);
            
            // Map available turmas from the IDs and the 'turmas' prop
            const linkedTurmas = turmas.filter(t => tIds.includes(t.id));
            setAvailableTurmas(linkedTurmas);

            // If only one turma, skip step 0
            if (linkedTurmas.length === 1) {
                const singleTurmaId = linkedTurmas[0].id;
                setSelectedTurmaId(singleTurmaId);
                await loadAlunos(singleTurmaId);
                setStep(1);
            } else if (linkedTurmas.length > 1) {
                setStep(0);
            }

            const resultsData = await api.getResultadosByGabarito(gabarito.id);
            setResultados(resultsData);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadAlunos = async (turmaId: number) => {
        try {
            setLoading(true);
            const alunosData = await api.getAlunosByTurma(turmaId);
            setAlunos(alunosData.sort((a: any, b: any) => a.nome.localeCompare(b.nome)));
        } catch (err) {
            console.error('Erro ao carregar alunos:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTurma = async (id: number) => {
        setSelectedTurmaId(id);
        await loadAlunos(id);
        setStep(1);
    };

    const handleSelectAluno = (id: number) => {
        const existingResult = resultados.find(r => r.aluno_id === id);
        setSelectedAlunoId(id);
        setManualNota(existingResult ? existingResult.nota.toString() : '');
        setStep(2);
    };

    const handleAddAluno = async () => {
        if (!newAlunoNome || !selectedTurmaId) return;
        setLoading(true);
        try {
            const novo = await api.addAluno({
                nome: newAlunoNome,
                turma_id: selectedTurmaId,
                codigo: Math.floor(1000 + Math.random() * 9000).toString() // Código temporário
            });
            await loadAlunos(selectedTurmaId);
            setShowAddAluno(false);
            setNewAlunoNome('');
            handleSelectAluno(novo.id);
        } catch (err) {
            console.error('Erro ao adicionar aluno:', err);
            alert('Erro ao adicionar aluno.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (selectedAlunoId === null || manualNota === '') {
            alert('Por favor, informe a nota.');
            return;
        }

        setLoading(true);
        try {
            const val = parseFloat(manualNota.replace(',', '.'));
            const existingResult = resultados.find(r => r.aluno_id === selectedAlunoId);

            if (existingResult) {
                await api.updateResultado(existingResult.id, { nota: val });
            } else {
                const payload = {
                    aluno_id: selectedAlunoId,
                    gabarito_id: gabarito.id,
                    nota: val,
                    registrar_presenca: registrarPresenca
                };
                await api.addResultadoManual(payload);
            }

            if (onSuccess) onSuccess();
            await loadData();
            setStep(1);
            setSelectedAlunoId(null);
            setManualNota('');
        } catch (error) {
            console.error('Erro ao salvar nota:', error);
            alert('Erro ao salvar nota.');
        } finally {
            setLoading(false);
        }
    };

    const selectedAluno = alunos.find(a => a.id === selectedAlunoId);

    return (
        <div className="manual-entry-overlay" onClick={onClose}>
            <div className="manual-entry-container" onClick={(e) => e.stopPropagation()}>
                <div className="manual-entry-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {(step === 1 && availableTurmas.length > 1) && (
                            <button
                                className="btn-back-manual"
                                style={{ padding: '8px', width: 'auto' }}
                                onClick={() => setStep(0)}
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                className="btn-back-manual"
                                style={{ padding: '8px', width: 'auto' }}
                                onClick={() => setStep(1)}
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div>
                            <h2 className="manual-entry-title">
                                {step === 0 ? 'Selecionar Turma' : 'Lançamento de Nota'}
                            </h2>
                            <p className="manual-entry-subtitle">
                                {gabarito.titulo || gabarito.assunto}
                                {selectedTurmaId && ` • ${availableTurmas.find(t => t.id === selectedTurmaId)?.nome}`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="manual-entry-body" style={{ padding: step === 2 ? '32px' : '24px' }}>
                    {step === 0 ? (
                        <div className="manual-turma-list">
                            {availableTurmas.map((t) => (
                                <div
                                    key={t.id}
                                    onClick={() => handleSelectTurma(t.id)}
                                    className="manual-turma-item"
                                >
                                    <div className="manual-turma-icon">
                                        <ChevronRight size={18} />
                                    </div>
                                    <div className="manual-turma-info">
                                        <div className="manual-turma-name">{t.nome}</div>
                                        <div className="manual-turma-discipline">{t.disciplina || 'Geral'}</div>
                                    </div>
                                    <ChevronRight size={16} color="var(--color-text-muted)" />
                                </div>
                            ))}
                        </div>
                    ) : step === 1 ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div className="manual-entry-subtitle">Selecione o Aluno</div>
                                <button 
                                    className="btn-add-aluno-manual"
                                    onClick={() => setShowAddAluno(true)}
                                >
                                    + Aluno
                                </button>
                            </div>

                            {showAddAluno && (
                                <div className="add-aluno-inline">
                                    <input 
                                        type="text" 
                                        placeholder="Nome do Aluno"
                                        value={newAlunoNome}
                                        onChange={(e) => setNewAlunoNome(e.target.value)}
                                        className="nota-large-field"
                                        style={{ fontSize: '1rem', padding: '10px' }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn-save-manual" onClick={handleAddAluno} disabled={loading}>
                                            Salvar
                                        </button>
                                        <button className="btn-back-manual" onClick={() => setShowAddAluno(false)}>
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="manual-student-list">
                                {alunos.map((a) => {
                                    const resultado = resultados.find(r => r.aluno_id === a.id);
                                    const hasNota = resultado !== undefined;
                                    const notaValue = hasNota ? parseFloat(resultado.nota) : 0;

                                    return (
                                        <div
                                            key={a.id}
                                            onClick={() => handleSelectAluno(a.id)}
                                            className={`manual-student-item ${hasNota ? 'has-result' : ''}`}
                                        >
                                            <div className="manual-student-avatar">
                                                {a.nome.charAt(0)}
                                            </div>
                                            <div className="manual-student-info">
                                                <div className="manual-student-name">{a.nome}</div>
                                                <div className="manual-student-code">#{a.codigo}</div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {hasNota && (
                                                    <div className="manual-nota-badge">
                                                        {notaValue.toFixed(1)}
                                                    </div>
                                                )}
                                                <ChevronRight size={16} color="var(--color-text-muted)" />
                                            </div>
                                        </div>
                                    );
                                })}
                                {alunos.length === 0 && <p className="nota-help-text" style={{ textAlign: 'center' }}>Nenhum aluno encontrado.</p>}
                            </div>
                        </>
                    ) : (
                        <div className="nota-entry-card">
                            <div className="selected-student-label">Aluno Selecionado</div>
                            <div className="selected-student-name">{selectedAluno?.nome}</div>

                            <div className="nota-input-wrapper">
                                <label htmlFor="manual-nota-input" className="selected-student-label" style={{ marginBottom: '6px', display: 'block' }}>Nota</label>
                                <input
                                    id="manual-nota-input"
                                    name="manual-nota-input"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    autoFocus
                                    className="nota-large-field"
                                    inputMode="decimal"
                                    placeholder="0.0"
                                    value={manualNota}
                                    onChange={(e) => setManualNota(e.target.value)}
                                />
                                <p className="nota-help-text">Insira a nota final de 0 a 10</p>
                            </div>

                            <div className="presence-toggle-wrapper" onClick={() => setRegistrarPresenca(!registrarPresenca)}>
                                <div className={`presence-toggle ${registrarPresenca ? 'active' : ''}`}>
                                    <div className="presence-toggle-handle"></div>
                                </div>
                                <div className="presence-toggle-label">
                                    Registrar presença para hoje
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="manual-entry-footer">
                    <button className="btn-back-manual" onClick={onClose}>
                        Fechar
                    </button>
                    {step === 2 && (
                        <button className="btn-save-manual" onClick={handleSave} disabled={loading}>
                            <Save size={20} />
                            <span>{loading ? 'Salvando...' : 'Gravar Nota'}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
