import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, List, Grid } from 'lucide-react';
import { api } from '../services/api';

interface Period {
  id: string;
  name: string;
  number: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  type: string;
  description?: string;
  is_school_day?: boolean;
}

const EVENT_TYPES: Record<string, { label: string; emoji: string; color: string; bgColor: string }> = {
  'holiday': { label: 'Feriado', emoji: '🏖️', color: '#ef4444', bgColor: '#7f1d1d' },
  'planning': { label: 'Planejamento', emoji: '📋', color: '#f59e0b', bgColor: '#78350f' },
  'meeting': { label: 'Reunião', emoji: '👥', color: '#8b5cf6', bgColor: '#4c1d95' },
  'administrative': { label: 'Administrativo', emoji: '⚙️', color: '#ec4899', bgColor: '#831843' },
  'vacation': { label: 'Férias', emoji: '✈️', color: '#06b6d4', bgColor: '#164e63' },
  'assessment': { label: 'SEAMA - Diagnóstica', emoji: '🧪', color: '#f97316', bgColor: '#7c2d12' },
  'assessment_other': { label: 'Avaliação', emoji: '📝', color: '#3b82f6', bgColor: '#1e3a8a' },
  'pending_test': { label: 'Testes de Pendência', emoji: '⏳', color: '#a78bfa', bgColor: '#4c1d95' },
  'term_milestone': { label: 'Marco Acadêmico', emoji: '🎯', color: '#10b981', bgColor: '#064e3b' },
  'commemorative': { label: 'Comemorativo', emoji: '🎉', color: '#8b5cf6', bgColor: '#4c1d95' },
  'make_up_class': { label: 'Reposição', emoji: '🔄', color: '#6366f1', bgColor: '#312e81' }
};

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const AcademicCalendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [expandedPeriod, setExpandedPeriod] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'month'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const loadData = async () => {
      try {
        const [calRes, periodRes] = await Promise.all([
          api.calendar.getEvents().catch(() => api.getMasterCalendar()),
          api.calendar.getPeriods().catch(() => null),
        ]);

        if (calRes?.data) {
          setEvents(calRes.data.map((e: any) => ({
            id: e.id, title: e.title, type: e.type || e.event_type_id,
            start_date: e.start_date || e.startDate,
            end_date: e.end_date || e.endDate,
            description: e.description, is_school_day: e.is_school_day,
          })));
        } else if (calRes?.events) {
          setEvents(calRes.events.map((e: any) => ({
            id: e.id, title: e.title, type: e.type,
            start_date: e.startDate || e.start_date,
            end_date: e.endDate || e.end_date,
            description: e.description,
          })));
        }

        if (periodRes?.data) {
          setPeriods(periodRes.data);
        }
      } catch (err) {
        console.error("Erro ao carregar calendário:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Detect first period if none expanded
  useEffect(() => {
    if (periods.length > 0 && !expandedPeriod) {
      const today = new Date().toISOString().split('T')[0];
      const current = periods.find(p => p.start_date <= today && p.end_date >= today);
      setExpandedPeriod(current?.id || periods[0].id);
    }
  }, [periods, expandedPeriod]);

  const filteredEvents = useMemo(() =>
    filterType ? events.filter(e => e.type === filterType) : events
  , [events, filterType]);

  const getEventsByPeriod = (period: Period) => {
    return filteredEvents.filter(e => {
      return e.start_date <= period.end_date && e.end_date >= period.start_date;
    });
  };

  // Month grid helpers
  const getMonthDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  };

  const getEventsForDate = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredEvents.filter(e => e.start_date <= dateStr && e.end_date >= dateStr);
  };

  const navigateMonth = (dir: number) => {
    let m = currentMonth + dir;
    let y = currentYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCurrentMonth(m);
    setCurrentYear(y);
  };

  if (loading) {
    return (
      <div className="admin-container">
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <Calendar size={40} style={{ marginBottom: '20px', opacity: 0.5 }} />
          <p>Carregando calendário acadêmico...</p>
        </div>
      </div>
    );
  }

  const days = getMonthDays(currentYear, currentMonth);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <h1 className="admin-title" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Calendar size={28} color="var(--admin-gold)" />
            Calendário Acadêmico {currentYear}
          </h1>
          <p className="admin-subtitle">{events.length} eventos · {periods.length} períodos letivos</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('month')}
            style={{
              padding: '8px 14px', borderRadius: '6px', cursor: 'pointer',
              background: viewMode === 'month' ? '#1e40af' : '#0f172a',
              border: viewMode === 'month' ? '2px solid #3b82f6' : '1px solid #374151',
              color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Grid size={16} /> Mês
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '8px 14px', borderRadius: '6px', cursor: 'pointer',
              background: viewMode === 'list' ? '#1e40af' : '#0f172a',
              border: viewMode === 'list' ? '2px solid #3b82f6' : '1px solid #374151',
              color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <List size={16} /> Períodos
          </button>
        </div>
      </header>

      {/* FILTROS */}
      <div className="admin-card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>Filtrar:</label>
          <button
            onClick={() => setFilterType('')}
            style={{
              padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
              border: !filterType ? '2px solid #3b82f6' : '1px solid #374151',
              background: !filterType ? '#1e40af' : '#0f172a', color: '#f3f4f6',
            }}
          >
            Todos ({events.length})
          </button>
          {Object.entries(EVENT_TYPES).map(([key, { label, emoji, color }]) => {
            const count = events.filter(e => e.type === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
                  border: filterType === key ? `2px solid ${color}` : '1px solid #374151',
                  background: filterType === key ? '#1e293b' : '#0f172a',
                  color: filterType === key ? color : '#94a3b8',
                  fontWeight: filterType === key ? 'bold' : 'normal'
                }}
              >
                {emoji} {label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== MONTH VIEW ========== */}
      {viewMode === 'month' && (
        <div className="admin-card" style={{ marginTop: '20px' }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => navigateMonth(-1)} style={{ background: 'transparent', border: '1px solid #374151', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
              <ChevronLeft size={18} />
            </button>
            <h2 style={{ color: '#f1f5f9', fontSize: '1.2rem', fontWeight: 'bold' }}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <button onClick={() => navigateMonth(1)} style={{ background: 'transparent', border: '1px solid #374151', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {WEEKDAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', fontWeight: 'bold', padding: '6px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {days.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} style={{ minHeight: '80px' }} />;

              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = getEventsForDate(currentYear, currentMonth, day);
              const isToday = dateStr === todayStr;
              const isWeekend = new Date(currentYear, currentMonth, day).getDay() % 6 === 0;

              return (
                <div
                  key={day}
                  style={{
                    minHeight: '80px',
                    padding: '4px',
                    background: isToday ? 'rgba(16, 185, 129, 0.15)' : isWeekend ? 'rgba(100,116,139,0.05)' : '#0f172a',
                    border: isToday ? '2px solid #10b981' : '1px solid #1e293b',
                    borderRadius: '6px',
                    position: 'relative',
                  }}
                >
                  <span style={{
                    fontSize: '0.8rem', fontWeight: isToday ? 'bold' : 'normal',
                    color: isToday ? '#10b981' : isWeekend ? '#475569' : '#94a3b8',
                  }}>
                    {day}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                    {dayEvents.slice(0, 3).map(ev => {
                      const et = EVENT_TYPES[ev.type] || { emoji: '📌', color: '#94a3b8', label: '' };
                      return (
                        <div
                          key={ev.id}
                          title={`${et.label}: ${ev.title}`}
                          style={{
                            fontSize: '0.6rem',
                            padding: '1px 3px',
                            borderRadius: '3px',
                            background: `${et.color}22`,
                            color: et.color,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            cursor: 'default',
                          }}
                        >
                          {et.emoji} {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: '0.55rem', color: '#64748b' }}>+{dayEvents.length - 3} mais</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== LIST VIEW (por período) ========== */}
      {viewMode === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginTop: '20px' }}>
          {periods.map(period => {
            const periodEvents = getEventsByPeriod(period);
            const isExpanded = expandedPeriod === period.id;
            const isCurrent = period.start_date <= todayStr && period.end_date >= todayStr;

            return (
              <div
                key={period.id}
                className="admin-card"
                style={{
                  borderLeft: `4px solid ${isCurrent ? 'var(--admin-emerald)' : 'var(--admin-gold)'}`,
                  background: isCurrent ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 1) 100%)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <h3 className="admin-card-title" style={{ margin: 0, fontSize: '1.1rem', color: isCurrent ? '#10b981' : 'var(--admin-gold)' }}>
                        {period.name}
                      </h3>
                      {isCurrent && <span style={{ background: '#10b981', color: '#0f172a', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>ATUAL</span>}
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '5px 0 0 0' }}>
                      {new Date(period.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(period.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setExpandedPeriod(isExpanded ? '' : period.id)}
                  style={{
                    width: '100%', padding: '10px', background: 'transparent',
                    border: '1px solid #374151', color: '#94a3b8', borderRadius: '6px',
                    cursor: 'pointer', display: 'flex', justifyContent: 'center',
                    alignItems: 'center', gap: '8px', fontSize: '0.9rem', marginTop: '12px',
                  }}
                >
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  {periodEvents.length} eventos
                </button>

                {isExpanded && (
                  <div style={{ maxHeight: '600px', overflowY: 'auto', marginTop: '12px' }}>
                    {periodEvents.length === 0 ? (
                      <p style={{ textAlign: 'center', padding: '20px', color: '#4b5563', fontSize: '0.9rem' }}>Nenhum evento neste período</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {periodEvents.map(event => {
                          const et = EVENT_TYPES[event.type] || { label: 'Outro', emoji: '📌', color: '#94a3b8', bgColor: '#1e293b' };
                          return (
                            <div
                              key={event.id}
                              style={{ padding: '12px', borderRadius: '8px', background: et.bgColor, border: `1px solid ${et.color}` }}
                            >
                              <p style={{ color: et.color, fontSize: '0.75rem', fontWeight: 'bold', margin: '0 0 3px 0' }}>
                                {et.emoji} {et.label}
                              </p>
                              <p style={{ color: '#f3f4f6', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>{event.title}</p>
                              <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '3px 0 0 0' }}>
                                {new Date(event.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                {event.end_date !== event.start_date && ` - ${new Date(event.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                              </p>
                              {event.description && (
                                <p style={{ color: '#cbd5e1', fontSize: '0.8rem', margin: '5px 0 0 0', fontStyle: 'italic' }}>{event.description}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* RESUMO GERAL */}
      <div className="admin-card" style={{ marginTop: '20px', background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', border: '1px solid var(--admin-emerald)' }}>
        <h3 className="admin-card-title" style={{ color: 'var(--admin-gold)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          📊 Resumo do Ano Letivo {currentYear}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginTop: '15px' }}>
          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid #10b981' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Períodos</p>
            <p style={{ color: '#10b981', fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>{periods.length}</p>
          </div>
          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', border: '1px solid #a855f7' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Eventos</p>
            <p style={{ color: '#a855f7', fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>{events.length}</p>
          </div>
          {Object.entries(EVENT_TYPES).map(([key, { label, emoji, color }]) => {
            const count = events.filter(e => e.type === key).length;
            if (count === 0) return null;
            return (
              <div key={key} style={{ textAlign: 'center', padding: '15px', background: `${color}11`, borderRadius: '8px', border: `1px solid ${color}` }}>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{emoji} {label}</p>
                <p style={{ color, fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>{count}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
