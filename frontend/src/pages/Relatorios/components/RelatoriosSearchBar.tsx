import React from 'react';
import { Search, ArrowUpDown, Users, FileText } from 'lucide-react';

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
    gabaritos: any[];
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
    gabaritos
}) => {
    return (
        <div className="search-area" style={{ padding: '15px', background: '#fff', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <Users size={14} color="#94a3b8" />
                    </div>
                    <select
                        className="filter-select"
                        value={selectedTurma || ''}
                        onChange={(e) => setSelectedTurma(Number(e.target.value) || null)}
                        style={{
                            width: '100%',
                            padding: '10px 15px 10px 35px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#1e293b',
                            appearance: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="">Todas as Turmas</option>
                        {turmas.map(t => (
                            <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                    </select>
                </div>

                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <FileText size={14} color="#94a3b8" />
                    </div>
                    <select
                        className="filter-select"
                        value={selectedGabarito || ''}
                        onChange={(e) => setSelectedGabarito(Number(e.target.value) || null)}
                        style={{
                            width: '100%',
                            padding: '10px 15px 10px 35px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#1e293b',
                            appearance: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="">Todas as Provas</option>
                        {gabaritos.map(g => (
                            <option key={g.id} value={g.id}>{g.titulo || g.assunto}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="search-row" style={{ display: 'flex', gap: '8px' }}>
                <div className="search-box" style={{ flex: 1, margin: 0 }}>
                    <Search size={16} color="#94a3b8" />
                    <input
                        type="text"
                        placeholder="Buscar pelo nome do aluno..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', padding: '8px' }}
                    />
                </div>
                <button
                    className="sort-btn"
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    style={{ padding: '0 15px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#64748b' }}
                >
                    <ArrowUpDown size={14} />
                </button>
            </div>
        </div>
    );
};
