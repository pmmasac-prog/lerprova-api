import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  schoolDays: number;
  workloadHours: number;
}

interface Event {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  type: string;
  description?: string;
}

const PERIODS: Period[] = [
  {
    id: 'p1',
    name: '1º Período',
    startDate: '2026-02-09',
    endDate: '2026-04-24',
    schoolDays: 50,
    workloadHours: 300
  },
  {
    id: 'p2',
    name: '2º Período',
    startDate: '2026-04-27',
    endDate: '2026-07-31',
    schoolDays: 50,
    workloadHours: 294
  },
  {
    id: 'p3',
    name: '3º Período',
    startDate: '2026-08-03',
    endDate: '2026-10-13',
    schoolDays: 50,
    workloadHours: 300
  },
  {
    id: 'p4',
    name: '4º Período',
    startDate: '2026-10-14',
    endDate: '2026-12-30',
    schoolDays: 51,
    workloadHours: 306
  }
];

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

export const AcademicCalendar: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [visiblePeriods, setVisiblePeriods] = useState<Set<string>>(new Set(PERIODS.map(p => p.id)));
  const [expandedPeriod, setExpandedPeriod] = useState<string>('p1');

  useEffect(() => {
    api.getMasterCalendar()
      .then(data => {
        if (data && data.events) {
          setEvents(data.events);
        }
      })
      .catch(err => console.error("Erro ao carregar calendário:", err))
      .finally(() => setLoading(false));
  }, []);

  const getEventsByPeriod = (periodId: string) => {
    const period = PERIODS.find(p => p.id === periodId);
    if (!period) return [];
    
    return events.filter(e => {
      const eStart = new Date(e.startDate);
      const eEnd = new Date(e.endDate);
      const pStart = new Date(period.startDate);
      const pEnd = new Date(period.endDate);
      return eStart <= pEnd && eEnd >= pStart;
    }).filter(e => !filterType || e.type === filterType);
  };

  const handleDeleteEvent = (id: number) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const togglePeriodVisibility = (periodId: string) => {
    const newVisiblePeriods = new Set(visiblePeriods);
    if (newVisiblePeriods.has(periodId)) {
      newVisiblePeriods.delete(periodId);
    } else {
      newVisiblePeriods.add(periodId);
    }
    setVisiblePeriods(newVisiblePeriods);
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

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <h1 className="admin-title" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Calendar size={28} color="var(--admin-gold)" />
            Calendário Acadêmico 2026
          </h1>
          <p className="admin-subtitle">Planejamento completo do ano letivo com eventos, períodos e marcos importantes.</p>
        </div>
        <button className="btn-emerald" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Plus size={18} /> Novo Evento
        </button>
      </header>

      {/* FILTROS */}
      <div className="admin-card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>Filtrar por tipo:</label>
          
          <button
            onClick={() => setFilterType('')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: !filterType ? '2px solid #3b82f6' : '1px solid #374151',
              background: !filterType ? '#1e40af' : '#0f172a',
              color: '#f3f4f6',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Todos
          </button>

          {Object.entries(EVENT_TYPES).map(([key, { label, emoji, color }]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: filterType === key ? `2px solid ${color}` : '1px solid #374151',
                background: filterType === key ? '#1e293b' : '#0f172a',
                color: filterType === key ? color : '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: filterType === key ? 'bold' : 'normal'
              }}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>

      {/* BIMESTRES - CARDS EXPANSÍVEIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {PERIODS.map(period => {
          const periodEvents = getEventsByPeriod(period.id);
          const isVisible = visiblePeriods.has(period.id);
          const isExpanded = expandedPeriod === period.id;

          const today = new Date();
          const periodStart = new Date(period.startDate);
          const periodEnd = new Date(period.endDate);
          const isCurrent = today >= periodStart && today <= periodEnd;

          return (
            <div 
              key={period.id}
              className="admin-card"
              style={{
                borderLeft: `4px solid ${isCurrent ? 'var(--admin-emerald)' : 'var(--admin-gold)'}`,
                background: isCurrent ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 1) 100%)' : undefined,
                boxShadow: isCurrent ? '0 0 20px rgba(16, 185, 129, 0.15)' : undefined
              }}
            >
              {/* HEADER DO BIMESTRE */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <h3 className="admin-card-title" style={{ margin: 0, fontSize: '1.1rem', color: isCurrent ? '#10b981' : 'var(--admin-gold)' }}>
                      {period.name}
                    </h3>
                    {isCurrent && <span style={{ background: '#10b981', color: '#0f172a', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>ATUAL</span>}
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '5px 0 0 0' }}>
                    {new Date(period.startDate).toLocaleDateString('pt-BR')} →{' '}
                    {new Date(period.endDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={() => togglePeriodVisibility(period.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8'
                  }}
                >
                  {isVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>

              {/* STATS DO BIMESTRE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px', background: '#0f172a', borderRadius: '8px', marginTop: '12px', marginBottom: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Dias Letivos</p>
                  <p style={{ color: '#10b981', fontSize: '1.2rem', fontWeight: 'bold' }}>{period.schoolDays}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Horas Aula</p>
                  <p style={{ color: '#3b82f6', fontSize: '1.2rem', fontWeight: 'bold' }}>{period.workloadHours}h</p>
                </div>
              </div>

              {/* BOTÃO EXPANDIR/RETRAIR */}
              <button
                onClick={() => setExpandedPeriod(isExpanded ? '' : period.id)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'transparent',
                  border: '1px solid #374151',
                  color: '#94a3b8',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  marginBottom: '12px'
                }}
              >
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                {periodEvents.length} eventos
              </button>

              {/* EVENTOS DO BIMESTRE */}
              {isVisible && isExpanded ? (
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {periodEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#4b5563' }}>
                      <p style={{ fontSize: '0.9rem' }}>Nenhum evento neste período</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {periodEvents.map(event => {
                        const eventType = EVENT_TYPES[event.type as keyof typeof EVENT_TYPES] || { label: 'Outro', emoji: '📌', color: '#94a3b8', bgColor: '#1e293b' };
                        return (
                          <div
                            key={event.id}
                            style={{
                              padding: '12px',
                              borderRadius: '8px',
                              background: eventType.bgColor,
                              border: `1px solid ${eventType.color}`,
                              position: 'relative'
                            }}
                            className="event-card"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ color: eventType.color, fontSize: '0.75rem', fontWeight: 'bold', margin: '0 0 3px 0' }}>
                                  {eventType.emoji} {eventType.label}
                                </p>
                                <p style={{ color: '#f3f4f6', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>
                                  {event.title}
                                </p>
                                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '3px 0 0 0' }}>
                                  {new Date(event.startDate).toLocaleDateString('pt-BR')}
                                  {event.endDate !== event.startDate && ` - ${new Date(event.endDate).toLocaleDateString('pt-BR')}`}
                                </p>
                                {event.description && (
                                  <p style={{ color: '#cbd5e1', fontSize: '0.8rem', margin: '5px 0 0 0', fontStyle: 'italic' }}>
                                    {event.description}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                style={{
                                  padding: '4px 8px',
                                  background: 'transparent',
                                  border: '1px solid #ef4444',
                                  color: '#ef4444',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.75rem'
                                }}
                              >
                                <Trash2 size={14} /> Deletar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* RESUMO GERAL */}
      <div className="admin-card" style={{ marginTop: '20px', background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', border: '1px solid var(--admin-emerald)' }}>
        <h3 className="admin-card-title" style={{ color: 'var(--admin-gold)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          📊 Resumo do Ano Letivo 2026
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginTop: '15px' }}>
          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid #10b981' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Dias Letivos</p>
            <p style={{ color: '#10b981', fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>
              {PERIODS.reduce((sum, p) => sum + p.schoolDays, 0)}
            </p>
          </div>
          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid #3b82f6' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Horas Aula</p>
            <p style={{ color: '#3b82f6', fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>
              {PERIODS.reduce((sum, p) => sum + p.workloadHours, 0)}h
            </p>
          </div>
          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', border: '1px solid #a855f7' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Eventos</p>
            <p style={{ color: '#a855f7', fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>
              {events.length}
            </p>
          </div>
          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(251, 146, 60, 0.1)', borderRadius: '8px', border: '1px solid #fb923c' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Bimestres</p>
            <p style={{ color: '#fb923c', fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>
              4
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
