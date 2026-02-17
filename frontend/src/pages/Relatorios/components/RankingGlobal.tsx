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
                resultados.map((r) => (
                    <div key={r.id} className="aluno-row">
                        <div className="aluno-avatar">{r.nome.substring(0, 2).toUpperCase()}</div>
                        <div className="aluno-info">
                            <div className="aluno-name">{r.nome}</div>
                            <div className="aluno-sub">{r.assunto}</div>
                        </div>
                        <div className="flex items-center gap-4 ml-auto">
                            <div className={`nota-badge ${r.nota >= 7 ? 'success' : r.nota >= 5 ? 'warning' : 'danger'}`}>
                                {r.nota.toFixed(1)}
                            </div>
                            <button
                                className="icon-btn"
                                style={{ padding: '4px' }}
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
    );
};
