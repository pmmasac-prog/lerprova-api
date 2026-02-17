import React, { useState, useEffect } from 'react';
import { X, Save, User, ChevronRight } from 'lucide-react';
import { api } from '../../../services/api';

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

            // Carregar alunos e resultados em paralelo
            const [alunosArrays, resultsData] = await Promise.all([
                Promise.all(tIds.map((tId: number) => api.getAlunosByTurma(tId))),
                api.getResultadosByGabarito(gabarito.id)
            ]);

            // Achatar lista de alunos e remover duplicatas
            const allAlunos = alunosArrays.flat();
            const uniqueAlunos = allAlunos.filter((a, index, self) =>
                index === self.findIndex((t) => t.id === a.id)
            );

            setAlunos(uniqueAlunos);
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
        if (!selectedAlunoId) return;
        if (!manualNota) {
            alert('Por favor, informe a nota.');
            return;
        }
        setLoading(true);
        try {
            const payload: any = {
                aluno_id: selectedAlunoId,
                gabarito_id: gabarito.id,
                nota: parseFloat(manualNota.replace(',', '.')),
            };

            await api.addResultadoManual(payload);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao registrar resultado');
        } finally {
            setLoading(false);
        }
    };

    const selectedAluno = alunos.find(a => a.id === selectedAlunoId);

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <div>
                        <h2>Lançamento de Nota</h2>
                        <p className="admin-subtitle">{gabarito.titulo || gabarito.assunto} • {gabarito.num_questoes} questões</p>
                    </div>
                    <button className="close-btn" onClick={onClose}><X /></button>
                </div>

                <div className="admin-form">
                    {step === 1 ? (
                        <div className="step-selection">
                            <label className="label">1. Selecione o Aluno</label>
                            <div className="search-box" style={{ marginBottom: '15px' }}>
                                <User size={18} color="#94a3b8" />
                                <input
                                    type="text"
                                    placeholder="Buscar aluno pelo nome..."
                                    value={searchAluno}
                                    onChange={(e) => setSearchAluno(e.target.value)}
                                />
                            </div>
                            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                {alunos.filter(a => a.nome.toLowerCase().includes(searchAluno.toLowerCase())).map(a => {
                                    const resultado = resultados.find(r => r.aluno_id === a.id);
                                    const hasNota = resultado !== undefined;
                                    const notaValue = hasNota ? parseFloat(resultado.nota) : 0;
                                    const notaColor = notaValue > 5.9 ? '#2563eb' : '#dc2626'; // Azul ou Vermelho

                                    return (
                                        <div
                                            key={a.id}
                                            onClick={() => handleSelectAluno(a.id)}
                                            style={{
                                                padding: '12px 15px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'all 0.2s',
                                                background: hasNota ? '#f8fafc' : 'transparent'
                                            }}
                                            className="student-item"
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>{a.nome}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>Cód: {a.codigo}</div>
                                            </div>

                                            {hasNota && (
                                                <div style={{
                                                    marginRight: '15px',
                                                    padding: '4px 10px',
                                                    borderRadius: '8px',
                                                    background: 'white',
                                                    border: `1px solid ${notaColor}`,
                                                    color: notaColor,
                                                    fontWeight: '800',
                                                    fontSize: '14px'
                                                }}>
                                                    {notaValue.toFixed(1)}
                                                </div>
                                            )}

                                            <ChevronRight size={18} color="#94a3b8" />
                                        </div>
                                    );
                                })}
                                {alunos.length === 0 && <p style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Nenhum aluno encontrado para as turmas deste gabarito.</p>}
                            </div>

                            <div className="form-actions" style={{ marginTop: '20px' }}>
                                <button className="reset-btn" onClick={onClose}>Cancelar</button>
                            </div>
                        </div>
                    ) : (
                        <div className="step-answers">
                            <div className="stats-row" style={{ marginBottom: '30px', background: '#f8fafc', padding: '20px' }}>
                                <div className="mini-stat">
                                    <div className="mini-stat-value" style={{ fontSize: '18px' }}>{selectedAluno?.nome}</div>
                                    <div className="mini-stat-label">Aluno Selecionado</div>
                                </div>
                            </div>

                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <label className="label" style={{ fontSize: '16px', marginBottom: '20px', display: 'block' }}>
                                    Digite a Nota Final (0 a 10)
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    inputMode="decimal"
                                    placeholder="0.0"
                                    value={manualNota}
                                    onChange={(e) => setManualNota(e.target.value)}
                                    style={{
                                        width: '150px',
                                        height: '80px',
                                        fontSize: '48px',
                                        textAlign: 'center',
                                        border: '3px solid #3b82f6',
                                        borderRadius: '20px',
                                        fontWeight: '900',
                                        color: '#1e293b',
                                        boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div className="form-actions" style={{ marginTop: '40px' }}>
                                <button className="reset-btn" onClick={() => setStep(1)} style={{ background: '#f1f5f9', color: '#64748b' }}>
                                    Alterar Aluno
                                </button>
                                <button className="save-btn" onClick={handleSave} disabled={loading} style={{ padding: '0 30px' }}>
                                    <Save size={20} />
                                    <span>{loading ? 'Salvando...' : 'Gravar Nota'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
