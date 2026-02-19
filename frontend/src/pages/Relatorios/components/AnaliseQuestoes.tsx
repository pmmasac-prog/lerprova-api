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
                        <table className="matrix-table">
                            <thead>
                                <tr>
                                    <th>Questão</th>
                                    <th>Gabarito</th>
                                    <th>Acertos</th>
                                    <th>Erros</th>
                                    <th>% Acerto</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {questaoStats.map(q => (
                                    <tr key={q.questao}>
                                        <td className="font-bold">#{q.questao}</td>
                                        <td>
                                            <span className="badge-gabarito">
                                                {q.correta}
                                            </span>
                                        </td>
                                        <td className="text-success font-bold">{q.acertos}</td>
                                        <td className="text-danger font-bold">{q.erros}</td>
                                        <td className="font-bold">{q.perc}%</td>
                                        <td>
                                            <div className="progress-bar-bg">
                                                <div className="progress-bar-fill" style={{
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
