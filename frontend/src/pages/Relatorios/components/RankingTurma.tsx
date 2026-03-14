// ./Relatorios/components/RankingTurma.tsx
import React, { useMemo } from 'react';
import type { Turma, Resultado } from '../types';
import { Edit3 } from 'lucide-react';

interface RankingTurmaProps {
    turma: Turma | undefined;
    resultados: Resultado[]; // pode vir com (r as any).risk, mas não depende disso
    loading: boolean;
    overallStats: { media: string; total: number };
    onEdit?: (resultado: Resultado) => void;
}

// Regras de risco (coerentes com o relatorio.tsx)
const computeRisk = (nota: number): 'high' | 'mid' | 'low' => {
    if (nota < 5) return 'high';
    if (nota < 7) return 'mid';
    return 'low';
};

export const RankingTurma: React.FC<RankingTurmaProps> = (props) => {
    const { turma, resultados, loading, overallStats } = props;

    // Ranking “pedagógico”: prioriza quem precisa (nota menor primeiro)
    // (se você quiser manter ranking tradicional, troque o sort)
    const pedagogicList = useMemo(() => {
        const list = [...(resultados || [])];
        list.sort((a, b) => a.nota - b.nota); // menor nota primeiro (urgência)
        return list;
    }, [resultados]);

    const counts = useMemo(() => {
        const high = pedagogicList.filter(r => computeRisk(r.nota) === 'high').length;
        const mid = pedagogicList.filter(r => computeRisk(r.nota) === 'mid').length;
        const low = pedagogicList.filter(r => computeRisk(r.nota) === 'low').length;
        return { high, mid, low };
    }, [pedagogicList]);

    return (
        <div className="tab-content">
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">{turma?.nome || 'Turma'}</h3>
                    <div className="card-badge">{overallStats.media}</div>
                </div>

                <p className="card-subtitle">
                    {overallStats.total} provas • {resultados.length} resultados
                </p>

                {/* Resumo pedagógico em linha única */}
                {!loading && resultados.length > 0 && (
                    <div className="risk-summary-bar">
                        <span><strong>Risco alto (&lt; 5):</strong> {counts.high} ({counts.high > 0 ? 'Crítico' : 'Ok'})</span>
                        <span className="divider">|</span>
                        <span><strong>Abaixo de 7:</strong> {counts.high + counts.mid} (Atenção: {counts.mid})</span>
                    </div>
                )}

                {loading ? (
                    <p className="empty-text">Carregando...</p>
                ) : resultados.length > 0 ? (
                    <div className="matrix-scroll" style={{ marginTop: 6 }}>
                        <table className="matrix-table">
                            <thead>
                                <tr>
                                    <th className="matrix-fixed-col" style={{ width: '40px' }}>#</th>
                                    <th className="matrix-fixed-col">Aluno</th>
                                    <th className="matrix-stats-col">Risco</th>
                                    <th className="matrix-stats-col">Nota</th>
                                    <th className="matrix-stats-col" style={{ width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pedagogicList.map((r, idx) => {
                                    const risk = computeRisk(r.nota);
                                    const notaPillClass =
                                        r.nota >= 7 ? 'attendance-badge good' : 'attendance-badge bad';

                                    const riskIndicator = 
                                        risk === 'high' ? <span className="status-dot absent" title="Risco Alto"></span> :
                                        risk === 'mid' ? <span className="status-dot risk-mid-dot" title="Atenção"></span> :
                                        <span className="status-dot present" title="OK"></span>;

                                    return (
                                        <tr key={r.id}>
                                            <td className="matrix-fixed-col" style={{ textAlign: 'center', opacity: 0.5 }}>{idx + 1}</td>
                                            <td className="matrix-fixed-col matrix-name">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div className="aluno-avatar-mini">
                                                        {String(r.nome || '')
                                                            .trim()
                                                            .split(/\s+/)
                                                            .slice(0, 2)
                                                            .map(p => p[0]?.toUpperCase())
                                                            .join('')}
                                                    </div>
                                                    {r.nome}
                                                </div>
                                            </td>
                                            <td className="matrix-stats-col" style={{ textAlign: 'center' }}>
                                                {riskIndicator}
                                            </td>
                                            <td className="matrix-stats-col">
                                                <span className={notaPillClass}>{r.nota.toFixed(1)}</span>
                                            </td>
                                            <td className="matrix-stats-col" style={{ textAlign: 'center' }}>
                                                <button
                                                    className="icon-btn"
                                                    style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                                                    onClick={() => props.onEdit?.(r)}
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="empty-text">Nenhum resultado encontrado</p>
                )}
            </div>
        </div>
    );
};