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
        <div className="frequency-matrix-container">
            <div className="matrix-header-info">
                <h4>
                    Frequência de {meses[month - 1]}
                </h4>
                <div className="matrix-count">
                    {dates.length} aulas registradas no mês
                </div>
            </div>

            <div className="matrix-scroll">
                <table className="matrix-table">
                    <thead>
                        <tr>
                            <th className="matrix-fixed-col">Aluno</th>
                            <th className="matrix-stats-col">%</th>
                            {dates.map(d => (
                                <th key={d} className="matrix-date-col">
                                    <div className="date-day">{d.split('-')[2]}</div>
                                    <div className="date-month">/ {d.split('-')[1]}</div>
                                </th>
                            ))}
                            {dates.length === 0 && <th>Nenhuma aula registrada neste mês</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {alunos.sort((a, b) => a.nome.localeCompare(b.nome)).map((aluno) => (
                            <tr key={aluno.id}>
                                <td className="matrix-fixed-col matrix-name">
                                    {aluno.nome}
                                </td>
                                <td className="matrix-stats-col">
                                    <span className={`attendance-badge ${calculateAttendance(aluno.id) >= 75 ? 'good' : 'bad'}`}>
                                        {calculateAttendance(aluno.id)}%
                                    </span>
                                </td>
                                {dates.map(d => {
                                    const val = matrix[`${aluno.id}-${d}`];
                                    const isP = val === true || val === 1 || val === "1";
                                    const isF = val === false || val === 0 || val === "0";
                                    return (
                                        <td key={d} style={{ padding: '8px 0', textAlign: 'center' }}>
                                            <div className={`status-dot ${isP ? 'present' : isF ? 'absent' : ''}`}>
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
