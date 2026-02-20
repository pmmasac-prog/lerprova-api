// relatorio.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  HelpCircle,
  Calendar,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Users,
} from 'lucide-react';
import { api } from '../services/api';
import './Relatorios.css';

// Modular Imports
import type { Turma, Resultado, Gabarito } from './Relatorios/types';
import { FrequencyMatrix } from './Relatorios/components/FrequencyMatrix';
import { RankingTurma } from './Relatorios/components/RankingTurma';
import { AnaliseQuestoes } from './Relatorios/components/AnaliseQuestoes';
import { RelatoriosSearchBar } from './Relatorios/components/RelatoriosSearchBar';
import { handleExportCSV, handleExportPDF } from './Relatorios/utils/exportUtils';
import { EditResultadoModal } from './Relatorios/components/EditResultadoModal';

type RiskLevel = 'high' | 'mid' | 'low';
type RiskFilter = 'all' | 'risk_high' | 'risk_mid' | 'below_7' | 'approved';

export const Relatorios: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Turma');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);

  // States
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<number | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [gabaritos, setGabaritos] = useState<Gabarito[]>([]);
  const [selectedGabarito, setSelectedGabarito] = useState<number | null>(null);
  const [selectedPeriodo, setSelectedPeriodo] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12

  // Estatísticas globais (mantido)
  const [overallStats, setOverallStats] = useState({ media: '0.0', aprovacao: 0, total: 0 });

  // NOVO: filtro pedagógico de risco (sem depender do SearchBar)
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');

  // Modais de Edição
  const [editingResultado, setEditingResultado] = useState<Resultado | null>(null);
  const [editingGabarito, setEditingGabarito] = useState<Gabarito | null>(null);

  const tabs = [
    { id: 'Turma', icon: TrendingUp, label: 'Turma' },
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
      } else {
        setOverallStats({ media: '0.0', aprovacao: 0, total: 0 });
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

  const computeRisk = (nota: number): RiskLevel => {
    // Regras simples e bem previsíveis:
    // high: < 5 (risco alto)
    // mid:  5–6.9 (risco médio)
    // low:  >= 7 (ok)
    if (nota < 5) return 'high';
    if (nota < 7) return 'mid';
    return 'low';
  };

  const applyRiskFilter = (list: Resultado[]) => {
    switch (riskFilter) {
      case 'risk_high':
        return list.filter(r => computeRisk(r.nota) === 'high');
      case 'risk_mid':
        return list.filter(r => computeRisk(r.nota) === 'mid');
      case 'below_7':
        return list.filter(r => r.nota < 7);
      case 'approved':
        return list.filter(r => r.nota >= 7);
      case 'all':
      default:
        return list;
    }
  };

  const getFilteredRanking = () => {
    let list = getResultadosByTurma();

    if (searchQuery.trim()) {
      list = list.filter((r: Resultado) => r.nome.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (selectedGabarito !== null) {
      list = list.filter((r: Resultado) => r.gabarito_id === selectedGabarito);
    }

    if (selectedPeriodo !== null) {
      list = list.filter((r: Resultado) => r.periodo === selectedPeriodo);
    }

    list = applyRiskFilter(list);

    list.sort((a: Resultado, b: Resultado) =>
      sortOrder === 'desc' ? b.nota - a.nota : a.nota - b.nota
    );

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
    try {
      respostasCorretas = JSON.parse(gabarito.respostas_corretas);
    } catch (e) {
      return [];
    }

    return respostasCorretas.map((correta, idx) => {
      let acertos = 0,
        erros = 0;
      resultadosGabarito.forEach(r => {
        if ((r as any).respostas_aluno) {
          try {
            const respAluno = JSON.parse((r as any).respostas_aluno);
            if (respAluno[idx] === correta) acertos++;
            else erros++;
          } catch (e) { }
        }
      });
      const total = acertos + erros;
      return {
        questao: idx + 1,
        correta,
        acertos,
        erros,
        perc: total > 0 ? Math.round((acertos / total) * 100) : 0,
      };
    });
  };

  // ============================================
  // NOVO: Insights (diagnóstico automático)
  // ============================================

  const filteredList = useMemo(() => getFilteredRanking(), [
    resultados,
    selectedTurma,
    selectedGabarito,
    selectedPeriodo,
    searchQuery,
    sortOrder,
    riskFilter,
  ]);

  const insights = useMemo(() => {
    const total = filteredList.length;
    const media =
      total > 0 ? Number((filteredList.reduce((s, r) => s + r.nota, 0) / total).toFixed(1)) : 0;

    const approved = filteredList.filter(r => r.nota >= 7).length;
    const aprovacao = total > 0 ? Math.round((approved / total) * 100) : 0;

    const riskHigh = filteredList.filter(r => computeRisk(r.nota) === 'high').length;
    const riskMid = filteredList.filter(r => computeRisk(r.nota) === 'mid').length;

    const top3 = [...filteredList]
      .sort((a, b) => b.nota - a.nota)
      .slice(0, 3)
      .map(r => r.nome);

    // “Ponto de atenção” simples: maior volume de risco
    const hotspotLabel =
      riskHigh > 0
        ? `${riskHigh} em risco alto`
        : riskMid > 0
          ? `${riskMid} em risco médio`
          : total > 0
            ? 'Turma estável'
            : 'Sem dados';

    const level: RiskLevel =
      riskHigh > 0 ? 'high' : riskMid > 0 ? 'mid' : total > 0 ? 'low' : 'low';

    return {
      total,
      media,
      aprovacao,
      riskHigh,
      riskMid,
      top3,
      hotspotLabel,
      level,
    };
  }, [filteredList]);

  const buildInterventionText = () => {
    const turmaNome = turmas.find(t => t.id === selectedTurma)?.nome || 'Turma';
    const gabNome = selectedGabarito
      ? gabaritos.find(g => g.id === selectedGabarito)?.titulo || `Gabarito ${selectedGabarito}`
      : 'Gabarito';

    const high = filteredList
      .filter(r => computeRisk(r.nota) === 'high')
      .sort((a, b) => a.nota - b.nota);

    const mid = filteredList
      .filter(r => computeRisk(r.nota) === 'mid')
      .sort((a, b) => a.nota - b.nota);

    const lines: string[] = [];
    lines.push(`Plano rápido de intervenção`);
    lines.push(`Turma: ${turmaNome}`);
    lines.push(`Avaliação: ${gabNome}`);
    if (selectedPeriodo !== null) lines.push(`Período: ${selectedPeriodo}`);
    lines.push(`Resumo: média ${insights.media} | aprovação ${insights.aprovacao}% | total ${insights.total}`);
    lines.push('');
    lines.push(`Risco alto (<5): ${high.length}`);
    high.forEach((r, i) => lines.push(`${i + 1}. ${r.nome} — nota ${r.nota}`));
    lines.push('');
    lines.push(`Risco médio (5 a 6,9): ${mid.length}`);
    mid.forEach((r, i) => lines.push(`${i + 1}. ${r.nome} — nota ${r.nota}`));
    lines.push('');
    lines.push(`Ação sugerida (objetiva):`);
    lines.push(`1) Reforço direcionado por habilidade/questões mais erradas (aba "Questão")`);
    lines.push(`2) Lista de exercícios curta (10–15 itens) + devolutiva`);
    lines.push(`3) Reavaliação/recuperação focada nos alunos em risco alto`);
    return lines.join('\n');
  };

  const copyInterventionToClipboard = async () => {
    try {
      const text = buildInterventionText();
      await navigator.clipboard.writeText(text);
      // Se você quiser feedback visual depois, dá pra plugar um toast do seu app.
      console.log('Plano copiado para a área de transferência');
    } catch (e) {
      console.warn('Não foi possível copiar automaticamente. Veja o texto no console.');
      console.log(buildInterventionText());
    }
  };

  const onExportCSV = () =>
    handleExportCSV(activeTab, {
      filteredResults: filteredList,
      resultados,
      selectedTurmaNome: turmas.find(t => t.id === selectedTurma)?.nome || 'Turma',
      searchQuery,
      minNota: null,
      sortOrder,
      selectedGabarito,
      gabaritos,
      getQuestaoAnalysis,
      selectedTurma,
    });

  const onExportPDF = () =>
    handleExportPDF(activeTab, {
      selectedTurma,
      selectedTurmaNome: turmas.find(t => t.id === selectedTurma)?.nome || 'Turma',
      resultados,
      searchQuery,
      minNota: null,
      sortOrder,
      getFilteredRanking: () => filteredList,
      calculateStatsForExport,
      setLoading,
    });

  const handleEditClick = (resultado: Resultado) => {
    const gab = gabaritos.find(g => g.id === resultado.gabarito_id);
    if (gab) {
      setEditingResultado(resultado);
      setEditingGabarito(gab);
    }
  };

  const setPedagogicView = (next: RiskFilter) => {
    setRiskFilter(next);
    if (activeTab !== 'Turma') setActiveTab('Turma');
  };

  const AlertIcon = insights.level === 'high' ? AlertTriangle : CheckCircle2;
  const alertClass =
    insights.level === 'high' ? 'alert-high' : insights.level === 'mid' ? 'alert-mid' : 'alert-low';

  const alertTitle =
    insights.level === 'high'
      ? 'Atenção: alunos em risco alto'
      : insights.level === 'mid'
        ? 'Atenção: alunos em risco médio'
        : 'Turma estável';

  const alertDesc =
    insights.total === 0
      ? 'Nenhum dado encontrado para os filtros atuais.'
      : insights.level === 'high'
        ? `${insights.hotspotLabel}. Priorize intervenção imediata nos casos abaixo.`
        : insights.level === 'mid'
          ? `${insights.hotspotLabel}. Vale reforço orientado por questão/habilidade.`
          : `Sem alunos abaixo de 7 nos filtros atuais. Mantenha acompanhamento.`;

  return (
    <div className="relatorios-container">
      <div className="relatorios-header">
        <div className="flex items-center gap-3">
          <div
            className="mini-stat-icon"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div>
            <h1 className="relatorios-title">Relatórios</h1>
            <div className="relatorios-subtitle">
              {turmas.find(t => t.id === selectedTurma)?.nome || 'Selecione uma turma'}
              {selectedGabarito
                ? ` • ${gabaritos.find(g => g.id === selectedGabarito)?.titulo || `Gabarito ${selectedGabarito}`}`
                : ''}
            </div>
          </div>
        </div>

        <button className="refresh-btn" onClick={loadData} disabled={loading}>
          Atualizar
        </button>
      </div>

      <div className="tab-bar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab-item ${active ? 'tab-item-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} color={active ? '#3b82f6' : '#94a3b8'} />
              <span className={`tab-text ${active ? 'tab-text-active' : ''}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="relatorios-content">
        {/* NOVO: alerta de urgência + ações rápidas */}
        <div className={`alert-strip ${alertClass}`}>
          <div className="alert-icon">
            <AlertIcon size={18} />
          </div>
          <div className="alert-main">
            <div className="alert-title">{alertTitle}</div>
            <div className="alert-desc">{alertDesc}</div>
          </div>
          <div className="alert-actions">
            <button className="alert-btn" onClick={() => setPedagogicView('below_7')}>
              <Users size={16} />
              Ver &lt; 7
            </button>
            <button className="alert-btn" onClick={() => setPedagogicView('risk_high')}>
              <AlertTriangle size={16} />
              Risco alto
            </button>
            <button className="alert-btn" onClick={copyInterventionToClipboard}>
              <ClipboardCopy size={16} />
              Copiar plano
            </button>
          </div>
        </div>

        {/* NOVO: insights automáticos (diagnóstico) */}
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-top">
              <div className="insight-title">Média (filtros atuais)</div>
              <div className="insight-value">{insights.media.toFixed(1)}</div>
            </div>
            <div className="insight-meta">
              <span>Total: {insights.total}</span>
              <span className={`insight-trend ${insights.media >= 7 ? 'up' : insights.media >= 5 ? 'flat' : 'down'}`}>
                {insights.media >= 7 ? 'Boa' : insights.media >= 5 ? 'Atenção' : 'Crítica'}
              </span>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-top">
              <div className="insight-title">Aprovação</div>
              <div className="insight-value">{insights.aprovacao}%</div>
            </div>
            <div className="insight-meta">
              <span>
                Risco alto: {insights.riskHigh} • médio: {insights.riskMid}
              </span>
              <span
                className={`insight-trend ${insights.aprovacao >= 70 ? 'up' : insights.aprovacao >= 50 ? 'flat' : 'down'
                  }`}
              >
                {insights.aprovacao >= 70 ? 'Ok' : insights.aprovacao >= 50 ? 'Oscilando' : 'Baixa'}
              </span>
            </div>
          </div>
        </div>

        {/* Seus filtros principais */}
        <RelatoriosSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          selectedTurma={selectedTurma}
          setSelectedTurma={setSelectedTurma}
          turmas={turmas}
          selectedGabarito={selectedGabarito}
          setSelectedGabarito={setSelectedGabarito}
          selectedPeriodo={selectedPeriodo}
          setSelectedPeriodo={setSelectedPeriodo}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          gabaritos={gabaritos}
          riskFilter={riskFilter}
          setRiskFilter={setRiskFilter}
        />

        {activeTab === 'Turma' && (
          <RankingTurma
            turma={turmas.find(t => t.id === selectedTurma)}
            resultados={
              // Sem quebrar tipos: adiciono um campo opcional "risk" (caso o componente use).
              filteredList.map(r => ({ ...(r as any), risk: computeRisk(r.nota) })) as any
            }
            loading={loading}
            overallStats={overallStats}
            onEdit={handleEditClick}
          />
        )}

        {activeTab === 'Questão' && (
          <AnaliseQuestoes
            gabaritos={gabaritos}
            selectedGabarito={selectedGabarito}
            setSelectedGabarito={setSelectedGabarito}
            questaoStats={getQuestaoAnalysis()}
            loading={loading}
            hasResults={
              getResultadosByTurma().filter(r => r.gabarito_id === selectedGabarito).length > 0 ||
              getQuestaoAnalysis().some(q => q.acertos > 0 || q.erros > 0)
            }
          />
        )}

        {activeTab === 'Presença' && (
          <div className="tab-content">
            {selectedTurma ? (
              <FrequencyMatrix turmaId={selectedTurma} month={selectedMonth} />
            ) : (
              <div className="empty-box">
                <p className="empty-text">Selecione uma turma no filtro acima</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* NOVO: footer com ações + export */}
      <div className="relatorios-footer">
        <div className="footer-actions">
          <button className="action-btn primary" onClick={() => setPedagogicView('risk_high')}>
            <AlertTriangle size={16} />
            Intervir (risco alto)
          </button>

          <button className="action-btn" onClick={() => setPedagogicView('below_7')}>
            <Users size={16} />
            Ver abaixo de 7
          </button>

          <button className="action-btn" onClick={() => setPedagogicView('approved')}>
            <CheckCircle2 size={16} />
            Ver aprovados
          </button>

          <button className="action-btn" onClick={copyInterventionToClipboard}>
            <ClipboardCopy size={16} />
            Copiar plano
          </button>

          <button className="action-btn danger" onClick={() => setRiskFilter('all')}>
            Limpar filtros
          </button>
        </div>

        <div className="footer-export">
          <button className="export-btn export-btn-dark" onClick={onExportCSV}>
            <Download size={16} />
            <span>CSV</span>
          </button>
          <button className="export-btn export-btn-blue" onClick={onExportPDF}>
            <FileText size={16} />
            <span>PDF</span>
          </button>
        </div>
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