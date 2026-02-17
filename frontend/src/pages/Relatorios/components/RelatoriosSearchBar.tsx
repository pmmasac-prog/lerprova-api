import React from 'react';
import { Search, ArrowUpDown } from 'lucide-react';

interface RelatoriosSearchBarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
    selectedGabarito: number | null;
    setSelectedGabarito: (id: number | null) => void;
    gabaritos: any[];
}

export const RelatoriosSearchBar: React.FC<RelatoriosSearchBarProps> = ({
    searchQuery,
    setSearchQuery,
    sortOrder,
    setSortOrder,
    selectedGabarito,
    setSelectedGabarito,
    gabaritos
}) => {
    return (
        <div className="search-area">
            <div className="search-row">
                <div className="search-box">
                    <Search size={16} color="#94a3b8" />
                    <input
                        type="text"
                        placeholder="Buscar aluno..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button
                    className="sort-btn"
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                >
                    <ArrowUpDown size={16} />
                    <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>
                </button>
            </div>

            <div className="filter-row" style={{ marginTop: '8px', overflowX: 'auto', paddingBottom: '10px', display: 'flex', gap: '8px' }}>
                <button
                    className={`chip ${selectedGabarito === null ? 'chip-active' : ''}`}
                    onClick={() => setSelectedGabarito(null)}
                    style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                >
                    Todas as Provas
                </button>
                {gabaritos.map(g => (
                    <button
                        key={g.id}
                        className={`chip ${selectedGabarito === g.id ? 'chip-active' : ''}`}
                        onClick={() => setSelectedGabarito(g.id)}
                        style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                    >
                        {g.titulo || g.assunto}
                    </button>
                ))}
            </div>
        </div>
    );
};
