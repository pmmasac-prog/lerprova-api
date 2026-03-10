import React, { useState, useEffect } from 'react';
import {
    LogOut, BookOpen, Clock,
    Shield, Star,
    Lock, CheckCircle, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import './StudentPortal.css';

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
            <div className="portal-loading">
                <div className="portal-loading-text">Carregando Portal...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="portal-error">
                <AlertCircle />
                <h2>Ops! Algo deu errado</h2>
                <p>{error}</p>
                <button onClick={loadData}>Tentar Novamente</button>
            </div>
        );
    }

    // Calcular média e presença
    const avgNota = results.length > 0 ? (results.reduce((acc, r) => acc + r.nota, 0) / results.length).toFixed(1) : 'N/A';
    const totalPresente = attendance.filter(f => f.presente).length;
    const presenceRate = attendance.length > 0 ? ((totalPresente / attendance.length) * 100).toFixed(0) : '100';

    return (
        <div className="portal-container">
            {/* Header */}
            <header className="portal-header">
                <div className="portal-header-left">
                    <div className="portal-logo">
                        <Shield />
                    </div>
                    <div className="portal-brand">
                        <h1>LERPROVA</h1>
                        <p>Portal do Aluno</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="portal-logout">
                    <LogOut size={20} />
                </button>
            </header>

            <main className="portal-main">
                {/* Welcome Card */}
                <section className="portal-welcome">
                    <div className="portal-welcome-bg" />
                    <div className="portal-welcome-content">
                        <h2>Olá, {student.nome}!</h2>
                        <p className="portal-codigo">RA/Código: <span>{student.codigo}</span></p>

                        <div className="portal-stats">
                            <div className="portal-stat">
                                <p className="portal-stat-label">Média Geral</p>
                                <div className="portal-stat-value">
                                    <Star className="star" />
                                    <span>{avgNota}</span>
                                </div>
                            </div>
                            <div className="portal-stat">
                                <p className="portal-stat-label">Presença</p>
                                <div className="portal-stat-value">
                                    <CheckCircle className="check" />
                                    <span>{presenceRate}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="portal-grid">
                    {/* QR Code Section */}
                    <section className="portal-qr-section">
                        <div className="portal-qr-card">
                            <p className="portal-qr-title">Seu QR Individual</p>
                            <div className="portal-qr-code">
                                {student.qr_token && (
                                    <QRCodeSVG value={student.qr_token} size={180} />
                                )}
                            </div>
                            <p className="portal-qr-hint">Apresente para o professor para marcar presença</p>
                        </div>

                        <button onClick={() => setShowPasswordModal(true)} className="portal-password-btn">
                            <Lock />
                            Mudar Senha de Acesso
                        </button>
                    </section>

                    {/* Stats & History */}
                    <section className="portal-history">
                        {/* Grades History */}
                        <div>
                            <div className="portal-section-header">
                                <BookOpen />
                                <h3>Notas Recentes</h3>
                            </div>
                            <div className="portal-grades">
                                {results.length === 0 ? (
                                    <div className="portal-empty">Nenhuma nota registrada ainda.</div>
                                ) : (
                                    results.map((r: any) => (
                                        <div key={r.id} className="portal-grade-card">
                                            <div className="portal-grade-info">
                                                <h4>{r.gabarito_titulo}</h4>
                                                <p>{r.disciplina || 'Geral'}</p>
                                            </div>
                                            <div className="portal-grade-score">
                                                <span className={`score ${r.nota >= 7 ? 'high' : 'medium'}`}>{r.nota.toFixed(1)}</span>
                                                <p className="acertos">{r.acertos}/{r.total_questoes} acertos</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Recent Presence */}
                        <div>
                            <div className="portal-section-header">
                                <Clock />
                                <h3>Últimas Presenças</h3>
                            </div>
                            <div className="portal-attendance">
                                {attendance.length === 0 ? (
                                    <div className="portal-empty">Sem histórico de chamadas.</div>
                                ) : (
                                    attendance.slice(0, 5).map((f: any, i: number) => (
                                        <div key={i} className="portal-attendance-item">
                                            <div className="portal-attendance-left">
                                                <div className={`portal-presence-dot ${f.presente ? 'present' : 'absent'}`} />
                                                <span className="portal-attendance-turma">{f.turma}</span>
                                            </div>
                                            <span className="portal-attendance-date">{f.data}</span>
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
                <div className="portal-modal-overlay">
                    <div className="portal-modal">
                        <h3>Nova Senha</h3>

                        {passwordStatus.msg && (
                            <div className={`portal-modal-status ${passwordStatus.type}`}>
                                {passwordStatus.type === 'error' ? <AlertCircle /> : <CheckCircle />}
                                {passwordStatus.msg}
                            </div>
                        )}

                        <form onSubmit={handleChangePassword}>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Digite sua nova senha"
                                required
                            />
                            <div className="portal-modal-buttons">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="portal-modal-cancel"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    type="submit"
                                    disabled={passwordStatus.type === 'loading'}
                                    className="portal-modal-submit"
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
