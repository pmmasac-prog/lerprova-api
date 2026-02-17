import React, { useState, useEffect } from 'react';
import { X, Save, User, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
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
    const [selectedAlunoId, setSelectedAlunoId] = useState<number | null>(null);
    const [answers, setAnswers] = useState<string[]>([]);
    const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchAluno, setSearchAluno] = useState('');

    useEffect(() => {
        loadAlunos();
        try {
            const parsedCorretas = JSON.parse(gabarito.respostas_corretas || '[]');
            setCorrectAnswers(parsedCorretas);
            setAnswers(new Array(parsedCorretas.length).fill(""));
        } catch (e) {
            console.error('Erro ao processar gabarito:', e);
        }
    }, [gabarito]);

    const loadAlunos = async () => {
        try {
            const tIds = gabarito.turma_ids || (gabarito.turma_id ? [gabarito.turma_id] : []);
            let allAlunos: any[] = [];
            for (const tId of tIds) {
                const data = await api.getAlunosByTurma(tId);
                allAlunos = [...allAlunos, ...data];
            }
            // Remover duplicatas se houver
            const uniqueAlunos = allAlunos.filter((a, index, self) =>
                index === self.findIndex((t) => t.id === a.id)
            );
            setAlunos(uniqueAlunos);
        } catch (err) {
            console.error('Erro ao carregar alunos:', err);
        }
    };

    const handleSelectOption = (idx: number, val: string) => {
        const newAnswers = [...answers];
        newAnswers[idx] = val;
        setAnswers(newAnswers);
    };

    const handleSave = async () => {
        if (!selectedAlunoId) return;
        setLoading(true);
        try {
            await api.addResultadoManual({
                aluno_id: selectedAlunoId,
                gabarito_id: gabarito.id,
                respostas_aluno: answers
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao registrar resultado');
        } finally {
            setLoading(false);
        }
    };

    const calculatePreview = () => {
        let acertos = 0;
        const total = correctAnswers.length;
        answers.forEach((ans, idx) => {
            if (ans === correctAnswers[idx]) acertos++;
        });
        const nota = total > 0 ? (acertos / total) * 10 : 0;
        return { acertos, nota: nota.toFixed(1) };
    };

    const { acertos, nota } = calculatePreview();
    const selectedAluno = alunos.find(a => a.id === selectedAlunoId);

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                    <div>
                        <h2>Lançamento Manual</h2>
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
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                {alunos.filter(a => a.nome.toLowerCase().includes(searchAluno.toLowerCase())).map(a => (
                                    <div
                                        key={a.id}
                                        onClick={() => setSelectedAlunoId(a.id)}
                                        style={{
                                            padding: '12px 15px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderBottom: '1px solid #f1f5f9',
                                            background: selectedAlunoId === a.id ? '#eff6ff' : 'transparent',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{a.nome}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>Cód: {a.codigo}</div>
                                        </div>
                                        {selectedAlunoId === a.id && <CheckCircle2 size={18} color="#3b82f6" />}
                                    </div>
                                ))}
                                {alunos.length === 0 && <p style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Nenhum aluno encontrado para as turmas deste gabarito.</p>}
                            </div>

                            <div className="form-actions">
                                <button className="reset-btn" onClick={onClose}>Cancelar</button>
                                <button
                                    className="save-btn"
                                    onClick={() => setStep(2)}
                                    disabled={!selectedAlunoId}
                                >
                                    <span>Próximo: Respostas</span>
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="step-answers">
                            <div className="stats-row" style={{ marginBottom: '20px', background: '#f8fafc' }}>
                                <div className="mini-stat">
                                    <div className="mini-stat-value">{selectedAluno?.nome}</div>
                                    <div className="mini-stat-label">Aluno Selecionado</div>
                                </div>
                                <div className="mini-stat">
                                    <div className="mini-stat-value">{acertos}/{correctAnswers.length}</div>
                                    <div className="mini-stat-label">Acertos Estimados</div>
                                </div>
                                <div className="mini-stat">
                                    <div className={`nota-badge ${parseFloat(nota) >= 7 ? 'success' : 'danger'}`} style={{ fontSize: '20px', padding: '10px 20px' }}>
                                        {nota}
                                    </div>
                                    <div className="mini-stat-label">Nota</div>
                                </div>
                            </div>

                            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                                    {correctAnswers.map((correta, idx) => (
                                        <div key={idx} style={{
                                            padding: '12px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '16px',
                                            background: answers[idx] === correta ? '#f0fdf4' : (answers[idx] ? '#fef2f2' : 'white')
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', fontWeight: 800 }}>
                                                <span color="#64748b">Questão {idx + 1}</span>
                                                {answers[idx] === correta ? <CheckCircle2 size={14} color="#10b981" /> : (answers[idx] ? <AlertCircle size={14} color="#ef4444" /> : null)}
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                                    <button
                                                        key={opt}
                                                        onClick={() => handleSelectOption(idx, opt)}
                                                        style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            border: '1px solid #e2e8f0',
                                                            fontSize: '10px',
                                                            fontWeight: 800,
                                                            background: answers[idx] === opt ? (opt === correta ? '#10b981' : '#ef4444') : 'white',
                                                            color: answers[idx] === opt ? 'white' : '#64748b',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="form-actions">
                                <button className="reset-btn" onClick={() => setStep(1)} style={{ background: '#f1f5f9', color: '#64748b' }}>
                                    Voltar
                                </button>
                                <button className="save-btn" onClick={handleSave} disabled={loading}>
                                    <Save size={18} />
                                    <span>{loading ? 'Salvando...' : 'Finalizar e Gravar Nota'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
