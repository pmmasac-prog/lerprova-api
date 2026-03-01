import React, { useState } from 'react';
import { Mail, Lock, Shield, ArrowRight, Loader2, Database, Settings, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export const Login: React.FC = () => {
    const [loginType, setLoginType] = useState<'professor' | 'student'>('professor');
    const [email, setEmail] = useState('');
    const [codigo, setCodigo] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            let res;
            if (loginType === 'professor') {
                res = await api.login(email, password);
            } else {
                res = await api.student.login(codigo, password);
            }

            if (res.access_token) {
                localStorage.setItem('token', res.access_token);
                if (res.user) {
                    localStorage.setItem('user', JSON.stringify(res.user));
                }

                const userRole = res.user?.role || (loginType === 'student' ? 'student' : 'professor');

                if (userRole === 'admin') {
                    navigate('/admin');
                } else if (userRole === 'student') {
                    navigate('/portal-aluno');
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError(res.detail || res.error || 'Falha na autenticação');
            }
        } catch (err: any) {
            setError(err.message || 'Dados incorretos ou erro de conexão.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#020617] font-sans p-4">
            {/* BANNER DE CONFIRMAÇÃO VISUAL */}
            <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-[10px] font-bold text-center py-1 z-[100]">
                VERSÃO ATUALIZADA (COM SELETOR)
            </div>
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[160px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-600/20 rounded-full blur-[160px] animate-pulse pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                {/* Logo Area */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-[#0f172a] border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl mb-4">
                        <Shield className="w-10 h-10 text-blue-400" />
                    </div>
                </div>

                {/* Login Card */}
                <div className="bg-[#0f172a] border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">

                    {/* TIPO DE ACESSO - SELECTOR SUPER VISÍVEL */}
                    <div className="mb-8">
                        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-[0.2em] mb-3 text-center">Tipo de Acesso</p>
                        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10">
                            <button
                                type="button"
                                onClick={() => { setLoginType('professor'); setError(''); }}
                                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl transition-all font-black text-xs ${loginType === 'professor' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Settings size={18} />
                                PROFESSOR
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLoginType('student'); setError(''); }}
                                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl transition-all font-black text-xs ${loginType === 'student' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <UserIcon size={18} />
                                ALUNO
                            </button>
                        </div>
                    </div>

                    <div className="mb-8 text-center">
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {loginType === 'professor' ? 'Login Docente' : 'Login Aluno'}
                        </h2>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-3">
                            <Shield size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    {loginType === 'professor' ?
                                        <Mail className="w-5 h-5 text-slate-500" /> :
                                        <Database className="w-5 h-5 text-slate-500" />
                                    }
                                </div>
                                <input
                                    type={loginType === 'professor' ? 'email' : 'text'}
                                    value={loginType === 'professor' ? email : codigo}
                                    onChange={(e) => loginType === 'professor' ? setEmail(e.target.value) : setCodigo(e.target.value)}
                                    placeholder={loginType === 'professor' ? 'E-mail Institucional' : 'Código de Matrícula'}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold text-sm"
                                    required
                                />
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    <Lock className="w-5 h-5 text-slate-500" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Senha de Acesso"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm rounded-xl transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 mt-4"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>
                                    {loginType === 'student' ? 'ENTRAR NO PORTAL' : 'ENTRAR NO SISTEMA'}
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
