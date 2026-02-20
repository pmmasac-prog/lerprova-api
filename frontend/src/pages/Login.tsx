import React, { useState } from 'react';
import { Mail, Lock, Shield, ArrowRight, Loader2, Sparkles, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await api.login(email, password);

            if (res.access_token) {
                localStorage.setItem('token', res.access_token);
                if (res.user) {
                    localStorage.setItem('user', JSON.stringify(res.user));
                }
                console.log("Login realizado com sucesso!");
                if (res.user?.role === 'admin') {
                    navigate('/admin');
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError(res.detail || res.error || 'Falha na autenticação');
            }
        } catch (err: any) {
            setError('Não foi possível conectar ao servidor. Verifique sua conexão.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#020617] font-sans p-4">
            {/* Massive Background Blobs */}
            <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[160px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-600/20 rounded-full blur-[160px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />
            <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] bg-indigo-500/10 rounded-full blur-[100px] animate-bounce pointer-events-none" style={{ animationDuration: '10s' }} />

            <div className="relative z-10 w-full max-w-lg">
                {/* Brand Logo Floating */}
                <div className="flex flex-col items-center mb-10">
                    <div className="relative group cursor-default">
                        <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative w-24 h-24 bg-[#0f172a] border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-500 group-hover:rotate-[10deg]">
                            <Shield className="w-12 h-12 text-blue-400 group-hover:text-cyan-400 transition-colors" />
                        </div>
                        <div className="absolute -top-2 -right-2 bg-blue-600 p-1.5 rounded-full shadow-lg border-2 border-[#020617]">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <div className="mt-6 text-center">
                        <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-white via-blue-100 to-blue-400 bg-clip-text text-transparent italic leading-tight">
                            LERPROVA
                        </h1>
                        <div className="flex items-center gap-2 justify-center mt-1">
                            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-blue-500/50"></div>
                            <span className="text-sm font-bold tracking-[0.2em] text-blue-500/80 uppercase">Elite OMR System</span>
                            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-blue-500/50"></div>
                        </div>
                    </div>
                </div>

                {/* Main Card */}
                <div className="backdrop-blur-[40px] bg-white/[0.03] border border-white/10 rounded-[3rem] p-8 sm:p-12 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                    {/* Inner highlight */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 blur-[60px] rounded-full group-hover:translate-x-10 transition-transform duration-1000" />

                    <div className="relative z-10">
                        <div className="mb-10 text-center">
                            <h2 className="text-3xl font-bold text-white tracking-tight">Portal do Professor</h2>
                            <p className="text-slate-400 mt-2">Acesse sua central de avaliações inteligentes</p>
                        </div>

                        {error && (
                            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle size={18} />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Credenciais de Acesso</label>
                                <div className="space-y-4">
                                    <div className="relative group/input">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-0 group-focus-within/input:opacity-10 transition duration-300"></div>
                                        <div className="relative flex items-center">
                                            <Mail className="absolute left-5 w-5 h-5 text-slate-500 group-focus-within/input:text-blue-500 transition-colors" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="nome@instituicao.edu.br"
                                                className="w-full bg-[#0f172a]/50 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:bg-[#0f172a]/80 transition-all duration-300 shadow-inner"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="relative group/input">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-0 group-focus-within/input:opacity-10 transition duration-300"></div>
                                        <div className="relative flex items-center">
                                            <Lock className="absolute left-5 w-5 h-5 text-slate-500 group-focus-within/input:text-blue-500 transition-colors" />
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className="w-full bg-[#0f172a]/50 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:bg-[#0f172a]/80 transition-all duration-300 shadow-inner"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs px-1">
                                <label className="flex items-center gap-2 text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
                                    <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-600 focus:ring-blue-500/50" />
                                    Lembrar acesso
                                </label>
                                <a href="#" className="text-blue-500 font-bold hover:text-blue-400 transition-colors">Esqueceu a senha?</a>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative group/btn"
                            >
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-md opacity-25 group-hover/btn:opacity-60 transition duration-500"></div>
                                <div className="relative flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl transition-all duration-300 active:scale-[0.97] disabled:opacity-70 group-hover/btn:translate-y-[-2px]">
                                    {isLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            ENTRAR NO SISTEMA
                                            <ArrowRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-1.5" />
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>

                        <div className="mt-12 flex flex-col items-center gap-6">
                            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                            <div className="flex items-center gap-8 text-slate-500">
                                <div className="flex flex-col items-center gap-1">
                                    <Database size={18} />
                                    <span className="text-[10px] uppercase font-bold tracking-tighter">Encrypted</span>
                                </div>
                                <div className="w-[1px] h-8 bg-white/5"></div>
                                <div className="flex flex-col items-center gap-1">
                                    <Shield size={18} />
                                    <span className="text-[10px] uppercase font-bold tracking-tighter">Safe Vault</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-center text-slate-600 text-[11px] mt-12 font-bold tracking-[0.2em] uppercase">
                    &copy; {new Date().getFullYear()} LERPROVA OMR &bull; Advanced Educational Systems
                </p>
            </div>
        </div>
    );
};

const AlertCircle = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);
