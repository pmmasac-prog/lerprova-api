import React from 'react';
import type { Resultado } from '../types';
import { Edit3 } from 'lucide-react';

interface RankingGlobalProps {
    resultados: Resultado[];
    loading: boolean;
    onEdit?: (resultado: Resultado) => void;
}

export const RankingGlobal: React.FC<RankingGlobalProps> = (props) => {
    const { resultados, loading } = props;
    return (
        <div className="tab-content">
            <p className="section-label">Ranking Global • {resultados.length} resultados</p>
            {loading ? (
                <p className="empty-text">Carregando...</p>
            ) : resultados.length > 0 ? (
                <div className="matrix-scroll" style={{ marginTop: 6 }}>
                    <table className="matrix-table">
                        <thead>
                            <tr>
                                <th className="matrix-fixed-col">Aluno</th>
                                <th className="matrix-stats-col">Assunto</th>
                                <th className="matrix-stats-col">Nota</th>
                                <th className="matrix-stats-col" style={{ width: '40px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {resultados.map((r) => (
                                <tr key={r.id}>
                                    <td className="matrix-fixed-col matrix-name">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="aluno-avatar-mini">
                                                {r.nome.substring(0, 2).toUpperCase()}
                                            </div>
                                            {r.nome}
                                        </div>
                                    </td>
                                    <td className="matrix-stats-col">
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{r.assunto}</div>
                                    </td>
                                    <td className="matrix-stats-col">
                                        <div className={`nota-badge ${r.nota >= 7 ? 'success' : r.nota >= 5 ? 'warning' : 'danger'}`}>
                                            {r.nota.toFixed(1)}
                                        </div>
                                    </td>
                                    <td className="matrix-stats-col">
                                        <button
                                            className="icon-btn"
                                            style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                                            title="Editar Manualmente"
                                            onClick={() => props.onEdit?.(r)}
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="empty-text">Nenhum resultado encontrado</p>
            )}
        </div>
    );
};
