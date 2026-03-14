// ./Relatorios/components/RelatoriosSearchBar.tsx
// Versão compacta: todos os filtros e busca em uma única linha horizontal

import React from 'react';
import { Search, ArrowUpDown, Users, FileText, Calendar } from 'lucide-react';

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
    riskFilter?: any;
    setRiskFilter?: any;
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
}) => {
    return (
        <div className="compact-toolbar">
            {/* Busca */}
            <div className="compact-search">
                <Search size={13} className="compact-search-icon" />
                <input
                    type="text"
                    placeholder="Buscar aluno..."
                    className="compact-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Turma */}
            <div className="compact-select-wrap">
                <Users size={12} className="compact-select-icon" />
                <select
                    className="compact-select"
                    value={selectedTurma || ''}
                    onChange={(e) => setSelectedTurma(Number(e.target.value) || null)}
                >
                    <option value="">Turma</option>
                    {turmas.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                </select>
            </div>

            {/* Prova */}
            <div className="compact-select-wrap">
                <FileText size={12} className="compact-select-icon" />
                <select
                    className="compact-select"
                    value={selectedGabarito || ''}
                    onChange={(e) => setSelectedGabarito(Number(e.target.value) || null)}
                >
                    <option value="">Prova</option>
                    {gabaritos.map((g) => (
                        <option key={g.id} value={g.id}>{g.titulo || g.assunto}</option>
                    ))}
                </select>
            </div>

            {/* Período */}
            <div className="compact-select-wrap">
                <select
                    className="compact-select"
                    value={selectedPeriodo || ''}
                    onChange={(e) => setSelectedPeriodo(e.target.value ? Number(e.target.value) : null)}
                >
                    <option value="">Período</option>
                    <option value="1">1º</option>
                    <option value="2">2º</option>
                    <option value="3">3º</option>
                    <option value="4">4º</option>
                </select>
            </div>

            {/* Mês */}
            <div className="compact-select-wrap">
                <Calendar size={12} className="compact-select-icon" />
                <select
                    className="compact-select"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                    {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                </select>
            </div>

            {/* Ordenação */}
            <button
                className="compact-sort-btn"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                title={sortOrder === 'desc' ? 'Maior → Menor' : 'Menor → Maior'}
            >
                <ArrowUpDown size={13} />
            </button>
        </div>
    );
};