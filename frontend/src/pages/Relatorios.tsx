// relatorio.tsx (versão simples, sem poluição visual)
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ClipboardCopy, AlertTriangle, CheckCircle2, Users, Pencil } from 'lucide-react';
import { api } from '../services/api';
import './Relatorios.css';

// Tipos (mantém seu padrão)
import type { Turma, Resultado, Gabarito } from './Relatorios/types';
import { EditResultadoModal } from './Relatorios/components/EditResultadoModal';

type RiskLevel = 'high' | 'mid' | 'low';
type ViewFilter = 'all' | 'risk_high' | 'below_7' | 'approved';

export const Relatorios: React.FC = () => {
  const [loading, setLoading] = useState(true);

  // Dados
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [gabaritos, setGabaritos] = useState<Gabarito[]>([]);

  // Filtros (apenas os 4 solicitados)
  const [selectedTurma, setSelectedTurma] = useState<number | null>(null);
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>(''); // '' = todas
  const [selectedPeriodo, setSelectedPeriodo] = useState<number | ''>(''); // '' = todos
  const [selectedMonth, setSelectedMonth] = useState<number | ''>(new Date().getMonth() + 1); // 1-12 ou ''

  // Visão operacional (sem poluição visual)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');

  // Modal edição
  const [editingResultado, setEditingResultado] = useState<Resultado | null>(null);
  const [editingGabarito, setEditingGabarito] = useState<Gabarito | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      if (turmasData.length > 0) {
        setSelectedTurma(turmasData[0].id);
        // tenta pré-selecionar disciplina pela primeira turma, se existir
        const d = (turmasData[0] as any).disciplina;
        if (typeof d === 'string' && d.trim()) setSelectedDisciplina(d);
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  };

  // Helpers
  const computeRisk = (nota: number): RiskLevel => {
    if (nota < 5) return 'high';
    if (nota < 7) return 'mid';
    return 'low';
  };

  // Extrai mês do resultado (tenta várias chaves comuns)
  const getMonthFromResultado = (r: any): number | null => {
    const raw =
      r.data ||
      r.date ||
      r.created_at ||
      r.updated_at ||
      r.applied_at ||
      r.realizada_em ||
      null;

    if (!raw) return null;

    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.getMonth() + 1;
  };

  // Lista de disciplinas para o filtro
  const disciplinas = useMemo(() => {
    const set = new Set<string>();
    turmas.forEach(t => {
      const d = (t as any).disciplina;
      if (typeof d === 'string' && d.trim()) set.add(d.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [turmas]);

  // Períodos disponíveis (derivados dos resultados)
  const periodos = useMemo(() => {
    const set = new Set<number>();
    resultados.forEach(r => {
      const p = (r as any).periodo;
      if (typeof p === 'number' && !Number.isNaN(p)) set.add(p);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [resultados]);

  // Filtro principal (apenas turma/disciplina/período/mês + viewFilter)
  const filteredList = useMemo(() => {
    let list = [...resultados];

    // Turma (se selecionada)
    if (selectedTurma != null) {
      list = list.filter(r => r.turma_id === selectedTurma);
    }

    // Disciplina (se selecionada) — filtra pela turma da disciplina
    if (selectedDisciplina.trim()) {
      const turmaIds = turmas
        .filter(t => ((t as any).disciplina || '').toString().trim() === selectedDisciplina.trim())
        .map(t => t.id);
      list = list.filter(r => turmaIds.includes(r.turma_id));
    }

    // Período
    if (selectedPeriodo !== '') {
      list = list.filter(r => (r as any).periodo === selectedPeriodo);
    }

    // Mês (se existir data no resultado)
    if (selectedMonth !== '') {
      list = list.filter(r => {
        const m = getMonthFromResultado(r);
        if (m == null) return true; // se não tem data, não exclui (evita “sumir tudo”)
        return m === selectedMonth;
      });
    }

    // ViewFilter (ações rápidas)
    if (viewFilter === 'risk_high') list = list.filter(r => computeRisk(r.nota) === 'high');
    if (viewFilter === 'below_7') list = list.filter(r => r.nota < 7);
    if (viewFilter === 'approved') list = list.filter(r => r.nota >= 7);

    // Ordenação “pedagógica”: pior primeiro (para ação)
    list.sort((a, b) => a.nota - b.nota);
    return list;
  }, [resultados, selectedTurma, selectedDisciplina, selectedPeriodo, selectedMonth, viewFilter, turmas]);

  // Contagens operacionais mínimas (sem cards poluídos)
  const summary = useMemo(() => {
    const total = filteredList.length;
    const critico = filteredList.filter(r => computeRisk(r.nota) === 'high').length;
    const abaixo7 = filteredList.filter(r => r.nota < 7).length;
    const riscoMedio = filteredList.filter(r => computeRisk(r.nota) === 'mid').length;
    const aprovados = filteredList.filter(r => r.nota >= 7).length;

    // status simples:
    // - se tem crítico => "Prioridade máxima"
    // - senão se tem risco médio/abaixo7 => "Atenção"
    // - senão => "Ok"
    const status =
      critico > 0 ? 'Prioridade máxima' : abaixo7 > 0 || riscoMedio > 0 ? 'Atenção' : 'Ok';

    return { total, critico, abaixo7, riscoMedio, aprovados, status };
  }, [filteredList]);

  const turmaNome = useMemo(() => {
    if (selectedTurma == null) return 'Turma';
    return turmas.find(t => t.id === selectedTurma)?.nome || 'Turma';
  }, [selectedTurma, turmas]);

  const buildInterventionText = () => {
    const high = filteredList
      .filter(r => computeRisk(r.nota) === 'high')
      .sort((a, b) => a.nota - b.nota);

    const mid = filteredList
      .filter(r => computeRisk(r.nota) === 'mid')
      .sort((a, b) => a.nota - b.nota);

    const lines: string[] = [];
    lines.push(`Plano rápido de intervenção`);
    lines.push(`Turma: ${turmaNome}`);
    if (selectedDisciplina.trim()) lines.push(`Disciplina: ${selectedDisciplina.trim()}`);
    if (selectedPeriodo !== '') lines.push(`Período: ${selectedPeriodo}`);
    if (selectedMonth !== '') lines.push(`Mês: ${String(selectedMonth).padStart(2, '0')}`);
    lines.push(``);
    lines.push(`Crítico (nota < 5): ${high.length}`);
    high.forEach((r, i) => lines.push(`${i + 1}. ${r.nome} — nota ${r.nota}`));
    lines.push(``);
    lines.push(`Risco médio (5 a 6,9): ${mid.length}`);
    mid.forEach((r, i) => lines.push(`${i + 1}. ${r.nome} — nota ${r.nota}`));
    lines.push(``);
    lines.push(`Ação objetiva:`);
    lines.push(`1) Reforço curto e dirigido (10–15 itens)`);
    lines.push(`2) Devolutiva imediata para os críticos`);
    lines.push(`3) Reavaliação/recuperação focada nos críticos`);
    return lines.join('\n');
  };

  const copyInterventionToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(buildInterventionText());
    } catch (e) {
      console.warn('Clipboard bloqueado. Texto no console:');
      console.log(buildInterventionText());
    }
  };

  const clearFilters = () => {
    setViewFilter('all');
    setSelectedDisciplina('');
    setSelectedPeriodo('');
    setSelectedMonth(new Date().getMonth() + 1);
  };

  const handleEditClick = (resultado: Resultado) => {
    const gab = gabaritos.find(g => g.id === (resultado as any).gabarito_id);
    if (gab) {
      setEditingResultado(resultado);
      setEditingGabarito(gab);
    }
  };

  return (
    <div className="relatorios-container simple">
      <div className="relatorios-header simple">
        <div className="header-left">
          <div className="header-title">Relatórios</div>
          <div className="header-subtitle">
            {turmaNome}
            {selectedDisciplina.trim() ? ` • ${selectedDisciplina.trim()}` : ''}
          </div>
        </div>

        <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div className="relatorios-content simple">
        {/* Filtros mínimos */}
        <div className="filters-bar">
          <div className="filter">
            <label>Turma</label>
            <select
              value={selectedTurma ?? ''}
              onChange={e => setSelectedTurma(e.target.value ? Number(e.target.value) : null)}
            >
              {turmas.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="filter">
            <label>Disciplina</label>
            <select
              value={selectedDisciplina}
              onChange={e => setSelectedDisciplina(e.target.value)}
            >
              <option value="">Todas</option>
              {disciplinas.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="filter">
            <label>Período</label>
            <select
              value={selectedPeriodo}
              onChange={e => setSelectedPeriodo(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Todos</option>
              {periodos.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="filter">
            <label>Mês</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value === '' ? '' : Number(e.target.value))}
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const v = i + 1;
                return (
                  <option key={v} value={v}>
                    {String(v).padStart(2, '0')}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Status mínimo (sem cards gigantes) */}
        <div className={`status-strip ${summary.critico > 0 ? 'critical' : summary.abaixo7 > 0 ? 'warn' : 'ok'}`}>
          <div className="status-left">
            <span className="status-title">
              {summary.critico > 0 ? 'Crítico' : summary.abaixo7 > 0 ? 'Atenção' : 'Ok'}
            </span>
            <span className="status-sub">
              {summary.status} • Total {summary.total}
            </span>
          </div>
          <div className="status-right">
            <span className="pill danger">Abaixo de 7: {summary.abaixo7}</span>
            <span className="pill mid">Risco médio: {summary.riscoMedio}</span>
            <span className="pill high">Crítico: {summary.critico}</span>
          </div>
        </div>

        {/* Lista compacta tipo “frequência” */}
        <div className="report-table-wrap">
          <div className="report-table">
            <div className="rt-head">
              <div className="rt-col name">Aluno</div>
              <div className="rt-col nota">Nota</div>
              <div className="rt-col risk">Status</div>
              <div className="rt-col act">Ação</div>
            </div>

            {loading ? (
              <div className="rt-empty">Carregando...</div>
            ) : filteredList.length === 0 ? (
              <div className="rt-empty">Sem dados para os filtros atuais.</div>
            ) : (
              filteredList.map((r, idx) => {
                const risk = computeRisk(r.nota);
                return (
                  <div key={(r as any).id ?? `${r.nome}-${idx}`} className={`rt-row ${risk}`}>
                    <div className="rt-col name" title={r.nome}>
                      {r.nome}
                    </div>
                    <div className="rt-col nota">{r.nota.toFixed(1)}</div>
                    <div className="rt-col risk">
                      {risk === 'high' ? 'Crítico (<5)' : risk === 'mid' ? 'Atenção (5–6,9)' : 'Aprovado (≥7)'}
                    </div>
                    <div className="rt-col act">
                      <button className="btn btn-mini" onClick={() => handleEditClick(r)} title="Editar resultado">
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer: apenas ações solicitadas */}
      <div className="simple-footer">
        <button className="btn btn-primary" onClick={() => setViewFilter('risk_high')}>
          <AlertTriangle size={16} />
          Intervir (risco alto)
        </button>

        <button className="btn" onClick={() => setViewFilter('below_7')}>
          <Users size={16} />
          Ver abaixo de 7
        </button>

        <button className="btn" onClick={() => setViewFilter('approved')}>
          <CheckCircle2 size={16} />
          Ver aprovados
        </button>

        <button className="btn" onClick={copyInterventionToClipboard}>
          <ClipboardCopy size={16} />
          Copiar plano
        </button>

        <button className="btn btn-danger" onClick={clearFilters}>
          Limpar filtros
        </button>
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