import React, { useState, useEffect } from 'react';
import { Shield, Trash2, ArrowLeft, Terminal, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export const Debug: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<any>(null);
    const [isChecking, setIsChecking] = useState(false);

    const checkSystem = async () => {
        setIsChecking(true);
        try {
            // Test API Connection
            const start = Date.now();
            await api.getStats();
            const latency = Date.now() - start;

            setStatus({
                api: 'Online',
                latency: `${latency}ms`,
                token: localStorage.getItem('token') ? 'Válido (Encontrado)' : 'Ausente',
                apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000 (Padrão)',
                env: import.meta.env.MODE,
                user: localStorage.getItem('user') ? 'Logado' : 'Deslogado'
            });
        } catch (err) {
            setStatus({
                api: 'Offline ou Erro de Conexão',
                apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000 (Padrão)',
                error: String(err)
            });
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        checkSystem();
    }, []);

    const resetSystem = () => {
        if (confirm('ATENÇÃO: Isso irá limpar todos os dados salvos no navegador (Token, Login, etc). Você precisará logar novamente. Continuar?')) {
            localStorage.clear();
            alert('Sistema resetado com sucesso.');
            window.location.href = '/login';
        }
    };

    return (
        <div className="p-6 bg-[#f8fafc] min-h-screen">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="btn-secondary">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-2xl font-bold text-slate-800">Diagnóstico do Sistema</h1>
            </div>

            <div className="grid gap-6">
                <div className="card">
                    <div className="flex items-center gap-3 mb-4">
                        <Terminal size={24} className="text-blue-500" />
                        <h2 className="font-bold">Status da Infraestrutura</h2>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-slate-500">API Status</span>
                            <span className={`font-bold ${status?.api === 'Online' ? 'text-green-500' : 'text-red-500'}`}>
                                {status?.api || 'Verificando...'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-slate-500">Latência</span>
                            <span className="font-mono text-blue-600">{status?.latency || '-'}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2 text-xs">
                            <span className="text-slate-500">API URL</span>
                            <span className="font-mono">{status?.apiUrl || '-'}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-slate-500">Token</span>
                            <span className="font-bold">{status?.token || '-'}</span>
                        </div>
                    </div>

                    <button
                        onClick={checkSystem}
                        disabled={isChecking}
                        className="btn-primary w-full mt-6 justify-center"
                    >
                        <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
                        <span>Recarregar Diagnóstico</span>
                    </button>
                </div>

                <div className="card" style={{ borderColor: '#fee2e2' }}>
                    <div className="flex items-center gap-3 mb-4">
                        <Shield size={24} className="text-red-500" />
                        <h2 className="font-bold text-red-600">Área de Recuperação</h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">
                        Use estas ferramentas apenas se o sistema apresentar comportamentos inesperados ou se você não conseguir deslogar normalmente.
                    </p>

                    <button
                        onClick={resetSystem}
                        className="btn-danger w-full justify-center gap-2"
                    >
                        <Trash2 size={18} />
                        Limpeza Geral de Cache e Login
                    </button>
                </div>
            </div>

            <p className="text-center text-xs text-slate-400 mt-10">
                LERPROVA v2.5.0 - Build: {new Date(2026, 1, 16).toLocaleDateString()}
            </p>
        </div>
    );
};
