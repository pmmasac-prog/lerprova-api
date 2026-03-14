import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart3, AlertTriangle, Users, Phone, ClipboardList,
    TrendingDown, Calendar, Filter, RefreshCw,
    CheckCircle, XCircle, Clock, AlertCircle, FileText, Search,
    ChevronDown, ChevronUp, Percent, Activity, MessageCircle,
    User, Edit3, Save, X
} from 'lucide-react';
import { api } from '../services/api';
import './RelatoriosAdmin.css';

// ==================== TYPES ====================
interface AlunoInfrequencia {
    aluno_id: number;
    aluno_nome: string;
    aluno_codigo: string;
    turma: string;
    turno: string;
    total_dias_letivos: number;
    dias_presentes: number;
    dias_ausentes: number;
    frequencia_percentual: number;
    faltas_justificadas: number;
    faltas_nao_justificadas: number;
    faltas_consecutivas: number;
    ultima_presenca: string | null;
    primeira_frequencia: string | null;
    status_risco: string;
    classificacao: string;
    situacao_matricula: string;
    responsavel: string | null;
    telefone: string | null;
}

interface AlunoFaltasConsecutivas {
    aluno_id: number;
    aluno_nome: string;
    aluno_codigo: string;
    turma: string;
    turno: string;
    faltas_consecutivas: number;
    ultima_presenca: string | null;
    dias_sem_entrada: number;
    responsavel: string | null;
    telefone: string | null;
    nivel: string;
    status_alerta: string;
    status_contato: string;
}

interface AlunoRisco {
    aluno_id: number;
    aluno_nome: string;
    aluno_codigo: string;
    turma: string;
    turno: string;
    score_risco: number;
    nivel_risco: string;
    motivo_principal: string;
    motivos: string[];
    acao_recomendada: string;
    frequencia_atual: number;
    frequencia_anterior: number | null;
    faltas_consecutivas: number;
    ultima_presenca: string | null;
    dias_sem_entrada: number;
    dias_aula: number;
    responsavel: string | null;
    telefone: string | null;
}

interface MenorComunicacao {
    aluno_id: number;
    aluno_nome: string;
    aluno_codigo: string;
    turma: string;
    idade: number | null;
    responsavel: string | null;
    contato: string | null;
    quantidade_faltas: number;
    faltas_nao_justificadas: number;
    faltas_consecutivas: number;
    ultima_entrada: string | null;
    frequencia_percentual: number;
    motivo_alerta: string;
    data_ultimo_aviso: string | null;
    situacao: string;
}

interface DashboardData {
    total_alunos: number;
    taxa_frequencia_mes: number;
    dias_letivos_mes: number;
    alertas: { abertos: number; criticos: number };
    situacao_alunos: {
        ativos: number;
        infrequentes: number;
        em_risco: number;
        abandono_presumido: number;
        evadidos: number;
    };
    pendencias_comunicacao: number;
    periodo: { inicio: string; fim: string };
}
interface TurmaGerencial {
    turma_id: number;
    turma_nome: string;
    turno: string;
    total_alunos: number;
    taxa_frequencia: number;
    alunos_risco: number;
    alunos_criticos: number;
}

// ==================== FUNÇÕES UTILITÁRIAS ====================

type TipoMensagem = 'infrequencia' | 'faltas_consecutivas' | 'risco_evasao' | 'menor_comunicacao';

interface DadosWhatsApp {
    aluno_nome: string;
    turma?: string;
    frequencia?: number;
    faltas_consecutivas?: number;
    dias_sem_entrada?: number;
    motivo?: string;
}

const formatarTelefone = (telefone: string | null | undefined): string | null => {
    if (!telefone) return null;
    // Remove tudo que não é número
    const numeros = telefone.replace(/\D/g, '');
    // Se não começar com 55 (Brasil), adiciona
    if (!numeros.startsWith('55') && numeros.length >= 10) {
        return '55' + numeros;
    }
    return numeros.length >= 12 ? numeros : null;
};

const gerarMensagemWhatsApp = (tipo: TipoMensagem, dados: DadosWhatsApp): string => {
    const saudacao = "Prezado(a) responsável,";
    const escola = "Secretaria Escolar";

    switch (tipo) {
        case 'infrequencia':
            return `${saudacao}

Informamos que o(a) aluno(a) *${dados.aluno_nome}*, da turma *${dados.turma}*, apresenta frequência de *${dados.frequencia?.toFixed(1)}%* no período atual.

A frequência mínima exigida é de 75%. Solicitamos comparecer à escola para tratarmos sobre a situação escolar do(a) estudante.

Atenciosamente,
${escola}`;

        case 'faltas_consecutivas':
            return `${saudacao}

Comunicamos que o(a) aluno(a) *${dados.aluno_nome}*, da turma *${dados.turma}*, está com *${dados.faltas_consecutivas} faltas consecutivas* (${dados.dias_sem_entrada} dias sem comparecer à escola).

Solicitamos entrar em contato com a escola urgentemente para justificar as ausências e evitar prejuízos pedagógicos.

Atenciosamente,
${escola}`;

        case 'risco_evasao':
            return `${saudacao}

O(A) aluno(a) *${dados.aluno_nome}*, da turma *${dados.turma}*, está em *RISCO DE EVASÃO ESCOLAR*.

Motivo principal: ${dados.motivo || 'Baixa frequência'}
Frequência atual: ${dados.frequencia?.toFixed(1)}%
${dados.faltas_consecutivas ? `Faltas consecutivas: ${dados.faltas_consecutivas}` : ''}

Solicitamos comparecer URGENTEMENTE à escola para tratarmos da situação e evitar o abandono escolar, o que pode ter consequências legais.

Atenciosamente,
${escola}`;

        case 'menor_comunicacao':
            return `${saudacao}

COMUNICAÇÃO OBRIGATÓRIA - Conselho Tutelar

O(A) aluno(a) *${dados.aluno_nome}*, da turma *${dados.turma}*, apresenta situação que requer comunicação ao Conselho Tutelar conforme legislação vigente.

Motivo: ${dados.motivo}
Frequência: ${dados.frequencia?.toFixed(1)}%

Solicitamos comparecer à escola com URGÊNCIA para regularizar a situação antes do encaminhamento oficial.

Atenciosamente,
${escola}`;

        default:
            return `${saudacao}

Solicitamos entrar em contato com a escola para tratar de assunto referente ao(à) aluno(a) *${dados.aluno_nome}*.

Atenciosamente,
${escola}`;
    }
};

const gerarLinkWhatsApp = (telefone: string | null | undefined, tipo: TipoMensagem, dados: DadosWhatsApp): string | null => {
    const telFormatado = formatarTelefone(telefone);
    if (!telFormatado) return null;

    const mensagem = encodeURIComponent(gerarMensagemWhatsApp(tipo, dados));
    return `https://wa.me/${telFormatado}?text=${mensagem}`;
};

// ==================== COMPONENTES AUXILIARES ====================

const WhatsAppButton: React.FC<{ telefone: string | null | undefined; tipo: TipoMensagem; dados: DadosWhatsApp }> =
    ({ telefone, tipo, dados }) => {
        const link = gerarLinkWhatsApp(telefone, tipo, dados);

        if (!link) {
            return (
                <span className="whatsapp-btn disabled" title="Telefone não cadastrado">
                    <MessageCircle size={16} />
                </span>
            );
        }

        return (
            <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="whatsapp-btn"
                title="Enviar mensagem WhatsApp"
                onClick={(e) => e.stopPropagation()}
            >
                <MessageCircle size={16} />
            </a>
        );
    };

const StatusBadge: React.FC<{ status: string; tipo?: 'risco' | 'contato' | 'classificacao' }> = ({ status, tipo = 'risco' }) => {
    const configs: Record<string, Record<string, { bg: string; text: string; label: string }>> = {
        risco: {
            critico: { bg: '#7f1d1d', text: '#fca5a5', label: 'Crítico' },
            alto: { bg: '#9a3412', text: '#fdba74', label: 'Alto' },
            medio: { bg: '#854d0e', text: '#fde047', label: 'Médio' },
            baixo: { bg: '#166534', text: '#86efac', label: 'Baixo' },
            atencao: { bg: '#854d0e', text: '#fde047', label: 'Atenção' },
            alerta: { bg: '#9a3412', text: '#fdba74', label: 'Alerta' },
            abandono: { bg: '#581c87', text: '#e9d5ff', label: 'Abandono' },
        },
        contato: {
            pendente: { bg: '#7f1d1d', text: '#fca5a5', label: 'Pendente' },
            avisado: { bg: '#1e40af', text: '#93c5fd', label: 'Avisado' },
            sem_retorno: { bg: '#9a3412', text: '#fdba74', label: 'Sem Retorno' },
            resolvido: { bg: '#166534', text: '#86efac', label: 'Resolvido' },
        },
        classificacao: {
            regular: { bg: '#166534', text: '#86efac', label: 'Regular' },
            atencao: { bg: '#854d0e', text: '#fde047', label: 'Atenção' },
            risco: { bg: '#9a3412', text: '#fdba74', label: 'Risco' },
            critico: { bg: '#7f1d1d', text: '#fca5a5', label: 'Crítico' },
        }
    };

    const config = configs[tipo]?.[status] || { bg: '#374151', text: '#9ca3af', label: status };

    return (
        <span style={{
            background: config.bg,
            color: config.text,
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
        }}>
            {config.label}
        </span>
    );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string; subtext?: string }> =
    ({ label, value, icon, color, subtext }) => (
        <div className="stat-card" style={{ borderColor: color }}>
            <div className="stat-icon" style={{ color }}>{icon}</div>
            <div className="stat-content">
                <span className="stat-value">{value}</span>
                <span className="stat-label">{label}</span>
                {subtext && <span className="stat-subtext">{subtext}</span>}
            </div>
        </div>
    );

const ProgressBar: React.FC<{ value: number; max?: number; color?: string }> = ({ value, max = 100, color }) => {
    const pct = Math.min((value / max) * 100, 100);
    const barColor = color || (pct >= 90 ? '#22c55e' : pct >= 85 ? '#eab308' : pct >= 75 ? '#f97316' : '#ef4444');

    return (
        <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
            <span className="progress-bar-text">{value.toFixed(1)}%</span>
        </div>
    );
};

// ==================== COMPONENTE PRINCIPAL ====================

export const RelatoriosAdmin: React.FC = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    // Data states
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [infrequencia, setInfrequencia] = useState<{ alunos: AlunoInfrequencia[]; resumo: any } | null>(null);
    const [faltasConsecutivas, setFaltasConsecutivas] = useState<AlunoFaltasConsecutivas[]>([]);
    const [alunosRisco, setAlunosRisco] = useState<AlunoRisco[]>([]);
    const [menoresComunicacao, setMenoresComunicacao] = useState<MenorComunicacao[]>([]);
    const [turmasGerencial, setTurmasGerencial] = useState<TurmaGerencial[]>([]);

    // Filters
    const [periodo, setPeriodo] = useState({
        inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        fim: new Date().toISOString().split('T')[0]
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterNivel, setFilterNivel] = useState<string>('');

    // Expanded sections
    const [expandedAluno, setExpandedAluno] = useState<number | null>(null);

    // Modal de detalhes do aluno
    const [selectedAlunoModal, setSelectedAlunoModal] = useState<{ id: number; nome: string; codigo: string; turma: string } | null>(null);
    const [alunoDetalhes, setAlunoDetalhes] = useState<any>(null);
    const [historicoFrequencia, setHistoricoFrequencia] = useState<any>(null);
    const [editandoAluno, setEditandoAluno] = useState(false);
    const [editAlunoData, setEditAlunoData] = useState({ nome_responsavel: '', telefone_responsavel: '', email_responsavel: '' });
    const [loadingModal, setLoadingModal] = useState(false);

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }, []);

    const tabs = [
        { id: 'dashboard', label: 'Painel', icon: BarChart3 },
        { id: 'infrequencia', label: 'Infrequência', icon: Calendar },
        { id: 'consecutivas', label: 'Faltas Consecutivas', icon: AlertTriangle },
        { id: 'risco', label: 'Risco de Evasão', icon: TrendingDown },
        { id: 'menores', label: 'Menores', icon: Phone },
        { id: 'gerencial', label: 'Gerencial', icon: ClipboardList },
    ];

    // ==================== DATA LOADING ====================

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.request('/admin/reports/dashboard');
            setDashboard(data);
        } catch (err) {
            console.error('Erro ao carregar dashboard:', err);
            showToast('Erro ao carregar painel');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const loadInfrequencia = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.request('/admin/reports/infrequencia', {
                method: 'POST',
                body: JSON.stringify({ data_inicio: periodo.inicio, data_fim: periodo.fim })
            });
            setInfrequencia(data);
        } catch (err) {
            console.error('Erro ao carregar infrequência:', err);
            showToast('Erro ao carregar relatório');
        } finally {
            setLoading(false);
        }
    }, [periodo, showToast]);

    const loadFaltasConsecutivas = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.request('/admin/reports/faltas-consecutivas?minimo=2');
            setFaltasConsecutivas(data.alunos || []);
        } catch (err) {
            console.error('Erro ao carregar faltas consecutivas:', err);
            showToast('Erro ao carregar relatório');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const loadRiscoEvasao = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.request('/admin/reports/risco-evasao', {
                method: 'POST',
                body: JSON.stringify({ data_inicio: periodo.inicio, data_fim: periodo.fim })
            });
            setAlunosRisco(data.alunos_em_risco || []);
        } catch (err) {
            console.error('Erro ao carregar risco de evasão:', err);
            showToast('Erro ao carregar relatório');
        } finally {
            setLoading(false);
        }
    }, [periodo, showToast]);

    const loadMenoresComunicacao = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.request('/admin/reports/menores-comunicacao?minimo_faltas=3');
            setMenoresComunicacao(data.alunos || []);
        } catch (err) {
            console.error('Erro ao carregar menores:', err);
            showToast('Erro ao carregar relatório');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const loadGerencial = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.request('/admin/reports/gerencial', {
                method: 'POST',
                body: JSON.stringify({ data_inicio: periodo.inicio, data_fim: periodo.fim })
            });
            setTurmasGerencial(data.turmas_por_frequencia || []);
        } catch (err) {
            console.error('Erro ao carregar gerencial:', err);
            showToast('Erro ao carregar relatório');
        } finally {
            setLoading(false);
        }
    }, [periodo, showToast]);

    // ==================== MODAL DE DETALHES DO ALUNO ====================

    const abrirModalAluno = async (aluno: { id: number; nome: string; codigo: string; turma: string }) => {
        setSelectedAlunoModal(aluno);
        setEditandoAluno(false);
        setLoadingModal(true);

        try {
            // Carregar dados do aluno
            const dadosAluno = await api.request(`/alunos/${aluno.id}`);
            setAlunoDetalhes(dadosAluno);
            setEditAlunoData({
                nome_responsavel: dadosAluno.nome_responsavel || '',
                telefone_responsavel: dadosAluno.telefone_responsavel || '',
                email_responsavel: dadosAluno.email_responsavel || ''
            });

            // Carregar histórico de frequência
            const historico = await api.request(`/admin/reports/aluno/${aluno.id}/historico-frequencia`);
            setHistoricoFrequencia(historico);
        } catch (err) {
            console.error('Erro ao carregar detalhes:', err);
            showToast('Erro ao carregar detalhes do aluno');
        } finally {
            setLoadingModal(false);
        }
    };

    const fecharModalAluno = () => {
        setSelectedAlunoModal(null);
        setAlunoDetalhes(null);
        setHistoricoFrequencia(null);
        setEditandoAluno(false);
    };

    const salvarEdicaoAluno = async () => {
        if (!selectedAlunoModal) return;

        try {
            setLoadingModal(true);
            await api.request(`/alunos/${selectedAlunoModal.id}`, {
                method: 'PUT',
                body: JSON.stringify(editAlunoData)
            });
            showToast('Dados do aluno atualizados!');
            setEditandoAluno(false);

            // Recarregar dados
            const dadosAluno = await api.request(`/alunos/${selectedAlunoModal.id}`);
            setAlunoDetalhes(dadosAluno);
        } catch (err) {
            console.error('Erro ao salvar:', err);
            showToast('Erro ao salvar alterações');
        } finally {
            setLoadingModal(false);
        }
    };

    const gerarAlertas = async () => {
        try {
            setLoading(true);
            const data = await api.request('/admin/reports/gerar-alertas', { method: 'POST' });
            showToast(`${data.total_alertas} alertas gerados`);
            loadDashboard();
        } catch (err) {
            console.error('Erro ao gerar alertas:', err);
            showToast('Erro ao gerar alertas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'dashboard') loadDashboard();
        else if (activeTab === 'infrequencia') loadInfrequencia();
        else if (activeTab === 'consecutivas') loadFaltasConsecutivas();
        else if (activeTab === 'risco') loadRiscoEvasao();
        else if (activeTab === 'menores') loadMenoresComunicacao();
        else if (activeTab === 'gerencial') loadGerencial();
    }, [activeTab, loadDashboard, loadInfrequencia, loadFaltasConsecutivas, loadRiscoEvasao, loadMenoresComunicacao, loadGerencial]);

    // ==================== RENDER FUNCTIONS ====================

    const renderDashboard = () => {
        if (!dashboard) return <div className="loading-state">Carregando...</div>;

        return (
            <div className="dashboard-grid">
                {/* Stats Row */}
                <div className="stats-row">
                    <StatCard
                        label="Total de Alunos"
                        value={dashboard.total_alunos}
                        icon={<Users size={24} />}
                        color="#3b82f6"
                    />
                    <StatCard
                        label="Frequência do Mês"
                        value={`${dashboard.taxa_frequencia_mes}%`}
                        icon={<Percent size={24} />}
                        color={dashboard.taxa_frequencia_mes >= 85 ? '#22c55e' : '#f97316'}
                        subtext={`${dashboard.dias_letivos_mes} dias letivos`}
                    />
                    <StatCard
                        label="Alertas Abertos"
                        value={dashboard.alertas.abertos}
                        icon={<AlertTriangle size={24} />}
                        color="#f97316"
                        subtext={`${dashboard.alertas.criticos} críticos`}
                    />
                    <StatCard
                        label="Pendências"
                        value={dashboard.pendencias_comunicacao}
                        icon={<Phone size={24} />}
                        color="#ef4444"
                        subtext="comunicação obrigatória"
                    />
                </div>

                {/* Situação dos Alunos */}
                <div className="dashboard-card">
                    <h3><Activity size={18} /> Situação dos Alunos</h3>
                    <div className="situation-grid">
                        <div className="situation-item">
                            <span className="situation-value" style={{ color: '#22c55e' }}>
                                {dashboard.situacao_alunos.ativos}
                            </span>
                            <span className="situation-label">Ativos</span>
                        </div>
                        <div className="situation-item">
                            <span className="situation-value" style={{ color: '#eab308' }}>
                                {dashboard.situacao_alunos.infrequentes}
                            </span>
                            <span className="situation-label">Infrequentes</span>
                        </div>
                        <div className="situation-item">
                            <span className="situation-value" style={{ color: '#f97316' }}>
                                {dashboard.situacao_alunos.em_risco}
                            </span>
                            <span className="situation-label">Em Risco</span>
                        </div>
                        <div className="situation-item">
                            <span className="situation-value" style={{ color: '#ef4444' }}>
                                {dashboard.situacao_alunos.abandono_presumido}
                            </span>
                            <span className="situation-label">Abandono Presumido</span>
                        </div>
                        <div className="situation-item">
                            <span className="situation-value" style={{ color: '#9333ea' }}>
                                {dashboard.situacao_alunos.evadidos}
                            </span>
                            <span className="situation-label">Evadidos</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="dashboard-actions">
                    <button className="btn-primary" onClick={gerarAlertas} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Gerar Alertas Automáticos
                    </button>
                </div>
            </div>
        );
    };

    const renderInfrequencia = () => {
        const filteredAlunos = (infrequencia?.alunos || [])
            .filter(a => !searchTerm || a.aluno_nome.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(a => !filterNivel || a.classificacao === filterNivel);

        return (
            <div className="report-section">
                {/* Resumo */}
                {infrequencia?.resumo && (
                    <div className="stats-row mini">
                        <StatCard label="Regulares" value={infrequencia.resumo.regulares} icon={<CheckCircle size={18} />} color="#22c55e" />
                        <StatCard label="Atenção" value={infrequencia.resumo.atencao} icon={<AlertCircle size={18} />} color="#eab308" />
                        <StatCard label="Risco" value={infrequencia.resumo.risco} icon={<AlertTriangle size={18} />} color="#f97316" />
                        <StatCard label="Críticos" value={infrequencia.resumo.criticos} icon={<XCircle size={18} />} color="#ef4444" />
                    </div>
                )}

                {/* Filters */}
                <div className="filters-bar">
                    <div className="filter-group">
                        <label>Período:</label>
                        <input
                            type="date"
                            value={periodo.inicio}
                            onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
                        />
                        <span>até</span>
                        <input
                            type="date"
                            value={periodo.fim}
                            onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))}
                        />
                        <button onClick={loadInfrequencia} className="btn-filter">
                            <Filter size={14} /> Filtrar
                        </button>
                    </div>
                    <div className="filter-group">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Buscar aluno..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <select value={filterNivel} onChange={e => setFilterNivel(e.target.value)}>
                            <option value="">Todas classificações</option>
                            <option value="regular">Regular</option>
                            <option value="atencao">Atenção</option>
                            <option value="risco">Risco</option>
                            <option value="critico">Crítico</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="report-table-container">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Aluno</th>
                                <th>Turma</th>
                                <th>Turno</th>
                                <th>Frequência</th>
                                <th>Presentes</th>
                                <th>Ausentes</th>
                                <th>Justificadas</th>
                                <th>Consecutivas</th>
                                <th>Última Presença</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAlunos.map(aluno => (
                                <tr key={aluno.aluno_id} className={`row-${aluno.classificacao}`}>
                                    <td>
                                        <div className="aluno-cell"
                                            onClick={() => abrirModalAluno({
                                                id: aluno.aluno_id,
                                                nome: aluno.aluno_nome,
                                                codigo: aluno.aluno_codigo,
                                                turma: aluno.turma
                                            })}
                                            style={{ cursor: 'pointer' }}
                                            title="Clique para ver detalhes e editar contato"
                                        >
                                            <span className="aluno-nome" style={{ color: 'var(--admin-emerald)' }}>{aluno.aluno_nome}</span>
                                            <span className="aluno-codigo">{aluno.aluno_codigo}</span>
                                        </div>
                                    </td>
                                    <td>{aluno.turma}</td>
                                    <td>{aluno.turno}</td>
                                    <td><ProgressBar value={aluno.frequencia_percentual} /></td>
                                    <td className="num">{aluno.dias_presentes}/{aluno.total_dias_letivos}</td>
                                    <td className="num">{aluno.dias_ausentes}</td>
                                    <td className="num">{aluno.faltas_justificadas}</td>
                                    <td className="num">
                                        {aluno.faltas_consecutivas > 0 && (
                                            <span className={`consecutive-badge ${aluno.faltas_consecutivas >= 5 ? 'critical' : aluno.faltas_consecutivas >= 3 ? 'warning' : ''}`}>
                                                {aluno.faltas_consecutivas}
                                            </span>
                                        )}
                                    </td>
                                    <td>{aluno.ultima_presenca || '-'}</td>
                                    <td><StatusBadge status={aluno.classificacao} tipo="classificacao" /></td>
                                    <td>
                                        <WhatsAppButton
                                            telefone={aluno.telefone}
                                            tipo="infrequencia"
                                            dados={{
                                                aluno_nome: aluno.aluno_nome,
                                                turma: aluno.turma,
                                                frequencia: aluno.frequencia_percentual
                                            }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredAlunos.length === 0 && (
                        <div className="empty-state">Nenhum aluno encontrado</div>
                    )}
                </div>
            </div>
        );
    };

    const renderFaltasConsecutivas = () => {
        const filtered = faltasConsecutivas
            .filter(a => !searchTerm || a.aluno_nome.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(a => !filterNivel || a.nivel === filterNivel);

        return (
            <div className="report-section">
                {/* Filters */}
                <div className="filters-bar">
                    <div className="filter-group">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Buscar aluno..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <select value={filterNivel} onChange={e => setFilterNivel(e.target.value)}>
                            <option value="">Todos os níveis</option>
                            <option value="atencao">Atenção (2+ faltas)</option>
                            <option value="alerta">Alerta (3+ faltas)</option>
                            <option value="critico">Crítico (5+ faltas)</option>
                            <option value="abandono">Abandono (7+ faltas)</option>
                        </select>
                    </div>
                    <button onClick={loadFaltasConsecutivas} className="btn-filter">
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>

                {/* Cards */}
                <div className="consecutive-cards">
                    {filtered.map(aluno => (
                        <div key={aluno.aluno_id} className={`consecutive-card nivel-${aluno.nivel}`}>
                            <div className="card-header">
                                <div className="aluno-info"
                                    onClick={() => abrirModalAluno({
                                        id: aluno.aluno_id,
                                        nome: aluno.aluno_nome,
                                        codigo: aluno.aluno_codigo,
                                        turma: aluno.turma
                                    })}
                                    style={{ cursor: 'pointer' }}
                                    title="Clique para ver detalhes e editar contato"
                                >
                                    <h4 style={{ color: 'var(--admin-emerald)' }}>{aluno.aluno_nome}</h4>
                                    <span className="turma">{aluno.turma}</span>
                                </div>
                                <div className="faltas-badge">
                                    <span className="faltas-num">{aluno.faltas_consecutivas}</span>
                                    <span className="faltas-label">faltas</span>
                                </div>
                            </div>
                            <div className="card-body">
                                <div className="info-row">
                                    <Clock size={14} />
                                    <span>Última presença: {aluno.ultima_presenca || 'Sem registro'}</span>
                                </div>
                                <div className="info-row">
                                    <Calendar size={14} />
                                    <span>{aluno.dias_sem_entrada} dias sem entrada</span>
                                </div>
                                {aluno.responsavel && (
                                    <div className="info-row">
                                        <Users size={14} />
                                        <span>{aluno.responsavel}</span>
                                    </div>
                                )}
                                {aluno.telefone && (
                                    <div className="info-row">
                                        <Phone size={14} />
                                        <span>{aluno.telefone}</span>
                                    </div>
                                )}
                            </div>
                            <div className="card-footer">
                                <StatusBadge status={aluno.nivel} tipo="risco" />
                                <StatusBadge status={aluno.status_contato.toLowerCase().replace(' ', '_')} tipo="contato" />
                                <WhatsAppButton
                                    telefone={aluno.telefone}
                                    tipo="faltas_consecutivas"
                                    dados={{
                                        aluno_nome: aluno.aluno_nome,
                                        turma: aluno.turma,
                                        faltas_consecutivas: aluno.faltas_consecutivas,
                                        dias_sem_entrada: aluno.dias_sem_entrada
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                {filtered.length === 0 && (
                    <div className="empty-state">
                        <AlertTriangle size={48} />
                        <p>Nenhum aluno com faltas consecutivas no momento</p>
                    </div>
                )}
            </div>
        );
    };

    const renderRiscoEvasao = () => {
        const filtered = alunosRisco
            .filter(a => !searchTerm || a.aluno_nome.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(a => !filterNivel || a.nivel_risco === filterNivel);

        return (
            <div className="report-section">
                {/* Filters */}
                <div className="filters-bar">
                    <div className="filter-group">
                        <label>Período:</label>
                        <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} />
                        <span>até</span>
                        <input type="date" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} />
                        <button onClick={loadRiscoEvasao} className="btn-filter"><Filter size={14} /> Filtrar</button>
                    </div>
                    <div className="filter-group">
                        <Search size={16} />
                        <input type="text" placeholder="Buscar aluno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="filter-group">
                        <select value={filterNivel} onChange={e => setFilterNivel(e.target.value)}>
                            <option value="">Todos os níveis</option>
                            <option value="medio">Médio</option>
                            <option value="alto">Alto</option>
                            <option value="critico">Crítico</option>
                        </select>
                    </div>
                </div>

                {/* Alunos em Risco */}
                <div className="risk-list">
                    {filtered.map(aluno => (
                        <div key={aluno.aluno_id} className={`risk-card nivel-${aluno.nivel_risco}`}>
                            <div
                                className="risk-header"
                                onClick={() => setExpandedAluno(expandedAluno === aluno.aluno_id ? null : aluno.aluno_id)}
                            >
                                <div className="risk-main">
                                    <div className="score-circle" style={{
                                        background: aluno.score_risco >= 60 ? '#ef4444' : aluno.score_risco >= 40 ? '#f97316' : '#eab308'
                                    }}>
                                        {aluno.score_risco}
                                    </div>
                                    <div className="aluno-info">
                                        <h4>{aluno.aluno_nome}</h4>
                                        <span>{aluno.turma} · {aluno.turno}</span>
                                    </div>
                                </div>
                                <div className="risk-summary">
                                    <StatusBadge status={aluno.nivel_risco} tipo="risco" />
                                    <span className="motivo">{aluno.motivo_principal}</span>
                                    {expandedAluno === aluno.aluno_id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </div>

                            {expandedAluno === aluno.aluno_id && (
                                <div className="risk-details">
                                    <div className="details-grid">
                                        <div className="detail-item">
                                            <label>Frequência Atual</label>
                                            <ProgressBar value={aluno.frequencia_atual} />
                                        </div>
                                        {aluno.frequencia_anterior && (
                                            <div className="detail-item">
                                                <label>Frequência Anterior</label>
                                                <span>{aluno.frequencia_anterior.toFixed(1)}%</span>
                                            </div>
                                        )}
                                        <div className="detail-item">
                                            <label>Faltas Consecutivas</label>
                                            <span className="highlight">{aluno.faltas_consecutivas}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Dias sem Entrada</label>
                                            <span>{aluno.dias_sem_entrada}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Última Presença</label>
                                            <span>{aluno.ultima_presenca || 'Sem registro'}</span>
                                        </div>
                                    </div>

                                    <div className="motivos-list">
                                        <label>Motivos do Alerta:</label>
                                        <ul>
                                            {aluno.motivos.map((m, i) => <li key={i}>{m}</li>)}
                                        </ul>
                                    </div>

                                    <div className="acao-recomendada">
                                        <AlertTriangle size={16} />
                                        <span>{aluno.acao_recomendada}</span>
                                    </div>

                                    {(aluno.responsavel || aluno.telefone) && (
                                        <div className="contato-info">
                                            {aluno.responsavel && <span><Users size={14} /> {aluno.responsavel}</span>}
                                            {aluno.telefone && <span><Phone size={14} /> {aluno.telefone}</span>}
                                            <WhatsAppButton
                                                telefone={aluno.telefone}
                                                tipo="risco_evasao"
                                                dados={{
                                                    aluno_nome: aluno.aluno_nome,
                                                    turma: aluno.turma,
                                                    frequencia: aluno.frequencia_atual,
                                                    faltas_consecutivas: aluno.faltas_consecutivas,
                                                    motivo: aluno.motivo_principal
                                                }}
                                            />
                                            <button
                                                onClick={() => abrirModalAluno({
                                                    id: aluno.aluno_id,
                                                    nome: aluno.aluno_nome,
                                                    codigo: aluno.aluno_codigo,
                                                    turma: aluno.turma
                                                })}
                                                className="btn-ver-detalhes"
                                                style={{
                                                    background: 'var(--admin-emerald)', border: 'none', color: '#fff',
                                                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                                    fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                <User size={14} /> Ver Histórico
                                            </button>
                                        </div>
                                    )}
                                    {!aluno.responsavel && !aluno.telefone && (
                                        <div className="contato-info sem-contato">
                                            <span className="empty">Contato do responsável não cadastrado</span>
                                            <button
                                                onClick={() => abrirModalAluno({
                                                    id: aluno.aluno_id,
                                                    nome: aluno.aluno_nome,
                                                    codigo: aluno.aluno_codigo,
                                                    turma: aluno.turma
                                                })}
                                                style={{
                                                    background: 'var(--admin-emerald)', border: 'none', color: '#fff',
                                                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                                    fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                <Edit3 size={14} /> Cadastrar Contato
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {filtered.length === 0 && (
                    <div className="empty-state success">
                        <CheckCircle size={48} />
                        <p>Nenhum aluno em risco de evasão no momento</p>
                    </div>
                )}
            </div>
        );
    };

    const renderMenoresComunicacao = () => {
        const filtered = menoresComunicacao
            .filter(a => !searchTerm || a.aluno_nome.toLowerCase().includes(searchTerm.toLowerCase()));

        return (
            <div className="report-section">
                {/* Filters */}
                <div className="filters-bar">
                    <div className="filter-group">
                        <Search size={16} />
                        <input type="text" placeholder="Buscar aluno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={loadMenoresComunicacao} className="btn-filter">
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>

                {/* Table */}
                <div className="report-table-container">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Aluno</th>
                                <th>Idade</th>
                                <th>Turma</th>
                                <th>Responsável</th>
                                <th>Contato</th>
                                <th>Faltas</th>
                                <th>Frequência</th>
                                <th>Motivo</th>
                                <th>Último Aviso</th>
                                <th>Situação</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(aluno => (
                                <tr key={aluno.aluno_id}>
                                    <td>
                                        <div className="aluno-cell"
                                            onClick={() => abrirModalAluno({
                                                id: aluno.aluno_id,
                                                nome: aluno.aluno_nome,
                                                codigo: aluno.aluno_codigo,
                                                turma: aluno.turma
                                            })}
                                            style={{ cursor: 'pointer' }}
                                            title="Clique para ver detalhes e editar contato"
                                        >
                                            <span className="aluno-nome" style={{ color: 'var(--admin-emerald)' }}>{aluno.aluno_nome}</span>
                                            <span className="aluno-codigo">{aluno.aluno_codigo}</span>
                                        </div>
                                    </td>
                                    <td>{aluno.idade || '-'}</td>
                                    <td>{aluno.turma}</td>
                                    <td>{aluno.responsavel || <span className="empty">Não informado</span>}</td>
                                    <td>{aluno.contato || <span className="empty">Não informado</span>}</td>
                                    <td className="num">
                                        <span className="faltas-total">{aluno.quantidade_faltas}</span>
                                        {aluno.faltas_nao_justificadas > 0 && (
                                            <span className="faltas-nj">({aluno.faltas_nao_justificadas} NJ)</span>
                                        )}
                                    </td>
                                    <td><ProgressBar value={aluno.frequencia_percentual} /></td>
                                    <td className="motivo">{aluno.motivo_alerta}</td>
                                    <td>{aluno.data_ultimo_aviso || '-'}</td>
                                    <td><StatusBadge status={aluno.situacao} tipo="contato" /></td>
                                    <td>
                                        <WhatsAppButton
                                            telefone={aluno.contato}
                                            tipo="menor_comunicacao"
                                            dados={{
                                                aluno_nome: aluno.aluno_nome,
                                                turma: aluno.turma,
                                                frequencia: aluno.frequencia_percentual,
                                                motivo: aluno.motivo_alerta
                                            }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="empty-state success">
                            <CheckCircle size={48} />
                            <p>Nenhum menor com pendência de comunicação</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderGerencial = () => {
        return (
            <div className="report-section">
                {/* Filters */}
                <div className="filters-bar">
                    <div className="filter-group">
                        <label>Período:</label>
                        <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} />
                        <span>até</span>
                        <input type="date" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} />
                        <button onClick={loadGerencial} className="btn-filter"><Filter size={14} /> Filtrar</button>
                    </div>
                </div>

                {/* Turmas por Frequência */}
                <div className="gerencial-section">
                    <h3><BarChart3 size={18} /> Turmas por Taxa de Frequência</h3>
                    <div className="turmas-ranking">
                        {turmasGerencial.map((turma, index) => (
                            <div key={turma.turma_id} className={`turma-row ${turma.taxa_frequencia < 85 ? 'warning' : ''}`}>
                                <span className="rank">{index + 1}</span>
                                <div className="turma-info">
                                    <span className="turma-nome">{turma.turma_nome}</span>
                                    <span className="turma-meta">{turma.total_alunos} alunos · {turma.turno}</span>
                                </div>
                                <div className="turma-stats">
                                    <ProgressBar value={turma.taxa_frequencia} />
                                    {turma.alunos_risco > 0 && (
                                        <span className="alunos-risco">
                                            <AlertTriangle size={12} /> {turma.alunos_risco + turma.alunos_criticos} em risco
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // ==================== MAIN RENDER ====================

    return (
        <div className="admin-container relatorios-admin">
            {/* Toast */}
            {toast && (
                <div className="toast">
                    <CheckCircle size={16} />
                    {toast}
                </div>
            )}

            {/* Header */}
            <header className="admin-header">
                <div>
                    <h1 className="admin-title">
                        <FileText size={26} color="var(--admin-gold)" />
                        Relatórios Avançados de Frequência
                    </h1>
                    <p className="admin-subtitle">
                        Monitoramento de infrequência, risco de evasão e acompanhamento
                    </p>
                </div>
            </header>

            {/* Tabs */}
            <nav className="report-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setFilterNivel(''); }}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* Content */}
            <main className="report-content">
                {loading && <div className="loading-overlay"><RefreshCw size={32} className="spinning" /></div>}

                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'infrequencia' && renderInfrequencia()}
                {activeTab === 'consecutivas' && renderFaltasConsecutivas()}
                {activeTab === 'risco' && renderRiscoEvasao()}
                {activeTab === 'menores' && renderMenoresComunicacao()}
                {activeTab === 'gerencial' && renderGerencial()}
            </main>

            {/* Modal de Detalhes do Aluno */}
            {selectedAlunoModal && (
                <div className="modal-overlay" onClick={fecharModalAluno} style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center',
                    alignItems: 'center', zIndex: 1000
                }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                        background: 'var(--admin-card)', borderRadius: '16px', width: '90%',
                        maxWidth: '700px', maxHeight: '85vh', overflow: 'auto',
                        border: '1px solid var(--admin-border)'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '20px', borderBottom: '1px solid var(--admin-border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: 'var(--admin-emerald)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', color: '#fff'
                                }}>
                                    <User size={24} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '18px', color: '#f1f5f9' }}>{selectedAlunoModal.nome}</h2>
                                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                                        {selectedAlunoModal.codigo} · {selectedAlunoModal.turma}
                                    </span>
                                </div>
                            </div>
                            <button onClick={fecharModalAluno} style={{
                                background: 'none', border: 'none', color: '#94a3b8',
                                cursor: 'pointer', padding: '8px'
                            }}>
                                <X size={24} />
                            </button>
                        </div>

                        {loadingModal ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <RefreshCw size={32} className="spinning" color="var(--admin-emerald)" />
                                <p style={{ color: '#94a3b8', marginTop: '10px' }}>Carregando...</p>
                            </div>
                        ) : (
                            <div style={{ padding: '20px' }}>
                                {/* Contato do Responsável */}
                                <div style={{
                                    background: 'var(--admin-bg)', padding: '16px', borderRadius: '12px',
                                    marginBottom: '20px', border: '1px solid var(--admin-border)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3 style={{ margin: 0, fontSize: '14px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Phone size={16} /> Contato do Responsável
                                        </h3>
                                        {!editandoAluno ? (
                                            <button onClick={() => setEditandoAluno(true)} style={{
                                                background: 'var(--admin-emerald)', border: 'none', color: '#fff',
                                                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px'
                                            }}>
                                                <Edit3 size={14} /> Editar
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => setEditandoAluno(false)} style={{
                                                    background: 'var(--admin-border)', border: 'none', color: '#94a3b8',
                                                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px'
                                                }}>
                                                    Cancelar
                                                </button>
                                                <button onClick={salvarEdicaoAluno} style={{
                                                    background: '#10b981', border: 'none', color: '#fff',
                                                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px'
                                                }}>
                                                    <Save size={14} /> Salvar
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {!editandoAluno ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Nome</label>
                                                <span style={{ fontSize: '14px', color: '#f1f5f9' }}>
                                                    {alunoDetalhes?.nome_responsavel || <em style={{ color: '#64748b' }}>Não informado</em>}
                                                </span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Telefone</label>
                                                <span style={{ fontSize: '14px', color: '#f1f5f9' }}>
                                                    {alunoDetalhes?.telefone_responsavel ? (
                                                        <a href={`https://wa.me/55${alunoDetalhes.telefone_responsavel.replace(/\D/g, '')}`}
                                                            target="_blank" rel="noopener noreferrer"
                                                            style={{ color: '#10b981', textDecoration: 'none' }}>
                                                            {alunoDetalhes.telefone_responsavel}
                                                        </a>
                                                    ) : <em style={{ color: '#64748b' }}>Não informado</em>}
                                                </span>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>E-mail</label>
                                                <span style={{ fontSize: '14px', color: '#f1f5f9' }}>
                                                    {alunoDetalhes?.email_responsavel || <em style={{ color: '#64748b' }}>Não informado</em>}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Nome do Responsável</label>
                                                <input
                                                    type="text"
                                                    value={editAlunoData.nome_responsavel}
                                                    onChange={e => setEditAlunoData(d => ({ ...d, nome_responsavel: e.target.value }))}
                                                    placeholder="Nome do responsável"
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                                                        border: '1px solid var(--admin-border)', background: 'var(--admin-card)',
                                                        color: '#f1f5f9', fontSize: '13px'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Telefone (WhatsApp)</label>
                                                <input
                                                    type="tel"
                                                    value={editAlunoData.telefone_responsavel}
                                                    onChange={e => setEditAlunoData(d => ({ ...d, telefone_responsavel: e.target.value }))}
                                                    placeholder="11999998888"
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                                                        border: '1px solid var(--admin-border)', background: 'var(--admin-card)',
                                                        color: '#f1f5f9', fontSize: '13px'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>E-mail</label>
                                                <input
                                                    type="email"
                                                    value={editAlunoData.email_responsavel}
                                                    onChange={e => setEditAlunoData(d => ({ ...d, email_responsavel: e.target.value }))}
                                                    placeholder="email@exemplo.com"
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                                                        border: '1px solid var(--admin-border)', background: 'var(--admin-card)',
                                                        color: '#f1f5f9', fontSize: '13px'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Histórico de Frequência */}
                                {historicoFrequencia && (
                                    <div style={{
                                        background: 'var(--admin-bg)', padding: '16px', borderRadius: '12px',
                                        border: '1px solid var(--admin-border)'
                                    }}>
                                        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar size={16} /> Histórico de Frequência
                                        </h3>

                                        {/* Estatísticas */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                                            <div style={{ background: 'var(--admin-card)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                                                    {historicoFrequencia.estatisticas?.frequencia_percentual || 0}%
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Frequência</div>
                                            </div>
                                            <div style={{ background: 'var(--admin-card)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                                                    {historicoFrequencia.estatisticas?.presencas || 0}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Presenças</div>
                                            </div>
                                            <div style={{ background: 'var(--admin-card)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                                                    {historicoFrequencia.estatisticas?.ausencias || 0}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Faltas</div>
                                            </div>
                                            <div style={{ background: 'var(--admin-card)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                                                    {historicoFrequencia.estatisticas?.justificadas || 0}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Justificadas</div>
                                            </div>
                                        </div>

                                        {/* Datas de Presença */}
                                        {historicoFrequencia.datas_presente?.length > 0 && (
                                            <div style={{ marginBottom: '16px' }}>
                                                <h4 style={{ fontSize: '12px', color: '#22c55e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <CheckCircle size={14} /> Presenças ({historicoFrequencia.datas_presente.length})
                                                </h4>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {historicoFrequencia.datas_presente.slice(0, 20).map((p: any, i: number) => (
                                                        <span key={i} style={{
                                                            padding: '4px 8px', borderRadius: '6px',
                                                            background: 'rgba(34, 197, 94, 0.1)',
                                                            border: '1px solid rgba(34, 197, 94, 0.3)',
                                                            color: '#22c55e', fontSize: '11px'
                                                        }}>
                                                            {new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                    ))}
                                                    {historicoFrequencia.datas_presente.length > 20 && (
                                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                            +{historicoFrequencia.datas_presente.length - 20} mais
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Datas de Ausência */}
                                        {historicoFrequencia.datas_ausente?.length > 0 && (
                                            <div style={{ marginBottom: '16px' }}>
                                                <h4 style={{ fontSize: '12px', color: '#ef4444', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <XCircle size={14} /> Faltas ({historicoFrequencia.datas_ausente.length})
                                                </h4>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {historicoFrequencia.datas_ausente.map((f: any, i: number) => (
                                                        <span key={i} style={{
                                                            padding: '4px 8px', borderRadius: '6px',
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            color: '#ef4444', fontSize: '11px'
                                                        }}>
                                                            {new Date(f.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Datas Justificadas */}
                                        {historicoFrequencia.datas_justificada?.length > 0 && (
                                            <div>
                                                <h4 style={{ fontSize: '12px', color: '#f59e0b', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <AlertCircle size={14} /> Justificadas ({historicoFrequencia.datas_justificada.length})
                                                </h4>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {historicoFrequencia.datas_justificada.map((j: any, i: number) => (
                                                        <span key={i} style={{
                                                            padding: '4px 8px', borderRadius: '6px',
                                                            background: 'rgba(245, 158, 11, 0.1)',
                                                            border: '1px solid rgba(245, 158, 11, 0.3)',
                                                            color: '#f59e0b', fontSize: '11px'
                                                        }}>
                                                            {new Date(j.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {(!historicoFrequencia.datas_presente?.length && !historicoFrequencia.datas_ausente?.length) && (
                                            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                                                <Calendar size={32} />
                                                <p style={{ margin: '10px 0 0' }}>Nenhum registro de frequência ainda</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RelatoriosAdmin;
