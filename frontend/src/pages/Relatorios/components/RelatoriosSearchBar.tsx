import React from 'react';
import { Search, ArrowUpDown } from 'lucide-react';

interface RelatoriosSearchBarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
    minNota: number | null;
    setMinNota: (nota: number | null) => void;
}

export const RelatoriosSearchBar: React.FC<RelatoriosSearchBarProps> = ({
    searchQuery,
    setSearchQuery,
    sortOrder,
    setSortOrder,
    minNota,
    setMinNota
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

            <div className="filter-row" style={{ marginTop: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {[null, 5, 6, 7, 8].map(nota => (
                    <button
                        key={String(nota)}
                        className={`nota-chip ${minNota === nota ? 'active' : ''}`}
                        onClick={() => setMinNota(nota)}
                    >
                        {nota === null ? 'Todos' : `Nota ≥ ${nota}`}
                    </button>
                ))}
            </div>
        </div>
    );
};
