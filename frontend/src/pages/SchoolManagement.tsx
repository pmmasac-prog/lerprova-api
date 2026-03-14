import React, { useState, useEffect, useMemo } from 'react';
import { School, MapPin, Search, Plus, Eye } from 'lucide-react';
import { api } from '../services/api';

interface SchoolData {
  id: number;
  name: string;
  address: string;
  units: number;
}

export const SchoolManagement: React.FC = () => {
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    api.getSchoolData()
      .then(data => {
        setSchools(data || []);
      })
      .catch(err => console.error("Erro ao carregar escolas:", err))
      .finally(() => setLoading(false));
  }, []);

  const filteredSchools = useMemo(() => {
    if (!searchTerm) return schools;
    const term = searchTerm.toLowerCase();
    return schools.filter(s =>
      s.name.toLowerCase().includes(term) || s.address.toLowerCase().includes(term)
    );
  }, [schools, searchTerm]);

  if (loading) {
    return (
      <div className="admin-container">
        <header className="admin-header">
          <div>
            <h1 className="admin-title">Gestão de Escolas</h1>
            <p className="admin-subtitle">Gerencie as unidades e instituições cadastradas no sistema.</p>
          </div>
        </header>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando dados reais...</div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <h1 className="admin-title">Gestão de Escolas</h1>
          <p className="admin-subtitle">Gerencie as unidades e instituições cadastradas no sistema.</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={() => setShowNewModal(true)}>
          <Plus size={18} /> Nova Escola
        </button>
      </header>

      {showNewModal && (
        <div className="admin-card" style={{ marginTop: '16px', border: '1px solid var(--color-warning)33' }}>
          <p style={{ color: 'var(--color-warning)', fontSize: '0.9rem', margin: 0 }}>Funcionalidade de cadastro de escola em desenvolvimento.</p>
          <button onClick={() => setShowNewModal(false)} style={{ marginTop: '8px', color: 'var(--color-text-muted)', background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>Fechar</button>
        </div>
      )}

      <div className="admin-card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--color-text-muted)' }} />
            <input
              id="school-search"
              name="school-search"
              type="text"
              placeholder="Buscar por nome ou endereço..."
              className="admin-input"
              style={{ paddingLeft: '40px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Nome da Instituição</th>
              <th>Endereço</th>
              <th>Unidades</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchools.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '30px' }}>Nenhuma escola encontrada</td></tr>
            ) : filteredSchools.map(school => (
              <tr key={school.id}>
                <td style={{ fontWeight: '600' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', background: 'var(--border-color)', borderRadius: '8px' }}>
                      <School size={16} color="var(--admin-gold)" />
                    </div>
                    {school.name}
                  </div>
                </td>
                <td style={{ color: 'var(--color-text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} /> {school.address}
                  </div>
                </td>
                <td>{school.units} Unidade(s)</td>
                <td>
                  <button className="btn-icon" title="Ver Detalhes" onClick={() => alert(`Detalhes: ${school.name} — ${school.units} unidade(s)`)}>
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
