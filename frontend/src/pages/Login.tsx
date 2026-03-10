import React, { useState } from 'react';
import { Mail, Lock, Shield, ArrowRight, Loader2, Database, Settings, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Login.css';

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
        <div className="login-container">
            {/* Version Banner */}
            <div className="login-version-banner">
                LERPROVA · SISTEMA EDUCACIONAL
            </div>

            {/* Logo */}
            <div className="login-logo">
                <div className="login-logo-icon">
                    <Shield />
                </div>
            </div>

            {/* Login Card */}
            <div className="login-card">
                {/* Type Selector */}
                <div className="login-type-selector">
                    <span className="login-type-label">Tipo de Acesso</span>
                    <div className="login-type-buttons">
                        <button
                            type="button"
                            onClick={() => { setLoginType('professor'); setError(''); }}
                            className={`login-type-btn ${loginType === 'professor' ? 'active' : ''}`}
                        >
                            <Settings />
                            PROFESSOR
                        </button>
                        <button
                            type="button"
                            onClick={() => { setLoginType('student'); setError(''); }}
                            className={`login-type-btn ${loginType === 'student' ? 'active' : ''}`}
                        >
                            <UserIcon />
                            ALUNO
                        </button>
                    </div>
                </div>

                {/* Title */}
                <div className="login-title">
                    <h2>{loginType === 'professor' ? 'Login Docente' : 'Login Aluno'}</h2>
                </div>

                {/* Error */}
                {error && (
                    <div className="login-error">
                        <Shield size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="login-input-group">
                        <div className="login-input-icon">
                            {loginType === 'professor' ? <Mail size={20} /> : <Database size={20} />}
                        </div>
                        <input
                            type={loginType === 'professor' ? 'email' : 'text'}
                            value={loginType === 'professor' ? email : codigo}
                            onChange={(e) => loginType === 'professor' ? setEmail(e.target.value) : setCodigo(e.target.value)}
                            placeholder={loginType === 'professor' ? 'E-mail Institucional' : 'Código de Matrícula'}
                            className="login-input"
                            required
                        />
                    </div>

                    <div className="login-input-group">
                        <div className="login-input-icon">
                            <Lock size={20} />
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Senha de Acesso"
                            className="login-input"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="login-submit"
                    >
                        {isLoading ? (
                            <Loader2 className="login-spinner" />
                        ) : (
                            <>
                                {loginType === 'student' ? 'ENTRAR NO PORTAL' : 'ENTRAR NO SISTEMA'}
                                <ArrowRight />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
