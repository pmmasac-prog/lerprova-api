// ./Relatorios/components/RankingTurma.tsx
import React, { useMemo } from 'react';
import type { Turma, Resultado } from '../types';
import { Edit3, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

                {/* Resumo pedagógico (usa classes do CSS v2 que você colou) */}
                {!loading && resultados.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                        <div className="insights-grid">
                            <div className="insight-card">
                                <div className="insight-top">
                                    <div className="insight-title">Risco alto (&lt; 5)</div>
                                    <div className="insight-value">{counts.high}</div>
                                </div>
                                <div className="insight-meta">
                                    <span>Prioridade máxima</span>
                                    <span className={`insight-trend ${counts.high > 0 ? 'down' : 'up'}`}>
                                        {counts.high > 0 ? 'Crítico' : 'Ok'}
                                    </span>
                                </div>
                            </div>

                            <div className="insight-card">
                                <div className="insight-top">
                                    <div className="insight-title">Abaixo de 7</div>
                                    <div className="insight-value">{counts.high + counts.mid}</div>
                                </div>
                                <div className="insight-meta">
                                    <span>Risco médio: {counts.mid}</span>
                                    <span className={`insight-trend ${(counts.high + counts.mid) > 0 ? 'flat' : 'up'}`}>
                                        {(counts.high + counts.mid) > 0 ? 'Atenção' : 'Ok'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <p className="empty-text">Carregando...</p>
                ) : resultados.length > 0 ? (
                    pedagogicList.map((r, idx) => {
                        const risk = computeRisk(r.nota);
                        const rowClass =
                            risk === 'high' ? 'aluno-row risk-high' : risk === 'mid' ? 'aluno-row risk-mid' : 'aluno-row risk-low';

                        const riskLabel =
                            risk === 'high' ? (
                                <span className="risk-pill high">
                                    <AlertTriangle size={14} />
                                    RISCO ALTO
                                </span>
                            ) : risk === 'mid' ? (
                                <span className="risk-pill mid">
                                    <AlertTriangle size={14} />
                                    RISCO MÉDIO
                                </span>
                            ) : (
                                <span className="risk-pill low">
                                    <CheckCircle2 size={14} />
                                    OK
                                </span>
                            );

                        const notaPillClass =
                            r.nota >= 7 ? 'metric-pill good' : r.nota >= 5 ? 'metric-pill warn' : 'metric-pill bad';

                        return (
                            <div key={r.id} className={rowClass}>
                                {/* Avatar com iniciais (melhora leitura rápida) */}
                                <div className="aluno-avatar">
                                    {String(r.nome || '')
                                        .trim()
                                        .split(/\s+/)
                                        .slice(0, 2)
                                        .map(p => p[0]?.toUpperCase())
                                        .join('')}
                                </div>

                                <div className="aluno-info">
                                    <div className="aluno-left">
                                        <div className="aluno-name">{r.nome}</div>
                                        <div className="aluno-sub">
                                            <span>Ordem: {idx + 1}</span>
                                            <span>Acertos: {r.acertos}</span>
                                        </div>
                                    </div>

                                    <div className="aluno-metrics">
                                        {riskLabel}
                                        <span className={notaPillClass}>Nota {r.nota.toFixed(1)}</span>

                                        <button
                                            className="icon-btn"
                                            title="Editar Manualmente"
                                            onClick={() => props.onEdit?.(r)}
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="empty-text">Nenhum resultado encontrado</p>
                )}
            </div>
        </div>
    );
};