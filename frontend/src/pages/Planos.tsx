import React, { useState, useEffect } from 'react';
import { FileText, Plus, BookOpen, Clock, Calendar, ChevronRight, X } from 'lucide-react';
import { api } from '../services/api';
import './Planos.css';

interface PlanoAnual {
  id: number;
  serie: string;
  turno: string;
  area_conhecimento: string;
  componente_curricular: string;
  metodologias: string;
  avaliacao: string;
  created_at: string;
}

interface PlanoPeriodo {
  id: number;
  plano_anual_id: number;
  componente_curricular: string;
  serie: string;
  turmas: string;
  periodo_letivo: string;
  habilidades_bncc: string;
  objetos_conhecimento: string;
  conteudos: string;
  procedimentos_metodologicos: string;
  recursos: string;
  procedimentos_avaliativos: string;
  referencias: string;
}

const Planos: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'anuais' | 'periodos'>('anuais');
  const [anuais, setAnuais] = useState<PlanoAnual[]>([]);
  const [periodos, setPeriodos] = useState<PlanoPeriodo[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Novo Plano Anual
  const [isNovoAnualModalOpen, setIsNovoAnualModalOpen] = useState(false);
  const [novoAnual, setNovoAnual] = useState({
    serie: '',
    turno: '',
    area_conhecimento: '',
    componente_curricular: '',
    objetos_conhecimento_b1: '',
    metodologias: '',
    avaliacao: ''
  });

  // Modal Gerar Período
  const [isGerarPeriodoModalOpen, setIsGerarPeriodoModalOpen] = useState(false);
  const [selectedPlanoAnualId, setSelectedPlanoAnualId] = useState<number | null>(null);
  const [selectedBimestre, setSelectedBimestre] = useState(1);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resAnuais, resPeriodos] = await Promise.all([
        api.getPlanosAnuais(),
        api.getPlanosPeriodos()
      ]);
      setAnuais(resAnuais);
      setPeriodos(resPeriodos);
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnual = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPlanoAnual(novoAnual);
      setIsNovoAnualModalOpen(false);
      setNovoAnual({
        serie: '', turno: '', area_conhecimento: '', 
        componente_curricular: '', objetos_conhecimento_b1: '', 
        metodologias: '', avaliacao: ''
      });
      fetchData();
    } catch (error) {
      console.error('Erro ao criar plano anual:', error);
      alert('Erro ao criar plano anual.');
    }
  };

  const handleGerarPeriodo = async () => {
    if (!selectedPlanoAnualId) return;
    try {
      await api.gerarPlanoPeriodo(selectedPlanoAnualId, selectedBimestre);
      setIsGerarPeriodoModalOpen(false);
      fetchData();
      setActiveTab('periodos'); // Mudar aba para ver o resultado
    } catch (error: any) {
      console.error('Erro ao gerar plano de período:', error);
      alert(error.response?.data?.detail || 'Erro ao gerar plano de período.');
    }
  };

  const openGerarPeriodoModal = (id: number) => {
    setSelectedPlanoAnualId(id);
    setSelectedBimestre(1);
    setIsGerarPeriodoModalOpen(true);
  };

  return (
    <div className="planos-container">
      <div className="planos-header">
        <h1>
          <BookOpen size={28} className="text-blue-600" />
          Planos de Ensino
        </h1>
        <button 
          className="new-plano-btn"
          onClick={() => setIsNovoAnualModalOpen(true)}
        >
          <Plus size={20} />
          Novo Plano Anual
        </button>
      </div>

      <div className="planos-tabs">
        <button 
          className={`tab-btn ${activeTab === 'anuais' ? 'active' : ''}`}
          onClick={() => setActiveTab('anuais')}
        >
          Planos Anuais
        </button>
        <button 
          className={`tab-btn ${activeTab === 'periodos' ? 'active' : ''}`}
          onClick={() => setActiveTab('periodos')}
        >
          Planos por Período
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-500">
          Carregando planos...
        </div>
      ) : (
        <div className="planos-content">
          {activeTab === 'anuais' && (
            anuais.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <h3>Nenhum Plano Anual</h3>
                <p>Você ainda não criou nenhum planejamento anual.</p>
              </div>
            ) : (
              <div className="planos-list">
                {anuais.map(plano => (
                  <div key={plano.id} className="plano-card">
                    <div className="plano-card-header">
                      <h3>{plano.componente_curricular}</h3>
                      <span className="plano-badge">Anual</span>
                    </div>
                    <div className="plano-info">
                      <div className="plano-info-item">
                        <Calendar size={16} />
                        Série: {plano.serie}
                      </div>
                      <div className="plano-info-item">
                        <Clock size={16} />
                        Turno: {plano.turno}
                      </div>
                      <div className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {plano.area_conhecimento}
                      </div>
                    </div>
                    <div className="plano-actions">
                      <button className="action-btn secondary">Editar</button>
                      <button 
                        className="action-btn primary"
                        onClick={() => openGerarPeriodoModal(plano.id)}
                      >
                        Gerar Bimestre <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'periodos' && (
            periodos.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <h3>Nenhum Plano por Período</h3>
                <p>Gere os planos por período através dos seus Planos Anuais.</p>
              </div>
            ) : (
              <div className="planos-list">
                {periodos.map(plano => (
                  <div key={plano.id} className="plano-card border-l-4 border-l-blue-500">
                    <div className="plano-card-header">
                      <h3>{plano.componente_curricular}</h3>
                      <span className="plano-badge bg-green-100 text-green-800">
                        {plano.periodo_letivo}
                      </span>
                    </div>
                    <div className="plano-info">
                      <div className="plano-info-item">
                        <Calendar size={16} />
                        Série: {plano.serie}
                      </div>
                      <div className="plano-info-item text-xs text-gray-400 mt-2">
                        Vinculado ao Anual #{plano.plano_anual_id}
                      </div>
                    </div>
                    <div className="plano-actions">
                      <button className="action-btn secondary">Visualizar Completo</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* MODAL: Novo Plano Anual Simplificado */}
      {isNovoAnualModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Criar Plano Anual</h2>
              <button className="close-btn" onClick={() => setIsNovoAnualModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateAnual}>
              <div className="form-row">
                <div className="form-group">
                  <label>Série</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: 1º Ano"
                    value={novoAnual.serie}
                    onChange={e => setNovoAnual({...novoAnual, serie: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Turno</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: Matutino"
                    value={novoAnual.turno}
                    onChange={e => setNovoAnual({...novoAnual, turno: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Área de Conhecimento</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: Ciências da Natureza"
                    value={novoAnual.area_conhecimento}
                    onChange={e => setNovoAnual({...novoAnual, area_conhecimento: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Componente Curricular</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: Biologia"
                    value={novoAnual.componente_curricular}
                    onChange={e => setNovoAnual({...novoAnual, componente_curricular: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Objetos de Conhecimento (1º Bimestre)</label>
                <textarea 
                  className="form-control" 
                  placeholder="Descreva os objetos de conhecimento..."
                  value={novoAnual.objetos_conhecimento_b1}
                  onChange={e => setNovoAnual({...novoAnual, objetos_conhecimento_b1: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Metodologias (Global)</label>
                <textarea 
                  className="form-control" 
                  value={novoAnual.metodologias}
                  onChange={e => setNovoAnual({...novoAnual, metodologias: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Procedimentos Avaliativos (Global)</label>
                <textarea 
                  className="form-control" 
                  value={novoAnual.avaliacao}
                  onChange={e => setNovoAnual({...novoAnual, avaliacao: e.target.value})}
                />
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="action-btn secondary"
                  onClick={() => setIsNovoAnualModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="action-btn primary bg-blue-600 text-white hover:bg-blue-700">
                  Salvar Plano Anual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Gerar Período */}
      {isGerarPeriodoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Extrair Plano Bimestral</h2>
              <button className="close-btn" onClick={() => setIsGerarPeriodoModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-4 text-sm">
                Selecione qual bimestre você deseja extrair deste Plano Anual. O sistema preencherá as informações baseadas no seu planejamento.
              </p>
              <div className="form-group">
                <label>Bimestre</label>
                <select 
                  className="form-control"
                  value={selectedBimestre}
                  onChange={e => setSelectedBimestre(Number(e.target.value))}
                >
                  <option value={1}>1º Bimestre</option>
                  <option value={2}>2º Bimestre</option>
                  <option value={3}>3º Bimestre</option>
                  <option value={4}>4º Bimestre</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="action-btn secondary"
                onClick={() => setIsGerarPeriodoModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className="action-btn primary bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleGerarPeriodo}
              >
                Confirmar Extração
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Planos;
