import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle2, Info, ArrowLeft } from 'lucide-react';
import { api } from '../../../services/api';
import './EditResultadoModal.css';

interface EditResultadoModalProps {
    resultado: any;
    gabarito: any;
    onClose: () => void;
    onSuccess: () => void;
}

export const EditResultadoModal: React.FC<EditResultadoModalProps> = ({ resultado, gabarito, onClose, onSuccess }) => {
    const [answers, setAnswers] = useState<string[]>([]);
    const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [overrideNota, setOverrideNota] = useState(false);
    const [manualNota, setManualNota] = useState(resultado.nota.toString());

    useEffect(() => {
        try {
            setAnswers(JSON.parse(resultado.respostas_aluno || '[]'));
            setCorrectAnswers(JSON.parse(gabarito.respostas_corretas || '[]'));
        } catch (e) {
            console.error('Erro ao processar dados:', e);
        }
    }, [resultado, gabarito]);

    const handleSelectOption = (idx: number, opt: string) => {
        const newAnswers = [...answers];
        newAnswers[idx] = opt;
        setAnswers(newAnswers);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload: any = { respostas_aluno: answers };
            if (overrideNota) {
                payload.nota = parseFloat(manualNota.replace(',', '.'));
            }
            await api.updateResultado(resultado.id, payload);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar alterações');
        } finally {
            setLoading(false);
        }
    };

    const calculatePreview = () => {
        if (overrideNota) {
            return { acertos: '-', nota: manualNota || '0.0' };
        }
        let acertosCountValue = 0;
        const total = correctAnswers.length;
        answers.forEach((ans, idx) => {
            if (ans === correctAnswers[idx]) acertosCountValue++;
        });
        const notaValue = total > 0 ? (acertosCountValue / total) * 10 : 0;
        return { acertos: acertosCountValue, nota: notaValue.toFixed(1) };
    };

    const preview = calculatePreview();

    return (
        <div className="modal-overlay">
            <div className="edit-modal-container">
                <div className="edit-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button className="back-circle-btn" onClick={onClose} title="Voltar">
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h2 className="edit-modal-title">Corrigir Resultado</h2>
                            <p className="edit-modal-subtitle">
                                {resultado.aluno?.nome || 'Aluno'} • {gabarito.titulo || gabarito.assunto}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="edit-modal-body">
                    <div className="edit-stats-grid">
                        <div className="mini-stat-card">
                            <div className="mini-stat-value">{preview.acertos}</div>
                            <div className="mini-stat-label">Acertos</div>
                        </div>
                        <div className="mini-stat-card">
                            <div className={`nota-badge-large ${parseFloat(preview.nota) >= 7 ? 'success' : (parseFloat(preview.nota) >= 5 ? 'warning' : 'danger')}`}>
                                {preview.nota}
                            </div>
                            <div className="mini-stat-label">Nota Calculada</div>
                        </div>
                    </div>

                    <div className={`override-section ${overrideNota ? 'active' : ''}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                                type="checkbox"
                                id="override"
                                checked={overrideNota}
                                onChange={(e) => setOverrideNota(e.target.checked)}
                                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            />
                            <label htmlFor="override" style={{ fontWeight: 700, color: '#f1f5f9', cursor: 'pointer', fontSize: '14px' }}>
                                Sobrescrever nota final manualmente
                            </label>
                        </div>
                        {overrideNota && (
                            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '32px' }}>
                                <span style={{ fontSize: '14px', color: '#94a3b8' }}>Nota Manual:</span>
                                <input
                                    type="text"
                                    value={manualNota}
                                    onChange={(e) => setManualNota(e.target.value)}
                                    style={{
                                        width: '100px',
                                        padding: '10px',
                                        borderRadius: '10px',
                                        border: '2px solid #f59e0b',
                                        background: '#1a1d27',
                                        color: '#fff',
                                        textAlign: 'center',
                                        fontSize: '18px',
                                        fontWeight: '800'
                                    }}
                                    placeholder="0.0"
                                />
                                <div style={{ flex: 1, fontSize: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={14} />
                                    <span>As respostas abaixo serão ignoradas no cálculo final.</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {!overrideNota && (
                        <div className="info-banner">
                            <Info size={18} />
                            <span>Clique nas opções abaixo para alterar as respostas. A nota será atualizada instantaneamente.</span>
                        </div>
                    )}

                    <div className="questions-scroll-area">
                        <div className="questions-grid">
                            {correctAnswers.map((correta, idx) => {
                                const isCorrect = answers[idx] === correta;
                                return (
                                    <div key={idx} className={`question-edit-card ${answers[idx] ? (isCorrect ? 'correct' : 'wrong') : ''}`}>
                                        <div className="question-footer" style={{ marginBottom: '8px', marginTop: 0 }}>
                                            <span style={{ color: '#94a3b8' }}>Questão {idx + 1}</span>
                                            {answers[idx] && (isCorrect ? <CheckCircle2 size={14} color="#10b981" /> : <AlertCircle size={14} color="#ef4444" />)}
                                        </div>
                                        <div className="options-row">
                                            {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => handleSelectOption(idx, opt)}
                                                    className={`option-btn ${answers[idx] === opt ? (opt === correta ? 'selected correct' : 'selected wrong') : ''}`}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="question-footer">
                                            <span>Gabarito: <strong style={{ color: '#10b981' }}>{correta}</strong></span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="edit-modal-actions">
                        <button className="btn-discard" onClick={onClose}>
                            Cancelar
                        </button>
                        <button className="btn-confirm" onClick={handleSave} disabled={loading}>
                            <Save size={18} />
                            <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
