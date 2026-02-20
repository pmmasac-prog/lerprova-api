import React, { useState, useEffect } from 'react';
import { Save, User, ChevronRight, ArrowLeft } from 'lucide-react';
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
        if (selectedAlunoId === null || manualNota === '') {
            alert('Por favor, informe a nota e selecione um aluno.');
            return;
        }

        setLoading(true);
        try {
            const val = parseFloat(manualNota.replace(',', '.'));
            const existingResult = resultados.find(r => r.aluno_id === selectedAlunoId);

            if (existingResult) {
                // Se já existe, atualizamos
                await api.updateResultado(existingResult.id, { nota: val });
            } else {
                // Se não existe, criamos novo
                const payload = {
                    aluno_id: selectedAlunoId,
                    gabarito_id: gabarito.id, // Corrected from selectedGabaritoId to gabarito.id
                    nota: val
                };
                await api.addResultadoManual(payload);
            }

            // Notificar sucesso e carregar dados
            if (onSuccess) onSuccess();
            await loadData(); // Ensure data is reloaded after save

            // Voltar para a lista em vez de fechar, para permitir lançar para outro aluno
            setStep(1);
            setSelectedAlunoId(null);
            setManualNota('');
        } catch (error) {
            console.error('Erro ao salvar nota:', error);
            alert('Erro ao salvar nota. Verifique os dados.');
        } finally {
            setLoading(false);
        }
    };

    const selectedAluno = alunos.find(a => a.id === selectedAlunoId);

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <div className="header-info-modal">
                        {step === 2 && (
                            <button className="back-btn-modal" onClick={() => setStep(1)} title="Voltar para lista">
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div>
                            <h2 className="modal-title">Lançamento de Nota</h2>
                            <p className="modal-subtitle">{gabarito.titulo || gabarito.assunto} • {gabarito.num_questoes} questões</p>
                        </div>
                    </div>
                </div>

                <div className="modal-body-p-0">
                    {step === 1 ? (
                        <div className="modal-inner">
                            <label className="label">1. Selecione o Aluno</label>
                            <div className="search-box">
                                <User size={18} color="#94a3b8" />
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Buscar aluno pelo nome..."
                                    value={searchAluno}
                                    onChange={(e) => setSearchAluno(e.target.value)}
                                />
                            </div>
                            <div className="student-list-container">
                                {alunos.filter(a => a.nome.toLowerCase().includes(searchAluno.toLowerCase())).map(a => {
                                    const resultado = resultados.find(r => r.aluno_id === a.id);
                                    const hasNota = resultado !== undefined;
                                    const notaValue = hasNota ? parseFloat(resultado.nota) : 0;

                                    return (
                                        <div
                                            key={a.id}
                                            onClick={() => handleSelectAluno(a.id)}
                                            className={`student-item-row ${hasNota ? 'has-result' : ''}`}
                                        >
                                            <div className="student-info-mini">
                                                <div className="student-name-mini">{a.nome}</div>
                                                <div className="student-code-mini">Cód: {a.codigo}</div>
                                            </div>

                                            {hasNota && (
                                                <div className="student-nota-badge">
                                                    {notaValue.toFixed(1)}
                                                </div>
                                            )}

                                            <ChevronRight size={18} className="chevron-icon" />
                                        </div>
                                    );
                                })}
                                {alunos.length === 0 && <p className="empty-text">Nenhum aluno encontrado para as turmas deste gabarito.</p>}
                            </div>

                            <div className="modal-actions-footer">
                                <button className="finish-btn w-full" onClick={onClose}>
                                    Fechar Janela
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="modal-inner">
                            <div className="student-header-context">
                                <div className="mini-stat-label">Aluno Selecionado</div>
                                <div className="mini-stat-value">{selectedAluno?.nome}</div>
                            </div>

                            <div className="nota-entry-container">
                                <label className="label text-center block mb-6">
                                    Nota Final (0 a 10)
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    className="nota-large-input"
                                    inputMode="decimal"
                                    placeholder="0.0"
                                    value={manualNota}
                                    onChange={(e) => setManualNota(e.target.value)}
                                />
                            </div>

                            <div className="modal-actions-footer gap-4">
                                <button className="finish-btn flex-1" onClick={() => setStep(1)}>
                                    Alterar Aluno
                                </button>
                                <button className="save-btn flex-2" onClick={handleSave} disabled={loading}>
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
