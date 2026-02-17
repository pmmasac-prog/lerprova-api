import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, ArrowLeft, Shield, School, Search, RefreshCw } from 'lucide-react';
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
                    <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="admin-title">Painel de Administração</h1>
                        <p className="admin-subtitle">Gerenciamento global de usuários e professores</p>
                    </div>
                </div>
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    <UserPlus size={18} />
                    <span>Novo Professor</span>
                </button>
            </div>

            <div className="admin-stats-bar">
                <div className="admin-stat">
                    <div className="icon-bg icon-blue icon-bg-sm">
                        <Users size={18} />
                    </div>
                    <div className="stat-info">
                        <span className="label">Total Usuários</span>
                        <span className="value">{users.length}</span>
                    </div>
                </div>
                <div className="admin-stat">
                    <div className="icon-bg icon-purple icon-bg-sm">
                        <Shield size={18} />
                    </div>
                    <div className="stat-info">
                        <span className="label">Administradores</span>
                        <span className="value">{users.filter(u => u.role === 'admin').length}</span>
                    </div>
                </div>
                <div className="admin-stat">
                    <div className="icon-bg icon-green icon-bg-sm">
                        <School size={18} />
                    </div>
                    <div className="stat-info">
                        <span className="label">Escolas Ativas</span>
                        <span className="value">{new Set(users.map(u => u.escola)).size}</span>
                    </div>
                </div>
            </div>

            <div className="admin-content card">
                <div className="table-header">
                    <div className="search-box">
                        <Search size={18} />
                        <input
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
                                <th>Papel</th>
                                <th>Escola / Disciplina</th>
                                <th>Plano</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(u => (
                                    <tr key={u.id}>
                                        <td>
                                            <div className="user-info-cell">
                                                <div className="user-avatar">
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
                                                {u.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <p className="escola-text">{u.escola || 'Não informada'}</p>
                                            <p className="disciplina-text text-xs text-slate-400">{u.disciplina}</p>
                                        </td>
                                        <td>
                                            <span className={`plan-badge ${u.plan_type}`}>
                                                {u.plan_type.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-btns">
                                                <button className="icon-btn delete" onClick={() => handleDeleteUser(u.id)} disabled={u.id === currentUser.id}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="empty-row">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Cadastro */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>Cadastrar Novo Professor</h2>
                            <button onClick={() => setShowAddModal(false)}><ArrowLeft /></button>
                        </div>
                        <form onSubmit={handleCreateUser} className="admin-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Nome Completo</label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.nome}
                                        onChange={e => setNewUser({ ...newUser, nome: e.target.value })}
                                        placeholder="Ex: João Silva"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email de Acesso</label>
                                    <input
                                        type="email"
                                        required
                                        value={newUser.email}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        placeholder="joao@escola.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Senha Provisória</label>
                                    <input
                                        type="password"
                                        required
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nível de Acesso</label>
                                    <select
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="professor">Professor</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Instituição / Escola</label>
                                    <input
                                        type="text"
                                        value={newUser.escola}
                                        onChange={e => setNewUser({ ...newUser, escola: e.target.value })}
                                        placeholder="Ex: Colégio Objetivo"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Disciplina</label>
                                    <input
                                        type="text"
                                        value={newUser.disciplina}
                                        onChange={e => setNewUser({ ...newUser, disciplina: e.target.value })}
                                        placeholder="Ex: Matemática"
                                    />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary">Criar Conta</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
