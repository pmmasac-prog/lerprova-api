import React, { useState, useEffect } from 'react';
import { School, MapPin, Search, Plus, Filter, Eye } from 'lucide-react';
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

  useEffect(() => {
    // Busca real do banco de dados via API
    api.getSchoolData()
      .then(data => {
        setSchools(data || []);
      })
      .catch(err => console.error("Erro ao carregar escolas:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <h1 className="admin-title">Gestão de Escolas</h1>
          <p className="admin-subtitle">Gerencie as unidades e instituições cadastradas no sistema.</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Plus size={18} /> Nova Escola
        </button>
      </header>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Carregando dados reais...</div>
      ) : (
        <div className="admin-card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou endereço..." 
              className="admin-input" 
              style={{ paddingLeft: '40px' }}
            />
          </div>
          <button className="btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={18} /> Filtros
          </button>
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
            {schools.map(school => (
              <tr key={school.id}>
                <td style={{ fontWeight: '600' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', background: '#1e293b', borderRadius: '8px' }}>
                      <School size={16} color="var(--admin-gold)" />
                    </div>
                    {school.name}
                  </div>
                </td>
                <td style={{ color: '#94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} /> {school.address}
                  </div>
                </td>
                <td>{school.units} Unidade(s)</td>
                <td>
                  <button className="btn-icon" title="Ver Detalhes">
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};
