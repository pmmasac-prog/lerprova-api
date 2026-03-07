import React, { useState } from 'react';
import { api } from '../services/api';

interface ReportData {
    turma: {
        id: number;
        nome: string;
        disciplina: string;
        professor: string;
        periodo: string;
    };
    resumo: {
        total_alunos: number;
        alunos_ativos: number;
        media_turma: number;
        freq_media: number;
    };
    desempenho: {
        alunos_acima_media: number;
        alunos_abaixo_media: number;
        alunos_risco: number;
        distribuicao_notas: Array<{
            intervalo: string;
            qtd: number;
        }>;
    };
    frequencia: {
        dias_letivos: number;
        media_faltas: number;
        alunos_criticos: Array<{
            id: number;
            nome: string;
            faltas: number;
        }>;
    };
    provas: {
        total_provas: number;
        media_acertos: number;
        topicos_dificuldade: Array<{
            topico: string;
            acerto_rate: number;
        }>;
    };
    pedagogia: {
        bncc_cobertura: number;
        metodologias_utilizadas: string[];
        recursos_utilizados: string[];
    };
    recomendacoes: string[];
}

interface GenerateReportProps {
    turmaId: number;
    turmaNome: string;
}

export const GenerateReportScreen: React.FC<GenerateReportProps> = ({ turmaId, turmaNome }) => {
    const [format, setFormat] = useState<'json' | 'pdf' | 'csv' | 'xlsx'>('pdf');
    const [period, setPeriod] = useState<'bimestre' | 'trimestre' | 'semestre' | 'ano'>('bimestre');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<ReportData | null>(null);

    const handleGenerateReport = async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await api.generateTurmaReport(turmaId, format, period);
            
            if (format === 'pdf') {
                // Assumindo que a API retorna um blob ou URL de download
                const link = document.createElement('a');
                link.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/pdf' }));
                link.download = `Relatorio_${turmaNome}_${new Date().toISOString().split('T')[0]}.pdf`;
                link.click();
            } else if (format === 'csv' || format === 'xlsx') {
                const link = document.createElement('a');
                const mimeType = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                link.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: mimeType }));
                link.download = `Relatorio_${turmaNome}_${new Date().toISOString().split('T')[0]}.${format}`;
                link.click();
            } else if (format === 'json') {
                setReportData(data);
            }

            alert(`✅ Relatório gerado com sucesso em formato ${format.toUpperCase()}`);
        } catch (err: any) {
            setError(err.message || 'Erro ao gerar relatório');
            console.error('Report generation error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (reportData && format === 'json') {
        return <ReportViewer data={reportData} onBack={() => setReportData(null)} />;
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold mb-6">Gerar Relatório - {turmaNome}</h1>

                {error && (
                    <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Seleção de Formato */}
                    <div>
                        <label className="block text-sm font-semibold mb-3">Formato do Relatório</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {['pdf', 'csv', 'xlsx', 'json'].map((fmt) => (
                                <button
                                    key={fmt}
                                    onClick={() => setFormat(fmt as any)}
                                    className={`p-3 rounded border-2 transition-colors ${
                                        format === fmt
                                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                                            : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                                    }`}
                                >
                                    {fmt === 'pdf' && '📄 PDF'}
                                    {fmt === 'csv' && '📊 CSV'}
                                    {fmt === 'xlsx' && '📈 XLSX'}
                                    {fmt === 'json' && '📋 JSON'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Seleção de Período */}
                    <div>
                        <label className="block text-sm font-semibold mb-3">Período</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { value: 'bimestre' as const, label: 'Bimestre' },
                                { value: 'trimestre' as const, label: 'Trimestre' },
                                { value: 'semestre' as const, label: 'Semestre' },
                                { value: 'ano' as const, label: 'Ano' }
                            ].map((p) => (
                                <button
                                    key={p.value}
                                    onClick={() => setPeriod(p.value)}
                                    className={`p-2 rounded border transition-colors ${
                                        period === p.value
                                            ? 'border-green-600 bg-green-50 text-green-900'
                                            : 'border-gray-300 bg-white text-gray-700 hover:border-green-400'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Descrição */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-4">
                        <h3 className="font-semibold text-blue-900 mb-2">O que está incluído no relatório:</h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>✓ Resumo geral da turma (média, frequência)</li>
                            <li>✓ Desempenho individual dos alunos</li>
                            <li>✓ Análise de frequência</li>
                            <li>✓ Resultados de provas e média de acertos</li>
                            <li>✓ Cobertura da BNCC e metodologias utilizadas</li>
                            <li>✓ Recomendações pedagógicas</li>
                        </ul>
                    </div>
                </div>

                <div className="mt-8 flex gap-4">
                    <button
                        onClick={handleGenerateReport}
                        disabled={loading}
                        className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                            loading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {loading ? '⏳ Gerando...' : '📥 Gerar Relatório'}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ReportViewerProps {
    data: ReportData;
    onBack: () => void;
}

const ReportViewer: React.FC<ReportViewerProps> = ({ data, onBack }) => {
    return (
        <div className="max-w-4xl mx-auto p-6">
            <button
                onClick={onBack}
                className="mb-6 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
                ← Voltar
            </button>

            <div className="bg-white rounded-lg shadow-md p-8 space-y-8">
                {/* Cabeçalho */}
                <div className="border-b pb-6">
                    <h1 className="text-3xl font-bold">{data.turma.nome}</h1>
                    <p className="text-gray-600">Disciplina: {data.turma.disciplina}</p>
                    <p className="text-gray-600">Professor: {data.turma.professor}</p>
                    <p className="text-gray-600">Período: {data.turma.periodo}</p>
                </div>

                {/* Resumo */}
                <div>
                    <h2 className="text-2xl font-bold mb-4">📊 Resumo Geral</h2>
                    <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded">
                            <p className="text-gray-600">Total de Alunos</p>
                            <p className="text-2xl font-bold text-blue-600">{data.resumo.total_alunos}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded">
                            <p className="text-gray-600">Alunos Ativos</p>
                            <p className="text-2xl font-bold text-green-600">{data.resumo.alunos_ativos}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded">
                            <p className="text-gray-600">Média da Turma</p>
                            <p className="text-2xl font-bold text-purple-600">{data.resumo.media_turma.toFixed(1)}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded">
                            <p className="text-gray-600">Frequência Média</p>
                            <p className="text-2xl font-bold text-orange-600">{data.resumo.freq_media.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                {/* Desempenho */}
                <div>
                    <h2 className="text-2xl font-bold mb-4">📈 Desempenho</h2>
                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-100 border border-green-400 p-4 rounded">
                            <p className="text-green-900 font-semibold">Acima da Média</p>
                            <p className="text-3xl font-bold text-green-700">{data.desempenho.alunos_acima_media}</p>
                        </div>
                        <div className="bg-yellow-100 border border-yellow-400 p-4 rounded">
                            <p className="text-yellow-900 font-semibold">Abaixo da Média</p>
                            <p className="text-3xl font-bold text-yellow-700">{data.desempenho.alunos_abaixo_media}</p>
                        </div>
                        <div className="bg-red-100 border border-red-400 p-4 rounded">
                            <p className="text-red-900 font-semibold">Em Risco</p>
                            <p className="text-3xl font-bold text-red-700">{data.desempenho.alunos_risco}</p>
                        </div>
                    </div>
                </div>

                {/* Frequência Crítica */}
                {data.frequencia.alunos_criticos.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">⚠️ Alunos com Frequência Crítica</h2>
                        <div className="bg-red-50 rounded p-4">
                            <ul className="space-y-2">
                                {data.frequencia.alunos_criticos.map((aluno) => (
                                    <li key={aluno.id} className="text-red-800">
                                        <strong>{aluno.nome}</strong> - {aluno.faltas} faltas
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Tópicos com Dificuldade */}
                {data.provas.topicos_dificuldade.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">📚 Tópicos com Dificuldade</h2>
                        <div className="space-y-2">
                            {data.provas.topicos_dificuldade.map((topico, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <p className="w-32">{topico.topico}</p>
                                    <div className="flex-1 bg-gray-200 rounded-full h-6">
                                        <div
                                            className={`h-6 rounded-full flex items-center justify-end pr-2 text-xs font-semibold text-white ${
                                                topico.acerto_rate > 70
                                                    ? 'bg-green-500'
                                                    : topico.acerto_rate > 50
                                                    ? 'bg-yellow-500'
                                                    : 'bg-red-500'
                                            }`}
                                            style={{ width: `${topico.acerto_rate}%` }}
                                        >
                                            {topico.acerto_rate.toFixed(0)}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* BNCC */}
                <div>
                    <h2 className="text-2xl font-bold mb-4">🎓 Cobertura Pedagógica</h2>
                    <div className="bg-blue-50 p-4 rounded">
                        <p className="text-lg">
                            <strong>Cobertura BNCC:</strong> <span className="text-2xl text-blue-600">{data.pedagogia.bncc_cobertura.toFixed(1)}%</span>
                        </p>
                    </div>
                </div>

                {/* Recomendações */}
                {data.recomendacoes.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">💡 Recomendações</h2>
                        <ul className="space-y-2">
                            {data.recomendacoes.map((rec, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="text-yellow-600 mt-1">★</span>
                                    <p className="text-gray-700">{rec}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GenerateReportScreen;
