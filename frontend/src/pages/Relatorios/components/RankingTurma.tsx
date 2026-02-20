import React from 'react';
import type { Turma, Resultado } from '../types';
import { Edit3 } from 'lucide-react';

interface RankingTurmaProps {
    turma: Turma | undefined;
    resultados: Resultado[];
    loading: boolean;
    overallStats: { media: string; total: number };
    onEdit?: (resultado: Resultado) => void;
}

export const RankingTurma: React.FC<RankingTurmaProps> = (props) => {
    const { turma, resultados, loading, overallStats } = props;
    return (
        <div className="tab-content">


            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">{turma?.nome || 'Turma'}</h3>
                    <div className="card-badge">{overallStats.media}</div>
                </div>
                <p className="card-subtitle">{overallStats.total} provas • {resultados.length} resultados</p>

                {loading ? (
                    <p className="empty-text">Carregando...</p>
                ) : resultados.length > 0 ? (
                    resultados.map((r, idx) => (
                        <div key={r.id} className="rank-row">
                            <span className="rank-pos">{idx + 1}</span>
                            <span className="rank-name">{r.nome}</span>
                            <div className="flex items-center gap-4 ml-auto">
                                <span className="rank-acertos">{r.acertos}ac</span>
                                <div className={`nota-badge ${r.nota >= 7 ? 'success' : r.nota >= 5 ? 'warning' : 'danger'}`}>
                                    {r.nota.toFixed(1)}
                                </div>
                                <button
                                    className="icon-btn"
                                    title="Editar Manualmente"
                                    onClick={() => props.onEdit?.(r)}
                                >
                                    <Edit3 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="empty-text">Nenhum resultado encontrado</p>
                )}
            </div>
        </div>
    );
};
