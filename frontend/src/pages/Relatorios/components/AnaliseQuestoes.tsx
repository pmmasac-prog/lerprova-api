import React from 'react';
import { HelpCircle } from 'lucide-react';
import type { Gabarito } from '../types';

interface AnaliseQuestoesProps {
    gabaritos: Gabarito[];
    selectedGabarito: number | null;
    setSelectedGabarito: (id: number) => void;
    questaoStats: any[];
    loading: boolean;
    hasResults: boolean;
}

export const AnaliseQuestoes: React.FC<AnaliseQuestoesProps> = ({
    gabaritos,
    selectedGabarito,
    setSelectedGabarito,
    questaoStats,
    loading,
    hasResults
}) => {
    return (
        <div className="tab-content">
            <div className="chip-scroll">
                {gabaritos.map(g => (
                    <button
                        key={g.id}
                        className={`chip ${selectedGabarito === g.id ? 'chip-active' : ''}`}
                        onClick={() => setSelectedGabarito(g.id)}
                    >
                        {g.titulo || g.assunto}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="empty-text">Carregando...</p>
            ) : selectedGabarito ? (
                <div className="card">
                    <h3 className="card-title">Análise por Questão</h3>
                    {!hasResults ? (
                        <div className="empty-box">
                            <p className="empty-text">Sem resultados processados para este gabarito.</p>
                        </div>
                    ) : (
                        <table className="matrix-table" style={{ width: '100%', marginTop: '15px' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'center' }}>Questão</th>
                                    <th style={{ textAlign: 'center' }}>Gabarito</th>
                                    <th style={{ textAlign: 'center' }}>Acertos</th>
                                    <th style={{ textAlign: 'center' }}>Erros</th>
                                    <th style={{ textAlign: 'center' }}>% Acerto</th>
                                    <th style={{ textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {questaoStats.map(q => (
                                    <tr key={q.questao}>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>#{q.questao}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="badge-gabarito" style={{ padding: '2px 8px', background: '#e2e8f0', borderRadius: '12px', fontSize: '12px' }}>
                                                {q.correta}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>{q.acertos}</td>
                                        <td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 'bold' }}>{q.erros}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{q.perc}%</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${q.perc}%`,
                                                    background: q.perc >= 70 ? '#16a34a' : q.perc >= 50 ? '#ca8a04' : '#dc2626'
                                                }}></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                <div className="empty-box">
                    <HelpCircle size={40} color="#cbd5e1" />
                    <p className="empty-text">Selecione um gabarito para ver o índice de erro</p>
                </div>
            )}
        </div>
    );
};
