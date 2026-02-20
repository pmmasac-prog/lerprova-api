// src/pages/Relatorios.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ClipboardCopy, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import './Relatorios.css';

/**
 * Ajuste aqui:
 * - Se seu front tem proxy (vite/CRA) apontando para o backend, deixe ''
 * - Se não, coloque algo como: 'http://localhost:8000' ou sua URL do Render
 */
const API_BASE_URL = '';

type Turma = {
  id: number;
  nome: string;
  disciplina?: string | null;
};

type Resultado = {
  id?: number;
  turma_id: number;
  nome: string;
  nota?: number; // pode vir undefined
  periodo?: number;
  created_at?: string;
  data?: string;
  date?: string;
  gabarito_id?: number;
};

type RiskLevel = 'high' | 'mid' | 'low';
type ViewFilter = 'all' | 'risk_high' | 'below_7' | 'approved';

const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
const getNota = (r: Resultado): number => (isNumber(r.nota) ? r.nota : 0);

const computeRisk = (nota: number): RiskLevel => {
  if (nota < 5) return 'high';
  if (nota < 7) return 'mid';
  return 'low';
};

const getMonthFromResultado = (r: Resultado): number | null => {
  const raw = r.data || r.date || r.created_at || null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth() + 1;
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}`);
  return res.json() as Promise<T>;
}

export const Relatorios: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  // Filtros solicitados
  const [selectedTurma, setSelectedTurma] = useState<number | null>(null);
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>(''); // '' = todas
  const [selectedPeriodo, setSelectedPeriodo] = useState<number | null>(null); // null = todos
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  // Visão operacional
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');

  const loadData = async () => {
    try {
      setLoading(true);

      // Ajuste os endpoints para os seus reais:
      // exemplos comuns no seu projeto:
      // /turmas
      // /resultados
      const [turmasData, resultadosData] = await Promise.all([
        apiGet<Turma[]>('/turmas'),
        apiGet<Resultado[]>('/resultados'),
      ]);

      setTurmas(turmasData);
      setResultados(resultadosData);

      if (turmasData.length > 0) {
        setSelectedTurma(turmasData[0].id);
        const d = turmasData[0].disciplina;
        if (typeof d === 'string' && d.trim()) setSelectedDisciplina(d.trim());
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
      setTurmas([]);
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disciplinas = useMemo(() => {
    const set = new Set<string>();
    turmas.forEach(t => {
      const d = (t.disciplina || '').toString().trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [turmas]);

  const periodos = useMemo(() => {
    const set = new Set<number>();
    resultados.forEach(r => {
      const p = r.periodo;
      if (typeof p === 'number' && !Number.isNaN(p)) set.add(p);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [resultados]);

  const turmaNome = useMemo(() => {
    if (!isNumber(selectedTurma)) return 'Turma';
    const t = turmas.find(x => x.id === selectedTurma);
    return t ? t.nome : 'Turma';
  }, [selectedTurma, turmas]);

  const filteredList = useMemo(() => {
    let list = [...resultados];

    // Turma
    if (isNumber(selectedTurma)) {
      list = list.filter(r => r.turma_id === selectedTurma);
    }

    // Disciplina (por turma)
    if (selectedDisciplina.trim()) {
      const turmaIds = turmas
        .filter(t => ((t.disciplina || '').toString().trim() === selectedDisciplina.trim()))
        .map(t => t.id);
      list = list.filter(r => turmaIds.includes(r.turma_id));
    }

    // Período
    if (isNumber(selectedPeriodo)) {
      list = list.filter(r => r.periodo === selectedPeriodo);
    }

    // Mês (se não tiver data no resultado, não exclui)
    if (isNumber(selectedMonth)) {
      list = list.filter(r => {
        const m = getMonthFromResultado(r);
        if (m == null) return true;
        return m === selectedMonth;
      });
    }

    // Ações rápidas
    if (viewFilter === 'risk_high') list = list.filter(r => computeRisk(getNota(r)) === 'high');
    if (viewFilter === 'below_7') list = list.filter(r => getNota(r) < 7);
    if (viewFilter === 'approved') list = list.filter(r => getNota(r) >= 7);

    // Ordenação: pior primeiro
    list.sort((a, b) => getNota(a) - getNota(b));
    return list;
  }, [
    resultados,
    turmas,
    selectedTurma,
    selectedDisciplina,
    selectedPeriodo,
    selectedMonth,
    viewFilter,
  ]);

  const summary = useMemo(() => {
    const total = filteredList.length;
    const critico = filteredList.filter(r => computeRisk(getNota(r)) === 'high').length;
    const abaixo7 = filteredList.filter(r => getNota(r) < 7).length;
    const riscoMedio = filteredList.filter(r => computeRisk(getNota(r)) === 'mid').length;

    const status =
      critico > 0 ? 'Prioridade máxima' : abaixo7 > 0 || riscoMedio > 0 ? 'Atenção' : 'Ok';

    return { total, critico, abaixo7, riscoMedio, status };
  }, [filteredList]);

  const buildInterventionText = () => {
    const high = filteredList
      .filter(r => computeRisk(getNota(r)) === 'high')
      .sort((a, b) => getNota(a) - getNota(b));

    const mid = filteredList
      .filter(r => computeRisk(getNota(r)) === 'mid')
      .sort((a, b) => getNota(a) - getNota(b));

    const lines: string[] = [];
    lines.push(`Plano rápido de intervenção`);
    lines.push(`Turma: ${turmaNome}`);
    if (selectedDisciplina.trim()) lines.push(`Disciplina: ${selectedDisciplina.trim()}`);
    if (isNumber(selectedPeriodo)) lines.push(`Período: ${selectedPeriodo}`);
    lines.push(`Mês: ${String(selectedMonth).padStart(2, '0')}`);
    lines.push(``);
    lines.push(`Crítico (nota < 5): ${high.length}`);
    high.forEach((r, i) => lines.push(`${i + 1}. ${r.nome} — nota ${getNota(r).toFixed(1)}`));
    lines.push(``);
    lines.push(`Risco médio (5 a 6,9): ${mid.length}`);
    mid.forEach((r, i) => lines.push(`${i + 1}. ${r.nome} — nota ${getNota(r).toFixed(1)}`));
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
    setSelectedPeriodo(null);
    setSelectedMonth(new Date().getMonth() + 1);
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
            <select value={selectedDisciplina} onChange={e => setSelectedDisciplina(e.target.value)}>
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
              value={selectedPeriodo ?? ''}
              onChange={e => setSelectedPeriodo(e.target.value === '' ? null : Number(e.target.value))}
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
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
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

        <div className={`status-strip ${summary.critico > 0 ? 'critical' : summary.abaixo7 > 0 ? 'warn' : 'ok'}`}>
          <div className="status-left">
            <span className="status-title">{summary.critico > 0 ? 'Crítico' : summary.abaixo7 > 0 ? 'Atenção' : 'Ok'}</span>
            <span className="status-sub">{summary.status} • Total {summary.total}</span>
          </div>

          <div className="status-right">
            <span className="pill danger">Abaixo de 7: {summary.abaixo7}</span>
            <span className="pill mid">Risco médio: {summary.riscoMedio}</span>
            <span className="pill high">Crítico: {summary.critico}</span>
          </div>
        </div>

        <div className="report-table-wrap">
          <div className="report-table">
            <div className="rt-head">
              <div className="rt-col name">Aluno</div>
              <div className="rt-col nota">Nota</div>
              <div className="rt-col risk">Status</div>
            </div>

            {loading ? (
              <div className="rt-empty">Carregando...</div>
            ) : filteredList.length === 0 ? (
              <div className="rt-empty">Sem dados para os filtros atuais.</div>
            ) : (
              filteredList.map((r, idx) => {
                const nota = getNota(r);
                const risk = computeRisk(nota);

                return (
                  <div key={r.id ?? `${r.nome}-${idx}`} className={`rt-row ${risk}`}>
                    <div className="rt-col name" title={r.nome}>{r.nome}</div>
                    <div className="rt-col nota">{nota.toFixed(1)}</div>
                    <div className="rt-col risk">
                      {risk === 'high' ? 'Crítico (<5)' : risk === 'mid' ? 'Atenção (5–6,9)' : 'Aprovado (≥7)'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
};