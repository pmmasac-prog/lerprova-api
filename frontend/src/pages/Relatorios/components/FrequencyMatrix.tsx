import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';

interface FrequencyMatrixProps {
    turmaId: number;
}

export const FrequencyMatrix: React.FC<FrequencyMatrixProps> = ({ turmaId }) => {
    const [dates, setDates] = useState<string[]>([]);
    const [alunos, setAlunos] = useState<any[]>([]);
    const [matrix, setMatrix] = useState<{ [key: string]: boolean }>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMatrix();
    }, [turmaId]);

    const loadMatrix = async () => {
        try {
            setLoading(true);
            const [fetchedDates, fetchedAlunos, fetchedFreqs] = await Promise.all([
                api.getFrequenciaDates(turmaId),
                api.getAlunosByTurma(turmaId),
                api.getFrequenciaTurma(turmaId)
            ]);

            const sortedDates = (fetchedDates as string[]).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            setDates(sortedDates);
            setAlunos(fetchedAlunos);

            const freqMap: { [key: string]: boolean } = {};
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
            if (matrix[`${alunoId}-${d}`]) presentCount++;
        });
        return Math.round((presentCount / dates.length) * 100);
    };

    if (loading) return <p className="loading-text">Carregando matriz...</p>;

    return (
        <div className="frequency-matrix-container">
            <div className="matrix-scroll">
                <table className="matrix-table">
                    <thead>
                        <tr>
                            <th className="matrix-fixed-col">Aluno</th>
                            <th className="matrix-stats-col">%</th>
                            {dates.map(d => (
                                <th key={d} className="matrix-date-col">
                                    {new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </th>
                            ))}
                            {dates.length === 0 && <th>Nenhuma aula registrada</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {alunos.sort((a, b) => a.nome.localeCompare(b.nome)).map(aluno => (
                            <tr key={aluno.id}>
                                <td className="matrix-fixed-col matrix-name">{aluno.nome}</td>
                                <td className="matrix-stats-col">
                                    <strong>{calculateAttendance(aluno.id)}%</strong>
                                </td>
                                {dates.map(d => {
                                    const isPresent = matrix[`${aluno.id}-${d}`];
                                    return (
                                        <td key={d} className="matrix-cell">
                                            {isPresent ? (
                                                <div className="status-dot present" title="Presente"></div>
                                            ) : (
                                                <div className="status-dot absent" title="Falta"></div>
                                            )}
                                        </td>
                                    );
                                })}
                                {dates.length === 0 && <td style={{ fontSize: '11px', color: '#94a3b8' }}>-</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
