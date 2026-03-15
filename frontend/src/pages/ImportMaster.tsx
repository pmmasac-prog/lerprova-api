import React, { useState } from 'react';
import { CheckCircle, AlertCircle, FileText, School, Calendar, Users, Download, Upload } from 'lucide-react';
import { api } from '../services/api';

export const ImportMaster: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [mode, setMode] = useState<'csv' | 'json' | 'master'>('csv');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ message: string, turmas_criadas?: number, alunos_processados?: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const downloadCSVTemplate = () => {
        const headers = "Turma;Nome do Aluno;Matricula;Responsavel;Telefone;Email;Nascimento";
        const row = "7 A;Joao Silva;202401;Maria Silva;11999998888;maria@exemplo.com;2012-05-15";
        const csvContent = "\uFEFF" + headers + "\n" + row; // BOM for Excel
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "modelo_importacao_salas.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setInputText(text);
            setError(null);
        };
        reader.onerror = () => setError("Erro ao ler o arquivo.");
        reader.readAsText(file);
    };

    const parseCSV = (csv: string) => {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        const roomsMap: Record<string, any[]> = {};

        // Verificar se há cabeçalho
        const firstLine = lines[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const hasHeader = firstLine.includes('turma') || firstLine.includes('aluno') || firstLine.includes('nome');
        const startIdx = hasHeader ? 1 : 0;

        // Se tiver cabeçalho, identificar índices das colunas
        let turmaIdx = 0, nomeIdx = 1, codigoIdx = 2, responsavelIdx = -1, telefoneIdx = -1, emailIdx = -1, nascimentoIdx = -1;
        
        if (hasHeader) {
            const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
            turmaIdx = headers.findIndex(h => h.includes('turma') || h.includes('sala'));
            nomeIdx = headers.findIndex(h => h.includes('aluno') || h === 'nome');
            codigoIdx = headers.findIndex(h => h.includes('matricula') || h.includes('codigo'));
            responsavelIdx = headers.findIndex(h => h.includes('responsavel'));
            telefoneIdx = headers.findIndex(h => h.includes('telefone') || h.includes('celular') || h.includes('whatsapp'));
            emailIdx = headers.findIndex(h => h.includes('email'));
            nascimentoIdx = headers.findIndex(h => h.includes('nascimento'));
            
            // Se não encontrar, usar posições padrão
            if (turmaIdx === -1) turmaIdx = 0;
            if (nomeIdx === -1) nomeIdx = 1;
            if (codigoIdx === -1) codigoIdx = 2;
        }

        for (let i = startIdx; i < lines.length; i++) {
            const parts = lines[i].split(/[;,]/); // Suporta ponto e vírgula ou vírgula
            if (parts.length >= 3) {
                const roomName = parts[turmaIdx]?.trim();
                const studentName = parts[nomeIdx]?.trim();
                const studentCode = parts[codigoIdx]?.trim();
                const nomeResponsavel = responsavelIdx !== -1 ? parts[responsavelIdx]?.trim() : undefined;
                const telefoneResponsavel = telefoneIdx !== -1 ? parts[telefoneIdx]?.trim() : undefined;
                const emailResponsavel = emailIdx !== -1 ? parts[emailIdx]?.trim() : undefined;
                const dataNascimento = nascimentoIdx !== -1 ? parts[nascimentoIdx]?.trim() : undefined;

                if (roomName && studentName) {
                    if (!roomsMap[roomName]) roomsMap[roomName] = [];
                    roomsMap[roomName].push({ 
                        nome: studentName, 
                        codigo: studentCode,
                        nome_responsavel: nomeResponsavel || null,
                        telefone_responsavel: telefoneResponsavel || null,
                        email_responsavel: emailResponsavel || null,
                        data_nascimento: dataNascimento || null
                    });
                }
            }
        }

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
            
            if (mode === 'master') {
                // Importação completa via JSON Estrutural (Alcides César Meneses)
                const payload = JSON.parse(inputText);
                const res = await api.importMasterData(payload);
                setResult(res);
            } else {
                // Importação simples (CSV ou JSON de salas)
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
            }

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
                    <h1 className="admin-title">Base Central de Dados</h1>
                    <p className="admin-subtitle">Importe listas mestras de alunos ou a estrutura escolar completa.</p>
                </div>
            </header>

            <div className="admin-card" style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'default' }}>
                        <FileText size={18} /> Importação CSV (Padrão)
                    </div>
                    
                    <button
                        className="btn-ghost"
                        onClick={downloadCSVTemplate}
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--admin-gold)', marginLeft: '10px' }}
                    >
                        <Download size={18} /> Baixar Modelo CSV
                    </button>

                    <div style={{ flex: 1 }} />

                    <button
                        className={`btn-secondary`}
                        onClick={() => { setMode(mode === 'master' ? 'csv' : 'master'); setInputText(''); setError(null); }}
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', opacity: 0.7 }}
                    >
                        {mode === 'master' ? <FileText size={14} /> : <School size={14} />} 
                        {mode === 'master' ? 'Voltar para Salas' : 'Importação Estrutural (JSON)'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1 }}>
                        <h3 className="admin-card-title">Conteúdo da Importação</h3>
                        <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
                                {mode === 'csv' && "Formato esperado: Turma;Nome do Aluno;Matrícula;Responsável;Telefone;Email;Nascimento"}
                                {mode === 'master' && "Formato: JSON Estrutural (Escolas, Anos Letivos, Períodos, Eventos)"}
                            </p>
                            
                            {mode === 'csv' && (
                                <div style={{ 
                                    border: '2px dashed var(--border-color)', 
                                    padding: '20px', 
                                    borderRadius: '8px', 
                                    textAlign: 'center',
                                    background: 'rgba(255,255,255,0.02)'
                                }}>
                                    <input
                                        type="file"
                                        id="csv-upload"
                                        accept=".csv"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="csv-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                        <Upload size={24} color="var(--color-primary)" />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Selecionar Arquivo CSV</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>O conteúdo aparecerá na caixa abaixo</span>
                                    </label>
                                </div>
                            )}
                        </div>
                        <textarea
                            style={{
                                width: '100%',
                                height: '350px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: '#e5e7eb',
                                padding: '15px',
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                resize: 'none'
                            }}
                            placeholder={mode === 'csv' ? "Ex:\n7 A;Joao Silva;202401;Maria Silva;11999998888\n7 A;Pedro Santos;202402;Ana Santos;11988887777" : "Cole o código JSON aqui..."}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                        <button
                            className="btn-primary"
                            style={{ 
                                marginTop: '15px', 
                                width: '100%', 
                                height: '50px', 
                                fontSize: '16px',
                                background: mode === 'master' ? 'var(--admin-emerald)' : ''
                            }}
                            onClick={handleImport}
                            disabled={loading || !inputText}
                        >
                            {loading ? 'Processando...' : 'Processar Agora'}
                        </button>
                    </div>

                    <div style={{ width: '300px', background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px' }}>
                        <h4 style={{ color: 'var(--color-text)', marginBottom: '10px' }}>Orientações</h4>
                        
                        {mode === 'master' ? (
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                    <School size={32} color="var(--admin-emerald)" />
                                    <p><b>Escolas e Unidades</b>: Cria o registro oficial das escolas no sistema.</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                    <Calendar size={32} color="var(--admin-gold)" />
                                    <p><b>Calendário 2026</b>: Define datas de início/fim e feriados.</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Users size={32} color="var(--color-primary)" />
                                    <p><b>Bimestres</b>: Organiza os períodos de notas e avaliações.</p>
                                </div>
                            </div>
                        ) : (
                            <ol style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', paddingLeft: '15px', lineHeight: '1.6' }}>
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
                        )}

                        <div style={{ marginTop: '20px', padding: '15px', background: '#1f2937', borderRadius: '8px', border: '1px dashed var(--color-text-muted)' }}>
                            <p style={{ color: '#60a5fa', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px' }}>Dica:</p>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                {mode === 'master' 
                                    ? "Use o arquivo 'dados_app_gestao_escolar_2026.json' para popular o sistema completo."
                                    : "Você pode copiar direto de uma planilha Excel."}
                            </p>
                        </div>
                    </div>
                </div>

                {result && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#065f46', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <CheckCircle color="#34d399" />
                        <div>
                            <p style={{ color: '#ecfdf5', fontWeight: 'bold' }}>{result.message}</p>
                            {result.turmas_criadas !== undefined && (
                                <p style={{ color: '#d1fae5', fontSize: '0.85rem' }}>
                                    {result.turmas_criadas} registros processados.
                                </p>
                            )}
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
