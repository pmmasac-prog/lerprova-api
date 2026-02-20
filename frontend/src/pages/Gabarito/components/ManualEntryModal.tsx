import React, { useState, useEffect } from 'react';
import { Save, User, ChevronRight, ArrowLeft, Search } from 'lucide-react';
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
    const [searchAluno, setSearchAluno] = useState('');

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {step === 2 && (
                            <button className="back-btn" onClick={() => setStep(1)} style={{ width: '32px', height: '32px', borderRadius: '50%' }}>
                                <ArrowLeft size={16} />
                            </button>
                        )}
                        <div>
                            <h2 className="manual-entry-title">Lançamento Manual</h2>
                            <p className="manual-entry-subtitle">{gabarito.titulo || gabarito.assunto} • {gabarito.num_questoes} q.</p>
                        </div>
                    </div>
                </div>

                <div className="manual-entry-body">
                    {step === 1 ? (
                        <>
                            <div className="student-search-container">
                                <Search className="student-search-icon" size={18} />
                                <input
                                    type="text"
                                    className="student-search-input"
                                    placeholder="Procurar aluno..."
                                    value={searchAluno}
                                    onChange={(e) => setSearchAluno(e.target.value)}
                                />
                            </div>

                            <div className="manual-student-list">
                                {alunos.filter(a => a.nome.toLowerCase().includes(searchAluno.toLowerCase())).map((a, idx) => {
                                    const resultado = resultados.find(r => r.aluno_id === a.id);
                                    const hasNota = resultado !== undefined;
                                    const notaValue = hasNota ? parseFloat(resultado.nota) : 0;

                                    return (
                                        <div
                                            key={a.id}
                                            onClick={() => handleSelectAluno(a.id)}
                                            className={`manual-student-item ${hasNota ? 'has-result' : ''}`}
                                        >
                                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', width: '20px' }}>
                                                {(idx + 1).toString().padStart(2, '0')}
                                            </span>
                                            <div className="manual-student-avatar">
                                                {a.nome.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="manual-student-info">
                                                <div className="manual-student-name">{a.nome}</div>
                                                <div className="manual-student-code">#{a.codigo}</div>
                                            </div>

                                            {hasNota && (
                                                <div className="manual-nota-badge">
                                                    {notaValue.toFixed(1)}
                                                </div>
                                            )}
                                            <ChevronRight size={18} color="#334155" />
                                        </div>
                                    );
                                })}
                                {alunos.length === 0 && <p className="empty-hint">Nenhum aluno encontrado.</p>}
                            </div>
                        </>
                    ) : (
                        <div className="nota-entry-card">
                            <div className="selected-student-label">Lançando para</div>
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
                                <div className="nota-help-text">Nota Final (0-10)</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="manual-entry-footer">
                    {step === 1 ? (
                        <button className="btn-back-manual" style={{ flex: 1 }} onClick={onClose}>Fechar</button>
                    ) : (
                        <>
                            <button className="btn-back-manual" onClick={() => setStep(1)}>Voltar</button>
                            <button className="btn-save-manual" onClick={handleSave} disabled={loading}>
                                <Save size={18} />
                                <span>{loading ? 'Gravando...' : 'Confirmar Nota'}</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
