import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';

interface FrequencyMatrixProps {
    turmaId: number;
    month: number;
}

export const FrequencyMatrix: React.FC<FrequencyMatrixProps> = ({ turmaId, month }) => {
    const [dates, setDates] = useState<string[]>([]);
    const [alunos, setAlunos] = useState<any[]>([]);
    const [matrix, setMatrix] = useState<{ [key: string]: any }>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMatrix();
    }, [turmaId, month]);

    const loadMatrix = async () => {
        try {
            setLoading(true);
            const [fetchedDates, fetchedAlunos, fetchedFreqs] = await Promise.all([
                api.getFrequenciaDates(turmaId),
                api.getAlunosByTurma(turmaId),
                api.getFrequenciaTurma(turmaId)
            ]);

            const filteredDates = (fetchedDates as string[]).filter(d => {
                const dateParts = d.split('-');
                return parseInt(dateParts[1]) === month;
            });

            const sortedDates = filteredDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
            setDates(sortedDates);
            setAlunos(fetchedAlunos);

            const freqMap: { [key: string]: any } = {};
            fetchedFreqs.forEach((f: any) => {
                freqMap[`${f.aluno_id}-${f.data}`] = f.presente;
            });
            setMatrix(freqMap);

        } catch (error) {
            console.error("Erro ao carregar matriz de frequência:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateAttendance = (alunoId: number) => {
        if (dates.length === 0) return 0;
        let presentCount = 0;
        dates.forEach(d => {
            const val = matrix[`${alunoId}-${d}`];
            if (val === true || val === 1 || val === "1") presentCount++;
        });
        return Math.round((presentCount / dates.length) * 100);
    };

    if (loading) return <div className="loading-container"><p className="loading-text">Carregando matriz...</p></div>;

    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    return (
        <div className="frequency-matrix-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="matrix-header-info" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, color: '#1e293b', fontSize: '15px' }}>
                    Frequência de {meses[month - 1]}
                </h4>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {dates.length} aulas registradas no mês
                </div>
            </div>

            <div className="matrix-scroll" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white' }}>
                <table className="matrix-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc' }}>
                            <th className="matrix-fixed-col" style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f8fafc', padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', minWidth: '180px' }}>Aluno</th>
                            <th className="matrix-stats-col" style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center', minWidth: '60px' }}>%</th>
                            {dates.map(d => (
                                <th key={d} className="matrix-date-col" style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                                    <div style={{ fontWeight: 'bold', color: '#475569' }}>{d.split('-')[2]}</div>
                                    <div style={{ fontSize: '9px' }}>/ {d.split('-')[1]}</div>
                                </th>
                            ))}
                            {dates.length === 0 && <th style={{ padding: '20px', color: '#94a3b8', fontSize: '13px' }}>Nenhuma aula registrada neste mês</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {alunos.sort((a, b) => a.nome.localeCompare(b.nome)).map((aluno, idx) => (
                            <tr key={aluno.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fcfdfe' }}>
                                <td className="matrix-fixed-col matrix-name" style={{ position: 'sticky', left: 0, zIndex: 10, background: idx % 2 === 0 ? 'white' : '#fcfdfe', padding: '10px 12px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>
                                    {aluno.nome}
                                </td>
                                <td className="matrix-stats-col" style={{ textAlign: 'center' }}>
                                    <span style={{
                                        fontWeight: 'bold',
                                        color: calculateAttendance(aluno.id) >= 75 ? '#10b981' : '#f59e0b',
                                        fontSize: '12px',
                                        background: calculateAttendance(aluno.id) >= 75 ? '#f0fdf4' : '#fffbeb',
                                        padding: '2px 6px',
                                        borderRadius: '6px'
                                    }}>
                                        {calculateAttendance(aluno.id)}%
                                    </span>
                                </td>
                                {dates.map(d => {
                                    const val = matrix[`${aluno.id}-${d}`];
                                    const isP = val === true || val === 1 || val === "1";
                                    const isF = val === false || val === 0 || val === "0";
                                    return (
                                        <td key={d} style={{ padding: '8px 0', textAlign: 'center' }}>
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                margin: '0 auto',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: isP ? '#dcfce7' : isF ? '#fee2e2' : '#f1f5f9',
                                                color: isP ? '#166534' : isF ? '#991b1b' : '#94a3b8',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                border: `1px solid ${isP ? '#10b981' : isF ? '#ef4444' : '#e2e8f0'}`
                                            }}>
                                                {isP ? 'P' : isF ? 'F' : '-'}
                                            </div>
                                        </td>
                                    );
                                })}
                                {dates.length === 0 && <td style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>-</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
