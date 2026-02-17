import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { api } from '../../../services/api';

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

    useEffect(() => {
        try {
            const parsedRespostas = JSON.parse(resultado.respostas_aluno || '[]');
            setAnswers(parsedRespostas);

            const parsedCorretas = JSON.parse(gabarito.respostas_corretas || '[]');
            setCorrectAnswers(parsedCorretas);

            // Se o aluno tiver menos respostas que o gabarito, preencher com vazio
            if (parsedRespostas.length < parsedCorretas.length) {
                const newAnswers = [...parsedRespostas];
                while (newAnswers.length < parsedCorretas.length) {
                    newAnswers.push("");
                }
                setAnswers(newAnswers);
            }
        } catch (e) {
            console.error('Erro ao processar respostas:', e);
        }
    }, [resultado, gabarito]);

    const handleSelect = (idx: number, val: string) => {
        const newAnswers = [...answers];
        newAnswers[idx] = val;
        setAnswers(newAnswers);
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

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.updateResultado(resultado.id, { respostas_aluno: answers });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar alterações');
        } finally {
            setLoading(false);
        }
    };

    const { acertos, nota } = calculatePreview();

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                    <div>
                        <h2>Correção Manual</h2>
                        <p className="admin-subtitle">{resultado.nome} • {gabarito.titulo || gabarito.assunto}</p>
                    </div>
                    <button className="close-btn" onClick={onClose}><X /></button>
                </div>

                <div className="admin-form">
                    <div className="stats-row" style={{ marginBottom: '20px', background: '#f8fafc' }}>
                        <div className="mini-stat">
                            <div className="mini-stat-value">{acertos}/{correctAnswers.length}</div>
                            <div className="mini-stat-label">Acertos</div>
                        </div>
                        <div className="mini-stat">
                            <div className={`nota-badge ${parseFloat(nota) >= 7 ? 'success' : 'danger'}`} style={{ fontSize: '20px', padding: '10px 20px' }}>
                                {nota}
                            </div>
                            <div className="mini-stat-label">Nota</div>
                        </div>
                    </div>

                    <div className="info-alert" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '12px', marginBottom: '20px', display: 'flex', gap: '10px', color: '#1d4ed8' }}>
                        <Info size={20} />
                        <span style={{ fontSize: '13px' }}>As alterações nas respostas recalcularão automaticamente a nota do aluno.</span>
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
                                                onClick={() => handleSelect(idx, opt)}
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
                                    <div style={{ marginTop: '8px', fontSize: '10px', color: '#64748b' }}>
                                        Correção: <strong>{correta}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button className="reset-btn" onClick={onClose} style={{ background: '#f1f5f9', color: '#64748b' }}>
                            Descartar
                        </button>
                        <button className="save-btn" onClick={handleSave} disabled={loading}>
                            <Save size={18} />
                            <span>{loading ? 'Salvando...' : 'Confirmar Correção'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
