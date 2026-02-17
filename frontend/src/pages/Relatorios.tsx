import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, HelpCircle, Calendar, Download, FileText } from 'lucide-react';
import { api } from '../services/api';
import './Relatorios.css';

// Modular Imports
import type { Turma, Resultado, Gabarito } from './Relatorios/types';
import { FrequencyMatrix } from './Relatorios/components/FrequencyMatrix';
import { RankingTurma } from './Relatorios/components/RankingTurma';
import { RankingGlobal } from './Relatorios/components/RankingGlobal';
import { AnaliseQuestoes } from './Relatorios/components/AnaliseQuestoes';
import { RelatoriosSearchBar } from './Relatorios/components/RelatoriosSearchBar';
import { handleExportCSV, handleExportPDF } from './Relatorios/utils/exportUtils';
import { EditResultadoModal } from './Relatorios/components/EditResultadoModal';

export const Relatorios: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Turma');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [minNota, setMinNota] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // States
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<number | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [gabaritos, setGabaritos] = useState<Gabarito[]>([]);
  const [selectedGabarito, setSelectedGabarito] = useState<number | null>(null);
  const [overallStats, setOverallStats] = useState({ media: '0.0', aprovacao: 0, total: 0 });

  // Modais de Edição
  const [editingResultado, setEditingResultado] = useState<Resultado | null>(null);
  const [editingGabarito, setEditingGabarito] = useState<Gabarito | null>(null);

  const tabs = [
    { id: 'Turma', icon: TrendingUp, label: 'Turma' },
    { id: 'Aluno', icon: Users, label: 'Aluno' },
    { id: 'Questão', icon: HelpCircle, label: 'Questão' },
    { id: 'Presença', icon: Calendar, label: 'Freq.' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [turmasData, resultadosData, gabaritosData] = await Promise.all([
        api.getTurmas(),
        api.getResultados(),
        api.getGabaritos(),
      ]);

      setTurmas(turmasData);
      setResultados(resultadosData);
      setGabaritos(gabaritosData);

      if (turmasData.length > 0) setSelectedTurma(turmasData[0].id);
      if (gabaritosData.length > 0) setSelectedGabarito(gabaritosData[0].id);

      if (resultadosData.length > 0) {
        const totalNotas = resultadosData.reduce((sum: number, r: Resultado) => sum + r.nota, 0);
        const media = (totalNotas / resultadosData.length).toFixed(1);
        const aprovados = resultadosData.filter((r: Resultado) => r.nota >= 7).length;
        const aprovacao = Math.round((aprovados / resultadosData.length) * 100);
        setOverallStats({ media, aprovacao, total: resultadosData.length });
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResultadosByTurma = () => {
    if (!selectedTurma) return [];
    return resultados.filter(r => r.turma_id === selectedTurma);
  };

  const getFilteredRanking = () => {
    let list = getResultadosByTurma();
    if (searchQuery.trim()) {
      list = list.filter((r: Resultado) => r.nome.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (minNota !== null) {
      list = list.filter((r: Resultado) => r.nota >= minNota);
    }
    list.sort((a: Resultado, b: Resultado) => sortOrder === 'desc' ? b.nota - a.nota : a.nota - b.nota);
    return list;
  };

  const calculateStatsForExport = () => {
    const list = getFilteredRanking();
    if (list.length === 0) return { media: 0, aprovacao: 0, total: 0 };
    const totalNotas = list.reduce((sum: number, r: Resultado) => sum + r.nota, 0);
    const media = totalNotas / list.length;
    const aprovados = list.filter((r: Resultado) => r.nota >= 7).length;
    const aprovacao = Math.round((aprovados / list.length) * 100);
    return { media, aprovacao, total: list.length };
  };

  const getQuestaoAnalysis = () => {
    if (!selectedGabarito) return [];
    const gabarito = gabaritos.find(g => g.id === selectedGabarito);
    if (!gabarito) return [];
    const resultadosGabarito = resultados.filter(r => r.gabarito_id === selectedGabarito);
    if (resultadosGabarito.length === 0) return [];

    let respostasCorretas: string[] = [];
    try { respostasCorretas = JSON.parse(gabarito.respostas_corretas); } catch (e) { return []; }

    return respostasCorretas.map((correta, idx) => {
      let acertos = 0, erros = 0;
      resultadosGabarito.forEach(r => {
        if ((r as any).respostas_aluno) {
          try {
            const respAluno = JSON.parse((r as any).respostas_aluno);
            if (respAluno[idx] === correta) acertos++; else erros++;
          } catch (e) { }
        }
      });
      const total = acertos + erros;
      return { questao: idx + 1, correta, acertos, erros, perc: total > 0 ? Math.round((acertos / total) * 100) : 0 };
    });
  };

  const onExportCSV = () => handleExportCSV(activeTab, {
    filteredResults: getFilteredRanking(),
    resultados,
    selectedTurmaNome: turmas.find(t => t.id === selectedTurma)?.nome || 'Turma',
    searchQuery,
    minNota,
    sortOrder,
    selectedGabarito,
    gabaritos,
    getQuestaoAnalysis,
    selectedTurma
  });

  const onExportPDF = () => handleExportPDF(activeTab, {
    selectedTurma,
    selectedTurmaNome: turmas.find(t => t.id === selectedTurma)?.nome || 'Turma',
    resultados,
    searchQuery,
    minNota,
    sortOrder,
    getFilteredRanking,
    calculateStatsForExport,
    setLoading
  });

  const handleEditClick = (resultado: Resultado) => {
    const gab = gabaritos.find(g => g.id === resultado.gabarito_id);
    if (gab) {
      setEditingResultado(resultado);
      setEditingGabarito(gab);
    }
  };

  return (
    <div className="relatorios-container">
      <div className="relatorios-header">
        <div className="flex items-center gap-3">
          <div className="icon-bg icon-bg-sm icon-indigo">
            <TrendingUp size={20} />
          </div>
          <h1 className="relatorios-title">Relatórios</h1>
        </div>
        <button className="refresh-btn" onClick={loadData}>Atualizar</button>
      </div>

      <div className="tab-bar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} className={`tab-item ${active ? 'tab-item-active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              <Icon size={16} color={active ? '#3b82f6' : '#94a3b8'} />
              <span className={`tab-text ${active ? 'tab-text-active' : ''}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="relatorios-content">
        {activeTab === 'Turma' && (
          <>
            <div className="chip-scroll">
              {turmas.map(t => (
                <button key={t.id} className={`chip ${selectedTurma === t.id ? 'chip-active' : ''}`} onClick={() => setSelectedTurma(t.id)}>{t.nome}</button>
              ))}
            </div>
            <RelatoriosSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} sortOrder={sortOrder} setSortOrder={setSortOrder} minNota={minNota} setMinNota={setMinNota} />
            <RankingTurma turma={turmas.find(t => t.id === selectedTurma)} resultados={getFilteredRanking()} loading={loading} overallStats={overallStats} onEdit={handleEditClick} />
          </>
        )}

        {activeTab === 'Aluno' && (
          <>
            <RelatoriosSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} sortOrder={sortOrder} setSortOrder={setSortOrder} minNota={minNota} setMinNota={setMinNota} />
            <RankingGlobal resultados={resultados.filter(r => !searchQuery || r.nome.toLowerCase().includes(searchQuery.toLowerCase())).filter(r => minNota === null || r.nota >= minNota).sort((a, b) => sortOrder === 'desc' ? b.nota - a.nota : a.nota - b.nota)} loading={loading} onEdit={handleEditClick} />
          </>
        )}

        {activeTab === 'Questão' && (
          <AnaliseQuestoes gabaritos={gabaritos} selectedGabarito={selectedGabarito} setSelectedGabarito={setSelectedGabarito} questaoStats={getQuestaoAnalysis()} loading={loading} hasResults={getResultadosByTurma().filter(r => r.gabarito_id === selectedGabarito).length > 0 || getQuestaoAnalysis().some(q => q.acertos > 0 || q.erros > 0)} />
        )}

        {activeTab === 'Presença' && (
          <div className="tab-content">
            <div className="chip-scroll">
              {turmas.map(t => (
                <button key={t.id} className={`chip ${selectedTurma === t.id ? 'chip-active' : ''}`} onClick={() => setSelectedTurma(t.id)}>{t.nome}</button>
              ))}
            </div>
            {selectedTurma ? <FrequencyMatrix turmaId={selectedTurma} /> : <div className="empty-box"><p className="empty-text">Selecione uma turma</p></div>}
          </div>
        )}
      </div>

      <div className="relatorios-footer">
        <button className="export-btn export-btn-dark" onClick={onExportCSV}><Download size={16} /><span>CSV</span></button>
        <button className="export-btn export-btn-blue" onClick={onExportPDF}><FileText size={16} /><span>PDF</span></button>
      </div>

      {editingResultado && editingGabarito && (
        <EditResultadoModal
          resultado={editingResultado}
          gabarito={editingGabarito}
          onClose={() => {
            setEditingResultado(null);
            setEditingGabarito(null);
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};
