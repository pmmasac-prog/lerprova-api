import React, { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export const ImportMaster: React.FC = () => {
    const [jsonInput, setJsonInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ message: string, turmas_criadas: number, alunos_processados: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleImport = async () => {
        try {
            setLoading(true);
            setError(null);
            setResult(null);

            const data = JSON.parse(jsonInput);

            if (!Array.isArray(data)) {
                throw new Error("O formato deve ser uma lista de salas.");
            }

            const res = await api.admin.importMasterData(data);
            setResult(res);
            setJsonInput('');
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao processar JSON ou enviar ao servidor.");
        } finally {
            setLoading(false);
        }
    };

    const exampleJson = [
        {
            "nome": "7º Ano A",
            "alunos": [
                { "nome": "João Silva", "codigo": "2024001" },
                { "nome": "Maria Santos", "codigo": "2024002" }
            ]
        }
    ];

    return (
        <div className="admin-container">
            <header className="admin-header">
                <div>
                    <h1 className="admin-title">Base Central de Alunos</h1>
                    <p className="admin-subtitle">Importe listas mestras de alunos para os professores incorporarem.</p>
                </div>
            </header>

            <div className="admin-card" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1 }}>
                        <h3 className="admin-card-title">Inserir Dados (JSON)</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '10px' }}>
                            Cole abaixo a estrutura JSON contendo as salas e alunos.
                        </p>
                        <textarea
                            style={{
                                width: '100%',
                                height: '300px',
                                background: '#111827',
                                border: '1px solid #374151',
                                borderRadius: '8px',
                                color: '#e5e7eb',
                                padding: '15px',
                                fontFamily: 'monospace',
                                fontSize: '13px'
                            }}
                            placeholder="Ex: [{ 'nome': 'Sala X', 'alunos': [...] }]"
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                        />
                        <button
                            className="btn-primary"
                            style={{ marginTop: '15px', width: '100%' }}
                            onClick={handleImport}
                            disabled={loading || !jsonInput}
                        >
                            {loading ? 'Processando...' : 'Iniciar Importação'}
                        </button>
                    </div>

                    <div style={{ width: '300px', background: '#111827', padding: '20px', borderRadius: '12px' }}>
                        <h4 style={{ color: '#f3f4f6', marginBottom: '10px' }}>Como Usar</h4>
                        <ol style={{ color: '#94a3b8', fontSize: '0.85rem', paddingLeft: '20px' }}>
                            <li style={{ marginBottom: '8px' }}>Prepare uma lista de salas e alunos.</li>
                            <li style={{ marginBottom: '8px' }}>Siga o modelo JSON ao lado.</li>
                            <li style={{ marginBottom: '8px' }}>O sistema verificará se o aluno (pelo código) já existe para evitar duplicatas.</li>
                            <li>Os professores poderão ver essas salas no menu "Importar Central".</li>
                        </ol>

                        <div style={{ marginTop: '20px', padding: '10px', background: '#1f2937', borderRadius: '8px' }}>
                            <p style={{ color: '#60a5fa', fontSize: '0.8rem', fontWeight: 'bold' }}>Exemplo de Estrutura:</p>
                            <pre style={{ color: '#94a3b8', fontSize: '0.75rem', overflowX: 'auto' }}>
                                {JSON.stringify(exampleJson, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {result && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#065f46', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <CheckCircle color="#34d399" />
                        <div>
                            <p style={{ color: '#ecfdf5', fontWeight: 'bold' }}>{result.message}</p>
                            <p style={{ color: '#d1fae5', fontSize: '0.85rem' }}>
                                {result.turmas_criadas} salas criadas e {result.alunos_processados} novos alunos cadastrados.
                            </p>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#7f1d1d', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <AlertCircle color="#f87171" />
                        <p style={{ color: '#fef2f2', fontWeight: 'bold' }}>{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
