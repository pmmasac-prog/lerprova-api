import React, { useState } from 'react';
import { api } from '../services/api';

interface BatchSyncResult {
    status: string;
    processed: number;
    created: number;
    updated: number;
    failed: number;
    errors: string[];
    execution_time_ms: number;
}

export const BatchSyncComponent: React.FC = () => {
    const [action, setAction] = useState<'sync_turmas' | 'sync_alunos' | 'sync_resultados'>('sync_turmas');
    const [jsonData, setJsonData] = useState('');
    const [useUpsert, setUseUpsert] = useState(true);
    const [validateOnly, setValidateOnly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<BatchSyncResult | null>(null);

    const handleSync = async () => {
        try {
            setLoading(true);
            setError(null);
            setResult(null);

            // Parse JSON
            let data: any[];
            try {
                data = JSON.parse(jsonData);
                if (!Array.isArray(data)) {
                    throw new Error('Dados devem ser um array JSON');
                }
            } catch (e: any) {
                throw new Error(`JSON inválido: ${e.message}`);
            }

            // Chamar API
            const response = await api.batchSync(action, data, {
                upsert: useUpsert,
                validate_only: validateOnly
            });

            setResult(response);
        } catch (err: any) {
            setError(err.message);
            console.error('Batch sync error:', err);
        } finally {
            setLoading(false);
        }
    };

    const SAMPLE_DATA: Record<string, string> = {
        sync_turmas: JSON.stringify([
            {
                id: 'EXT001',
                escola_id: 'ESCOLA_001',
                turma_nome: '6º Ano A',
                disciplina: 'Matemática',
                professor_email: 'prof@escola.com.br'
            }
        ], null, 2),
        sync_alunos: JSON.stringify([
            {
                id: 'ALU001',
                turma_id: 'EXT001',
                nome: 'João da Silva',
                codigo: '12345'
            }
        ], null, 2),
        sync_resultados: JSON.stringify([
            {
                id: 'RES001',
                aluno_id: 'ALU001',
                gabarito_id: 1,
                nota: 8.5,
                acertos: 23
            }
        ], null, 2)
    };

    if (result) {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                <button
                    onClick={() => setResult(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                    ← Voltar
                </button>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-2xl font-bold mb-6">
                        {result.status === 'success' ? '✅ Sincronização Concluída' : '⚠️ Sincronização com Erros'}
                    </h2>

                    <div className="grid md:grid-cols-5 gap-4 mb-8">
                        <div className="bg-blue-50 p-4 rounded text-center">
                            <p className="text-gray-600 text-sm">Total Processado</p>
                            <p className="text-3xl font-bold text-blue-600">{result.processed}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded text-center">
                            <p className="text-gray-600 text-sm">Criados</p>
                            <p className="text-3xl font-bold text-green-600">{result.created}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded text-center">
                            <p className="text-gray-600 text-sm">Atualizados</p>
                            <p className="text-3xl font-bold text-purple-600">{result.updated}</p>
                        </div>
                        <div className={`p-4 rounded text-center ${result.failed > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <p className="text-gray-600 text-sm">Erros</p>
                            <p className={`text-3xl font-bold ${result.failed > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {result.failed}
                            </p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded text-center">
                            <p className="text-gray-600 text-sm">Tempo</p>
                            <p className="text-lg font-bold text-orange-600">{result.execution_time_ms}ms</p>
                        </div>
                    </div>

                    {result.errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
                            <h3 className="font-semibold text-red-900 mb-3">Erros Encontrados:</h3>
                            <ul className="space-y-1 text-sm text-red-800">
                                {result.errors.map((err, idx) => (
                                    <li key={idx}>• {err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="text-center">
                        <p className="text-gray-600">
                            {result.status === 'success'
                                ? '✅ Sincronização realizada com sucesso!'
                                : '⚠️ Sincronização concluída com alguns erros. Verifique acima.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold">Sincronização em Lote</h1>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    🔗 Esta funcionalidade permite sincronizar dados de sistemas externos (ERP, SIGA, etc) com o LerProva em lote.
                    Requer autenticação via API Key.
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
                {/* Seleção de Ação */}
                <div>
                    <label className="block text-sm font-semibold mb-3">Tipo de Sincronização</label>
                    <div className="grid md:grid-cols-3 gap-4">
                        {[
                            { value: 'sync_turmas' as const, label: '🏫 Sincronizar Turmas', desc: 'Cria/atualiza turmas' },
                            { value: 'sync_alunos' as const, label: '👥 Sincronizar Alunos', desc: 'Cria/atualiza alunos' },
                            { value: 'sync_resultados' as const, label: '📊 Sincronizar Resultados', desc: 'Cria/atualiza resultados' }
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setAction(opt.value);
                                    setJsonData(SAMPLE_DATA[opt.value]);
                                }}
                                className={`p-4 rounded border-2 transition-colors text-left ${
                                    action === opt.value
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-gray-300 bg-white hover:border-blue-400'
                                }`}
                            >
                                <p className="font-semibold">{opt.label}</p>
                                <p className="text-xs text-gray-600 mt-1">{opt.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dados JSON */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-semibold">Dados (JSON Array)</label>
                        <button
                            onClick={() => setJsonData(SAMPLE_DATA[action])}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                            📋 Carregar Exemplo
                        </button>
                    </div>
                    <textarea
                        value={jsonData}
                        onChange={(e) => setJsonData(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg h-64 font-mono text-sm"
                        placeholder={`Insira um array JSON aqui...\n[{\n  "id": "...",\n  ...\n}]`}
                    />
                </div>

                {/* Opções */}
                <div className="space-y-3 bg-gray-50 p-4 rounded">
                    <h3 className="font-semibold">Opções</h3>
                    
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="upsert"
                            checked={useUpsert}
                            onChange={(e) => setUseUpsert(e.target.checked)}
                        />
                        <label htmlFor="upsert" className="text-sm">
                            <strong>Upsert Mode</strong>: Criar se não existir, atualizar se existir
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="validateOnly"
                            checked={validateOnly}
                            onChange={(e) => setValidateOnly(e.target.checked)}
                        />
                        <label htmlFor="validateOnly" className="text-sm">
                            <strong>Validar Apenas</strong>: Validar dados sem salvar no banco
                        </label>
                    </div>
                </div>

                {/* Botão */}
                <button
                    onClick={handleSync}
                    disabled={loading || !jsonData.trim()}
                    className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                        loading || !jsonData.trim()
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {loading ? '⏳ Sincronizando...' : '🔄 Iniciar Sincronização'}
                </button>
            </div>

            {/* Documentação */}
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-lg">📖 Documentação</h3>
                
                <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">sync_turmas</h4>
                    <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
{`[
  {
    "id": "EXTID001",           // ID externo (único)
    "escola_id": "ESCOLA_001",  // ID da escola
    "turma_nome": "6º Ano A",   // Nome da turma
    "disciplina": "Matemática", // Disciplina
    "professor_email": "email@" // Email do professor
  }
]`}
                    </pre>
                </div>

                <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">sync_alunos</h4>
                    <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
{`[
  {
    "id": "ALU001",
    "turma_id": "EXTID001", // ID externo da turma
    "nome": "João Silva",
    "codigo": "12345"
  }
]`}
                    </pre>
                </div>

                <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">sync_resultados</h4>
                    <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
{`[
  {
    "id": "RES001",
    "aluno_id": "ALU001",
    "gabarito_id": 1,  // ID do gabarito
    "nota": 8.5,
    "acertos": 23
  }
]`}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default BatchSyncComponent;
