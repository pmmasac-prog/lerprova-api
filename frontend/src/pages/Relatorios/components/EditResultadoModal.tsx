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
        let acertos = 0;
        const total = correctAnswers.length;
        answers.forEach((ans, idx) => {
            if (ans === correctAnswers[idx]) acertos++;
        });
        const nota = total > 0 ? (acertos / total) * 10 : 0;
        return { acertos, nota: nota.toFixed(1) };
    };

    const { acertos, nota } = calculatePreview();

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                    <div>
                        <h2>Corrigir Resultado</h2>
                        <p className="admin-subtitle">{resultado.aluno.nome} • {gabarito.titulo || gabarito.assunto}</p>
                    </div>
                    <button className="close-btn" onClick={onClose}><X /></button>
                </div>

                <div className="admin-form">
                    <div className="stats-row" style={{ marginBottom: '20px', background: '#f8fafc' }}>
                        <div className="mini-stat">
                            <div className="mini-stat-value">{acertos}</div>
                            <div className="mini-stat-label">Acertos</div>
                        </div>
                        <div className="mini-stat">
                            <div className={`nota-badge ${parseFloat(nota) >= 7 ? 'success' : (parseFloat(nota) >= 5 ? 'warning' : 'danger')}`} style={{ fontSize: '20px', padding: '10px 20px' }}>
                                {nota}
                            </div>
                            <div className="mini-stat-label">Nota Atual</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px', padding: '15px', background: overrideNota ? '#fff7ed' : '#f1f5f9', borderRadius: '12px', border: overrideNota ? '1px solid #fdba74' : '1px solid transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                                type="checkbox"
                                id="override"
                                checked={overrideNota}
                                onChange={(e) => setOverrideNota(e.target.checked)}
                                style={{ width: '18px', height: '18px' }}
                            />
                            <label htmlFor="override" style={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                                Sobrescrever nota final manualmente
                            </label>
                        </div>
                        {overrideNota && (
                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '13px', color: '#64748b' }}>Nova Nota:</span>
                                <input
                                    type="text"
                                    value={manualNota}
                                    onChange={(e) => setManualNota(e.target.value)}
                                    style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '2px solid #f97316', textAlign: 'center', fontWeight: 'bold' }}
                                />
                                <span style={{ fontSize: '11px', color: '#f97316' }}>⚠️ Ignorará as respostas abaixo para o cálculo.</span>
                            </div>
                        )}
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
