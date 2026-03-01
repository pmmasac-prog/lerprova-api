import React, { useState } from 'react';
import { CheckCircle, AlertCircle, FileText, Code as CodeIcon } from 'lucide-react';
import { api } from '../services/api';

export const ImportMaster: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [mode, setMode] = useState<'csv' | 'json'>('csv');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ message: string, turmas_criadas: number, alunos_processados: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const parseCSV = (csv: string) => {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        const roomsMap: Record<string, any[]> = {};

        lines.forEach(line => {
            const parts = line.split(/[;,]/); // Suporta ponto e vírgula ou vírgula
            if (parts.length >= 3) {
                const roomName = parts[0].trim();
                const studentName = parts[1].trim();
                const studentCode = parts[2].trim();

                if (!roomsMap[roomName]) roomsMap[roomName] = [];
                roomsMap[roomName].push({ nome: studentName, codigo: studentCode });
            }
        });

        return Object.keys(roomsMap).map(name => ({
            nome: name,
            alunos: roomsMap[name]
        }));
    };

    const handleImport = async () => {
        try {
            setLoading(true);
            setError(null);
            setResult(null);

            let data;
            if (mode === 'json') {
                data = JSON.parse(inputText);
            } else {
                data = parseCSV(inputText);
            }

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error("Nenhum dado válido identificado. Verifique o formato.");
            }

            const res = await api.admin.importMasterData(data);
            setResult(res);
            setInputText('');
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao processar dados ou enviar ao servidor.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-container">
            <header className="admin-header">
                <div>
                    <h1 className="admin-title">Base Central de Alunos</h1>
                    <p className="admin-subtitle">Importe listas mestras de alunos (CSV ou JSON).</p>
                </div>
            </header>

            <div className="admin-card" style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                    <button
                        className={`btn-${mode === 'csv' ? 'primary' : 'secondary'}`}
                        onClick={() => { setMode('csv'); setInputText(''); setError(null); }}
                        style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                    >
                        <FileText size={18} /> Importar CSV
                    </button>
                    <button
                        className={`btn-${mode === 'json' ? 'primary' : 'secondary'}`}
                        onClick={() => { setMode('json'); setInputText(''); setError(null); }}
                        style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                    >
                        <CodeIcon size={18} /> Importar JSON
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1 }}>
                        <h3 className="admin-card-title">Inserir Conteúdo</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '10px' }}>
                            {mode === 'csv'
                                ? "Formato esperado: Turma;Nome do Aluno;Matrícula"
                                : "Formato esperado: [{ 'nome': 'Sala X', 'alunos': [...] }]"}
                        </p>
                        <textarea
                            style={{
                                width: '100%',
                                height: '350px',
                                background: '#111827',
                                border: '1px solid #374151',
                                borderRadius: '8px',
                                color: '#e5e7eb',
                                padding: '15px',
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                resize: 'none'
                            }}
                            placeholder={mode === 'csv' ? "Ex:\n7 A;Joao Silva;202401\n7 A;Maria Santos;202402" : "Paste JSON here..."}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                        <button
                            className="btn-primary"
                            style={{ marginTop: '15px', width: '100%', height: '50px', fontSize: '16px' }}
                            onClick={handleImport}
                            disabled={loading || !inputText}
                        >
                            {loading ? 'Processando...' : 'Processar Agora'}
                        </button>
                    </div>

                    <div style={{ width: '300px', background: '#111827', padding: '20px', borderRadius: '12px' }}>
                        <h4 style={{ color: '#f3f4f6', marginBottom: '10px' }}>Orientações</h4>
                        <ol style={{ color: '#94a3b8', fontSize: '0.85rem', paddingLeft: '15px', lineHeight: '1.6' }}>
                            <li style={{ marginBottom: '10px' }}>
                                <b>CSV</b>: Cada linha deve ter os 3 campos separados por "<b>;</b>" ou "<b>,</b>".
                            </li>
                            <li style={{ marginBottom: '10px' }}>
                                <b>Evite Duplicatas</b>: O sistema usa a matrícula para verificar se o aluno já existe.
                            </li>
                            <li>
                                <b>Visualização</b>: Após importar, as salas aparecerão para todos os professores no menu "Importar Central".
                            </li>
                        </ol>

                        <div style={{ marginTop: '20px', padding: '15px', background: '#1f2937', borderRadius: '8px', border: '1px dashed #4b5563' }}>
                            <p style={{ color: '#60a5fa', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px' }}>Dica:</p>
                            <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                Você pode copiar direto de uma planilha Excel. O separador padrão (ponto e vírgula) será reconhecido.
                            </p>
                        </div>
                    </div>
                </div>

                {result && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#065f46', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <CheckCircle color="#34d399" />
                        <div>
                            <p style={{ color: '#ecfdf5', fontWeight: 'bold' }}>{result.message}</p>
                            <p style={{ color: '#d1fae5', fontSize: '0.85rem' }}>
                                {result.turmas_criadas} salas registradas com sucesso.
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
