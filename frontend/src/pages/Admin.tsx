import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, ArrowLeft, Shield, School, Search, RefreshCw, Upload, Download, X, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Admin.css';

interface User {
    id: number;
    nome: string;
    email: string;
    role: string;
    escola: string;
    disciplina: string;
    plan_type: string;
}

export const Admin: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    const [newUser, setNewUser] = useState({
        nome: '',
        email: '',
        password: '',
        role: 'professor',
        escola: '',
        disciplina: ''
    });

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const [showImportModal, setShowImportModal] = useState(false);
    const [importPreview, setImportPreview] = useState<any[]>([]);
    const [importResult, setImportResult] = useState<any>(null);
    const [importing, setImporting] = useState(false);

    const downloadProfessorTemplate = () => {
        const headers = "Nome;Email;Senha;Escola;Disciplina;Plano";
        const row1 = "Ana Paula Costa;ana@escola.com;senha123;E.E. Alcides César;Matemática;free";
        const row2 = "Carlos Eduardo;carlos@escola.com;1234abc;E.E. Dom Pedro;Português;free";
        const csv = "\uFEFF" + [headers, row1, row2].join("\n");
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modelo_importacao_professores.csv';
        a.click();
    };

    const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('Nome;'));
            const parsed = lines.map(line => {
                const [nome, email, password, escola, disciplina, plan_type] = line.split(';');
                return { nome: nome?.trim(), email: email?.trim(), password: password?.trim(), escola: escola?.trim() || '', disciplina: disciplina?.trim() || '', plan_type: plan_type?.trim() || 'free', role: 'professor' };
            }).filter(u => u.nome && u.email && u.password);
            setImportPreview(parsed);
            setImportResult(null);
        };
        reader.readAsText(file);
    };

    const handleImportSubmit = async () => {
        if (!importPreview.length) return;
        const semEscola = importPreview.filter(u => !u.escola);
        if (semEscola.length > 0) {
            alert(`${semEscola.length} professor(es) sem escola informada. A coluna Escola é obrigatória.`);
            return;
        }
        try {
            setImporting(true);
            const res = await api.admin.importUsers(importPreview);
            setImportResult(res);
            setImportPreview([]);
            loadUsers();
        } catch (err) {
            console.error(err);
        } finally {
            setImporting(false);
        }
    };

    useEffect(() => {
        console.log('Admin mounted, user:', currentUser);
        if (currentUser.role !== 'admin') {
            navigate('/dashboard');
            return;
        }
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await api.admin.listUsers();
            if (Array.isArray(data)) {
                setUsers(data);
            }
        } catch (error) {
            console.error('Erro ao listar usuários:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.admin.createUser(newUser);
            if (res.user) {
                setShowAddModal(false);
                setNewUser({
                    nome: '',
                    email: '',
                    password: '',
                    role: 'professor',
                    escola: '',
                    disciplina: ''
                });
                loadUsers();
            } else {
                alert(res.detail || 'Erro ao criar usuário');
            }
        } catch (error) {
            console.error('Erro ao criar usuário:', error);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (confirm('Deseja realmente excluir este professor? Todas as suas turmas e dados serão mantidos (dependendo da integridade do banco).')) {
            try {
                await api.admin.deleteUser(id);
                loadUsers();
            } catch (error) {
                console.error('Erro ao excluir:', error);
            }
        }
    };

    const filteredUsers = users.filter(u =>
        u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.escola?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="admin-container">
            <div className="admin-header">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="admin-title">Portal Administrativo</h1>
                        <p className="admin-subtitle">Inteligência e Gestão de Ecossistema</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-ghost" onClick={downloadProfessorTemplate} style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--admin-gold)' }}>
                        <Download size={18} /> Modelo CSV
                    </button>
                    <button className="btn-ghost" onClick={() => { setShowImportModal(true); setImportPreview([]); setImportResult(null); }} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Upload size={18} /> Importar Professores
                    </button>
                    <button className="btn-emerald" onClick={() => setShowAddModal(true)}>
                        <UserPlus size={18} />
                        <span>Cadastrar Professor</span>
                    </button>
                </div>
            </div>

            <div className="admin-stats-bar">
                <div className="admin-stat">
                    <div className="icon-bg icon-emerald">
                        <Users size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="label">Engajamento Total</span>
                        <span className="value">{users.length} Usuários</span>
                    </div>
                </div>
                <div className="admin-stat">
                    <div className="icon-bg icon-gold">
                        <Shield size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="label">Administradores</span>
                        <span className="value">{users.filter(u => u.role === 'admin').length} Ativos</span>
                    </div>
                </div>
                <div className="admin-stat">
                    <div className="icon-bg icon-emerald" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)' }}>
                        <School size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="label">Escolas Vinculadas</span>
                        <span className="value">{new Set(users.map(u => u.escola)).size} Unidades</span>
                    </div>
                </div>
            </div>

            <div className="admin-content card">
                <div className="table-header">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            id="admin-search"
                            name="admin-search"
                            type="text"
                            placeholder="Buscar por nome, email ou escola..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="refresh-btn" onClick={loadUsers} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="users-table-wrapper">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Nome / Email</th>
                                <th>Acesso</th>
                                <th>Instituição / Disciplina</th>
                                <th>Status Plano</th>
                                <th>Gestão</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(u => (
                                    <tr key={u.id}>
                                        <td>
                                            <div className="user-info-cell">
                                                <div className="user-avatar" style={{ background: u.role === 'admin' ? 'var(--admin-gold)' : 'var(--admin-emerald)' }}>
                                                    {u.nome.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="user-name">{u.nome}</p>
                                                    <p className="user-email">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`role-badge ${u.role}`}>
                                                {u.role === 'admin' ? 'GESTOR' : 'PROFESSOR'}
                                            </span>
                                        </td>
                                        <td>
                                            <p className="escola-text">{u.escola || 'Plataforma Global'}</p>
                                            <p className="disciplina-text text-xs text-slate-400">{u.disciplina || 'Geral'}</p>
                                        </td>
                                        <td>
                                            <span className={`plan-badge ${u.plan_type} ${u.plan_type === 'premium' ? 'text-amber-500' : ''}`}>
                                                {u.plan_type?.toUpperCase() || 'FREE'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-btns">
                                                <button className="icon-btn delete" onClick={() => handleDeleteUser(u.id)} disabled={u.id === currentUser.id} style={{ color: 'var(--color-danger)' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="empty-row text-center py-10 text-slate-500">
                                        Nenhum registro encontrado no ecossistema.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Importação em Massa */}
            {showImportModal && (
                <div className="modal-overlay">
                    <div className="admin-modal" style={{ maxWidth: '700px', width: '95%' }}>
                        <div className="modal-header">
                            <div>
                                <h1 className="admin-title" style={{ fontSize: '20px' }}>Importar Professores via CSV</h1>
                                <p className="admin-subtitle">Coluna <strong>Escola</strong> é obrigatória para todos os professores</p>
                            </div>
                            <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {!importResult ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                                <div style={{ border: '2px dashed var(--border-color)', borderRadius: '10px', padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <input type="file" accept=".csv" id="prof-csv-upload" onChange={handleImportFileUpload} style={{ display: 'none' }} />
                                    <label htmlFor="prof-csv-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                        <Upload size={28} color="var(--color-primary)" />
                                        <span style={{ fontWeight: 'bold' }}>Selecionar Arquivo CSV</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Formato: Nome;Email;Senha;Escola;Disciplina;Plano</span>
                                    </label>
                                </div>

                                {importPreview.length > 0 && (
                                    <div>
                                        <p style={{ fontWeight: 700, marginBottom: '8px' }}>{importPreview.length} professor(es) encontrado(s) no arquivo:</p>
                                        <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                    <tr>
                                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Nome</th>
                                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>E-mail</th>
                                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Escola *</th>
                                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Disciplina</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importPreview.map((u, i) => (
                                                        <tr key={i} style={{ borderTop: '1px solid var(--border-color)', background: !u.escola ? 'rgba(239,68,68,0.08)' : 'transparent' }}>
                                                            <td style={{ padding: '8px 12px' }}>{u.nome}</td>
                                                            <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{u.email}</td>
                                                            <td style={{ padding: '8px 12px', color: !u.escola ? 'var(--color-danger)' : 'inherit', fontWeight: !u.escola ? 700 : 400 }}>{u.escola || '⚠ Vazio'}</td>
                                                            <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{u.disciplina || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="form-actions" style={{ marginTop: '16px' }}>
                                            <button type="button" className="btn-ghost" onClick={() => setShowImportModal(false)}>Cancelar</button>
                                            <button type="button" className="btn-emerald" onClick={handleImportSubmit} disabled={importing} style={{ padding: '12px 28px' }}>
                                                {importing ? 'Importando...' : `Confirmar Importação (${importPreview.length})`}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                                <CheckCircle size={48} color="var(--admin-emerald)" />
                                <h2 style={{ margin: 0 }}>Importação Concluída!</h2>
                                <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
                                    <div><span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--admin-emerald)' }}>{importResult.criados}</span><p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Criados</p></div>
                                    <div><span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--admin-gold)' }}>{importResult.pulados}</span><p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Pulados</p></div>
                                </div>
                                {importResult.erros?.length > 0 && (
                                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px', width: '100%', textAlign: 'left' }}>
                                        <p style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--color-danger)' }}>Erros / Avisos:</p>
                                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                            {importResult.erros.map((e: string, i: number) => <li key={i}>{e}</li>)}
                                        </ul>
                                    </div>
                                )}
                                <button className="btn-emerald" onClick={() => setShowImportModal(false)} style={{ marginTop: '8px' }}>Fechar</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Cadastro - Visual Premium Emerald/Gold */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="admin-modal">
                        <div className="modal-header">
                            <div>
                                <h1 className="admin-title" style={{ fontSize: '20px' }}>Novo Gestor / Professor</h1>
                                <p className="admin-subtitle">Credencie novos profissionais ao ecossistema</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                <ArrowLeft size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="admin-form">
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label htmlFor="admin-user-nome">Nome Completo</label>
                                    <input
                                        id="admin-user-nome"
                                        name="admin-user-nome"
                                        type="text"
                                        className="admin-input"
                                        required
                                        value={newUser.nome}
                                        onChange={e => setNewUser({ ...newUser, nome: e.target.value })}
                                        placeholder="Ex: João Silva"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="admin-user-email">Email de Acesso</label>
                                    <input
                                        id="admin-user-email"
                                        name="admin-user-email"
                                        type="email"
                                        className="admin-input"
                                        required
                                        value={newUser.email}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        placeholder="joao@escola.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="admin-user-password">Senha Provisória</label>
                                    <input
                                        id="admin-user-password"
                                        name="admin-user-password"
                                        type="password"
                                        className="admin-input"
                                        required
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="admin-user-role">Nível de Acesso</label>
                                    <select
                                        id="admin-user-role"
                                        name="admin-user-role"
                                        className="admin-select"
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="professor">Professor</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="admin-user-escola">Instituição / Escola</label>
                                    <input
                                        id="admin-user-escola"
                                        name="admin-user-escola"
                                        type="text"
                                        className="admin-input"
                                        value={newUser.escola}
                                        onChange={e => setNewUser({ ...newUser, escola: e.target.value })}
                                        placeholder="Ex: Colégio Objetivo"
                                    />
                                </div>
                                <div className="form-group full-width">
                                    <label htmlFor="admin-user-disciplina">Disciplina Principal</label>
                                    <input
                                        id="admin-user-disciplina"
                                        name="admin-user-disciplina"
                                        type="text"
                                        className="admin-input"
                                        value={newUser.disciplina}
                                        onChange={e => setNewUser({ ...newUser, disciplina: e.target.value })}
                                        placeholder="Ex: Matemática, Física, Português..."
                                    />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-ghost" onClick={() => setShowAddModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-emerald" style={{ padding: '14px 32px' }}>
                                    Confirmar Cadastro
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
