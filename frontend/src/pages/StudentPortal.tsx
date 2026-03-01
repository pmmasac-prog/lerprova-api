import React, { useState, useEffect } from 'react';
import {
    LogOut, BookOpen, Clock,
    Shield, Star,
    Lock, CheckCircle, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';

export const StudentPortal: React.FC = () => {
    const [student, setStudent] = useState<any>(null);
    const [results, setResults] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [passwordStatus, setPasswordStatus] = useState({ type: '', msg: '' });

    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [me, res, freq] = await Promise.all([
                api.student.getMe(),
                api.student.getResultados(),
                api.student.getFrequencia()
            ]);
            setStudent(me);
            setResults(res);
            setAttendance(freq);
        } catch (err: any) {
            console.error(err);
            setError('Falha ao carregar dados do portal.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordStatus({ type: 'loading', msg: 'Alterando...' });
        try {
            await api.student.changePassword(newPassword);
            setPasswordStatus({ type: 'success', msg: 'Senha alterada com sucesso!' });
            setTimeout(() => {
                setShowPasswordModal(false);
                setPasswordStatus({ type: '', msg: '' });
                setNewPassword('');
            }, 2000);
        } catch (err: any) {
            setPasswordStatus({ type: 'error', msg: err.message || 'Erro ao alterar senha' });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="text-blue-500 animate-pulse font-bold tracking-widest uppercase">Carregando Portal...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <h2 className="text-white text-xl font-bold mb-2">Ops! Algo deu errado</h2>
                <p className="text-slate-400 mb-6">{error}</p>
                <button onClick={loadData} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Tentar Novamente</button>
            </div>
        );
    }

    // Calcular média e presença
    const avgNota = results.length > 0 ? (results.reduce((acc, r) => acc + r.nota, 0) / results.length).toFixed(1) : 'N/A';
    const totalPresente = attendance.filter(f => f.presente).length;
    const presenceRate = attendance.length > 0 ? ((totalPresente / attendance.length) * 100).toFixed(0) : '100';

    return (
        <div className="min-h-screen bg-[#020617] text-white font-sans pb-12">
            {/* Header */}
            <header className="p-6 flex items-center justify-between border-b border-white/5 bg-[#0f172a]/50 backdrop-blur-xl sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h1 className="font-black tracking-tight text-lg">LERPROVA</h1>
                        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Portal do Aluno</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                    <LogOut size={20} />
                </button>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-8">
                {/* Welcome Card */}
                <section className="relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-10 rounded-3xl group-hover:opacity-15 transition-opacity" />
                    <div className="relative p-8 border border-white/5 rounded-3xl bg-white/[0.02]">
                        <h2 className="text-3xl font-black mb-1">Olá, {student.nome}!</h2>
                        <p className="text-slate-400">RA/Código: <span className="text-blue-400 font-mono font-bold tracking-tight">{student.codigo}</span></p>

                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <div className="bg-white/5 p-4 rounded-2xl">
                                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Média Geral</p>
                                <div className="flex items-center gap-2">
                                    <Star size={16} className="text-yellow-500" />
                                    <span className="text-2xl font-black">{avgNota}</span>
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl">
                                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Presença</p>
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={16} className="text-green-500" />
                                    <span className="text-2xl font-black">{presenceRate}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid md:grid-cols-5 gap-8">
                    {/* QR Code Section */}
                    <section className="md:col-span-2 space-y-4">
                        <div className="bg-white p-4 rounded-3xl shadow-2xl flex flex-col items-center">
                            <p className="text-black text-[10px] font-black uppercase tracking-widest mb-4">Seu QR Individual</p>
                            <div className="p-2 bg-white">
                                {student.qr_token && (
                                    <QRCodeSVG value={student.qr_token} size={180} />
                                )}
                            </div>
                            <p className="text-black/40 text-[9px] mt-4 font-bold text-center">APRESENTE PARA O PROFESSOR PARA MARCAR PRESENÇA</p>
                        </div>

                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-400 font-bold text-sm hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                        >
                            <Lock size={16} />
                            Mudar Senha de Acesso
                        </button>
                    </section>

                    {/* Stats & History */}
                    <section className="md:col-span-3 space-y-6">
                        {/* Grades History */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold flex items-center gap-2">
                                    <BookOpen size={18} className="text-blue-500" />
                                    Notas Recentes
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {results.length === 0 ? (
                                    <div className="p-6 text-center bg-white/5 rounded-2xl text-slate-500 text-sm">Nenhuma nota registrada ainda.</div>
                                ) : (
                                    results.map((r: any) => (
                                        <div key={r.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all">
                                            <div>
                                                <p className="font-bold text-sm">{r.gabarito_titulo}</p>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">{r.disciplina || 'Geral'}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-lg font-black ${r.nota >= 7 ? 'text-green-400' : 'text-yellow-400'}`}>{r.nota.toFixed(1)}</span>
                                                <p className="text-[9px] text-slate-600">{r.acertos}/{r.total_questoes} acertos</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Recent Presence */}
                        <div>
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <Clock size={18} className="text-blue-500" />
                                Últimas Presenças
                            </h3>
                            <div className="space-y-2">
                                {attendance.length === 0 ? (
                                    <div className="p-6 text-center bg-white/5 rounded-2xl text-slate-500 text-sm">Sem histórico de chamadas.</div>
                                ) : (
                                    attendance.slice(0, 5).map((f: any, i: number) => (
                                        <div key={i} className="px-4 py-3 bg-white/[0.02] rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${f.presente ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                                <span className="text-xs font-bold">{f.turma}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-mono">{f.data}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0f172a] border border-white/10 w-full max-w-sm rounded-3xl p-8 shadow-2xl scale-in-center">
                        <h3 className="text-xl font-bold mb-4">Nova Senha</h3>

                        {passwordStatus.msg && (
                            <div className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${passwordStatus.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                                {passwordStatus.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
                                {passwordStatus.msg}
                            </div>
                        )}

                        <form onSubmit={handleChangePassword} className="space-y-6">
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Digite sua nova senha"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                required
                            />
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 py-3 text-slate-400 font-bold text-xs"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    type="submit"
                                    disabled={passwordStatus.type === 'loading'}
                                    className="flex-1 py-3 bg-blue-600 rounded-xl font-bold text-xs hover:bg-blue-500"
                                >
                                    SALVAR
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
