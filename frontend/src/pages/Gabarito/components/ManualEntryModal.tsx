import React, { useState, useEffect } from 'react';
import { Save, ChevronRight, ArrowLeft, User } from 'lucide-react';
import { api } from '../../../services/api';
import './ManualEntryModal.css';

interface ManualEntryModalProps {
    gabarito: any;
    turmas: any[];
    onClose: () => void;
    onSuccess: () => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ gabarito, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [alunos, setAlunos] = useState<any[]>([]);
    const [resultados, setResultados] = useState<any[]>([]);
    const [selectedAlunoId, setSelectedAlunoId] = useState<number | null>(null);
    const [manualNota, setManualNota] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [gabarito]);

    const loadData = async () => {
        try {
            setLoading(true);
            const tIds = gabarito.turma_ids || (gabarito.turma_id ? [gabarito.turma_id] : []);

            const [alunosArrays, resultsData] = await Promise.all([
                Promise.all(tIds.map((tId: number) => api.getAlunosByTurma(tId))),
                api.getResultadosByGabarito(gabarito.id)
            ]);

            const allAlunos = alunosArrays.flat();
            const uniqueAlunos = allAlunos.filter((a, index, self) =>
                index === self.findIndex((t) => t.id === a.id)
            );

            setAlunos(uniqueAlunos.sort((a, b) => a.nome.localeCompare(b.nome)));
            setResultados(resultsData);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAluno = (id: number) => {
        const existingResult = resultados.find(r => r.aluno_id === id);
        setSelectedAlunoId(id);
        setManualNota(existingResult ? existingResult.nota.toString() : '');
        setStep(2);
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
                    nota: val
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
                            <h2 className="manual-entry-title">Lançamento de Nota</h2>
                            <p className="manual-entry-subtitle">{gabarito.titulo || gabarito.assunto} • {gabarito.num_questoes} q.</p>
                        </div>
                    </div>
                </div>

                <div className="manual-entry-body" style={{ padding: step === 1 ? '24px' : '32px' }}>
                    {step === 1 ? (
                        <>
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
                                                <ChevronRight size={16} color="#64748b" />
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
                                <input
                                    type="text"
                                    autoFocus
                                    className="nota-large-field"
                                    inputMode="decimal"
                                    placeholder="0.0"
                                    value={manualNota}
                                    onChange={(e) => setManualNota(e.target.value)}
                                />
                                <p className="nota-help-text">Insira a nota final de 0 a 10</p>
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
