// ./Relatorios/components/RelatoriosSearchBar.tsx
// Melhorias aplicadas:
// 1) Remove estilos inline (mantém designer consistente com Relatorios.css v2)
// 2) Adiciona filtro pedagógico (Risco alto / abaixo de 7 / aprovados)
// 3) Mantém compatibilidade: se você não passar riskFilter props, funciona igual ao seu atual

import React from 'react';
import { Search, ArrowUpDown, Users, FileText, Calendar, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';

type RiskFilter = 'all' | 'risk_high' | 'risk_mid' | 'below_7' | 'approved';

interface RelatoriosSearchBarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
    selectedTurma: number | null;
    setSelectedTurma: (id: number | null) => void;
    turmas: any[];
    selectedGabarito: number | null;
    setSelectedGabarito: (id: number | null) => void;
    selectedPeriodo: number | null;
    setSelectedPeriodo: (periodo: number | null) => void;
    selectedMonth: number;
    setSelectedMonth: (month: number) => void;
    gabaritos: any[];

    // NOVO (opcional)
    riskFilter?: RiskFilter;
    setRiskFilter?: (v: RiskFilter) => void;
}

export const RelatoriosSearchBar: React.FC<RelatoriosSearchBarProps> = ({
    searchQuery,
    setSearchQuery,
    sortOrder,
    setSortOrder,
    selectedTurma,
    setSelectedTurma,
    turmas,
    selectedGabarito,
    setSelectedGabarito,
    selectedPeriodo,
    setSelectedPeriodo,
    selectedMonth,
    setSelectedMonth,
    gabaritos,
    riskFilter,
    setRiskFilter,
}) => {
    const canUseRisk = Boolean(riskFilter && setRiskFilter);

    return (
        <div className="search-area">
            {/* Grid de filtros (sem inline) */}
            <div className="filters-grid">
                <div className="select-wrap">
                    <span className="select-icon">
                        <Users size={14} />
                    </span>
                    <select
                        className="filter-select"
                        value={selectedTurma || ''}
                        onChange={(e) => setSelectedTurma(Number(e.target.value) || null)}
                    >
                        <option value="">Todas as Turmas</option>
                        {turmas.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.nome}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="select-wrap">
                    <span className="select-icon">
                        <FileText size={14} />
                    </span>
                    <select
                        className="filter-select"
                        value={selectedGabarito || ''}
                        onChange={(e) => setSelectedGabarito(Number(e.target.value) || null)}
                    >
                        <option value="">Todas as Provas</option>
                        {gabaritos.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.titulo || g.assunto}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="select-wrap">
                    <span className="select-icon">
                        <ArrowUpDown size={14} />
                    </span>
                    <select
                        className="filter-select"
                        value={selectedPeriodo || ''}
                        onChange={(e) => setSelectedPeriodo(e.target.value ? Number(e.target.value) : null)}
                    >
                        <option value="">Todos os Períodos</option>
                        <option value="1">1º Período</option>
                        <option value="2">2º Período</option>
                        <option value="3">3º Período</option>
                        <option value="4">4º Período</option>
                    </select>
                </div>

                <div className="select-wrap">
                    <span className="select-icon">
                        <Calendar size={14} />
                    </span>
                    <select
                        className="filter-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                        <option value="1">Janeiro</option>
                        <option value="2">Fevereiro</option>
                        <option value="3">Março</option>
                        <option value="4">Abril</option>
                        <option value="5">Maio</option>
                        <option value="6">Junho</option>
                        <option value="7">Julho</option>
                        <option value="8">Agosto</option>
                        <option value="9">Setembro</option>
                        <option value="10">Outubro</option>
                        <option value="11">Novembro</option>
                        <option value="12">Dezembro</option>
                    </select>
                </div>
            </div>

            {/* Chips pedagógicos (opcional) */}
            {canUseRisk && (
                <div className="filter-row">
                    <button
                        type="button"
                        className={`nota-chip ${riskFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setRiskFilter?.('all')}
                        title="Sem filtro pedagógico"
                    >
                        <Filter size={14} />
                        Todos
                    </button>

                    <button
                        type="button"
                        className={`nota-chip ${riskFilter === 'risk_high' ? 'active' : ''}`}
                        onClick={() => setRiskFilter?.('risk_high')}
                        title="Notas abaixo de 5"
                    >
                        <AlertTriangle size={14} />
                        Risco alto
                    </button>

                    <button
                        type="button"
                        className={`nota-chip ${riskFilter === 'below_7' ? 'active' : ''}`}
                        onClick={() => setRiskFilter?.('below_7')}
                        title="Notas abaixo de 7"
                    >
                        <AlertTriangle size={14} />
                        Abaixo de 7
                    </button>

                    <button
                        type="button"
                        className={`nota-chip ${riskFilter === 'approved' ? 'active' : ''}`}
                        onClick={() => setRiskFilter?.('approved')}
                        title="Notas 7 ou mais"
                    >
                        <CheckCircle2 size={14} />
                        Aprovados
                    </button>
                </div>
            )}

            {/* Busca + ordenação */}
            <div className="search-row">
                <div className="search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Buscar pelo nome do aluno..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button
                    className="sort-btn"
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    title="Alternar ordenação"
                >
                    <ArrowUpDown size={14} />
                </button>
            </div>
        </div>
    );
};