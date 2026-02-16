import React from 'react';
import type { Resultado } from '../types';

interface RankingGlobalProps {
    resultados: Resultado[];
    loading: boolean;
}

export const RankingGlobal: React.FC<RankingGlobalProps> = ({ resultados, loading }) => {
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
                        <div className={`nota-badge ${r.nota >= 7 ? 'success' : r.nota >= 5 ? 'warning' : 'danger'}`}>
                            {r.nota.toFixed(1)}
                        </div>
                    </div>
                ))
            ) : (
                <p className="empty-text">Nenhum resultado encontrado</p>
            )}
        </div>
    );
};
