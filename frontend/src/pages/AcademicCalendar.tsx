import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, List, Grid, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { api } from '../services/api';
import './AcademicCalendar.css';

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

const EVENT_TYPES: Record<string, { label: string; emoji: string; className: string }> = {
  'holiday': { label: 'Feriado', emoji: '🏖️', className: 'event-holiday' },
  'planning': { label: 'Planejamento', emoji: '📋', className: 'event-planning' },
  'meeting': { label: 'Reunião', emoji: '👥', className: 'event-meeting' },
  'administrative': { label: 'Administrativo', emoji: '⚙️', className: 'event-administrative' },
  'vacation': { label: 'Férias', emoji: '✈️', className: 'event-vacation' },
  'assessment': { label: 'SEAMA - Diagnóstica', emoji: '🧪', className: 'event-assessment' },
  'assessment_other': { label: 'Avaliação', emoji: '📝', className: 'event-assessment_other' },
  'pending_test': { label: 'Testes de Pendência', emoji: '⏳', className: 'event-meeting' },
  'term_milestone': { label: 'Marco Acadêmico', emoji: '🎯', className: 'event-term_milestone' },
  'commemorative': { label: 'Comemorativo', emoji: '🎉', className: 'event-meeting' },
  'make_up_class': { label: 'Reposição', emoji: '🔄', className: 'event-assessment_other' }
};

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const AcademicCalendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPeriod, setExpandedPeriod] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'month'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // CRUD state
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CalendarEvent | null>(null);
  const emptyForm = { title: '', event_type_id: 'holiday', start_date: '', end_date: '', description: '', is_school_day: false };
  const [formData, setFormData] = useState(emptyForm);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadEvents = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Detect first period if none expanded
  useEffect(() => {
    if (periods.length > 0 && !expandedPeriod) {
      const today = new Date().toISOString().split('T')[0];
      const current = periods.find(p => p.start_date <= today && p.end_date >= today);
      setExpandedPeriod(current?.id || periods[0].id);
    }
  }, [periods, expandedPeriod]);

  const getEventsByPeriod = (period: Period) => {
    return events.filter(e => {
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
    return events.filter(e => e.start_date <= dateStr && e.end_date >= dateStr);
  };

  const openCreate = () => {
    setEditingEvent(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setFormData({
      title: ev.title,
      event_type_id: ev.type,
      start_date: ev.start_date,
      end_date: ev.end_date,
      description: ev.description || '',
      is_school_day: ev.is_school_day || false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.start_date || !formData.end_date) return;
    setSaving(true);
    try {
      if (editingEvent) {
        await api.calendar.updateEvent(editingEvent.id, formData);
        showToast('Evento atualizado com sucesso!');
      } else {
        await api.calendar.createEvent(formData);
        showToast('Evento criado com sucesso!');
      }
      setShowModal(false);
      await loadEvents();
    } catch {
      showToast('Erro ao salvar evento.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev: CalendarEvent) => {
    try {
      await api.calendar.deleteEvent(ev.id);
      setDeleteConfirm(null);
      showToast('Evento removido com sucesso!');
      await loadEvents();
    } catch {
      showToast('Erro ao remover evento.', 'error');
    }
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
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
            onClick={openCreate}
            style={{
              padding: '8px 14px', borderRadius: '6px', cursor: 'pointer',
              background: 'var(--color-success)', border: 'none',
              color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold'
            }}
          >
            <Plus size={16} /> Novo Evento
          </button>
          <button
            onClick={() => setViewMode('month')}
            style={{
              padding: '8px 14px', borderRadius: '6px', cursor: 'pointer',
              background: viewMode === 'month' ? '#1e40af' : 'var(--bg-primary)',
              border: viewMode === 'month' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
              color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Grid size={16} /> Mês
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '8px 14px', borderRadius: '6px', cursor: 'pointer',
              background: viewMode === 'list' ? '#1e40af' : 'var(--bg-primary)',
              border: viewMode === 'list' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
              color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <List size={16} /> Períodos
          </button>
        </div>
      </header>

      {/* ========== MONTH VIEW ========== */}
      {viewMode === 'month' && (
        <div className="admin-card" style={{ marginTop: '20px' }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => navigateMonth(-1)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--color-text-muted)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
              <ChevronLeft size={18} />
            </button>
            <h2 style={{ color: 'var(--color-text)', fontSize: '1.2rem', fontWeight: 'bold' }}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <button onClick={() => navigateMonth(1)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--color-text-muted)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {WEEKDAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 'bold', padding: '6px 0' }}>
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
                    background: isToday ? 'rgba(16, 185, 129, 0.15)' : isWeekend ? 'rgba(100,116,139,0.05)' : 'var(--bg-primary)',
                    border: isToday ? '2px solid var(--color-success)' : '1px solid var(--border-color)',
                    borderRadius: '6px',
                    position: 'relative',
                  }}
                >
                  <span style={{
                    fontSize: '0.8rem', fontWeight: isToday ? 'bold' : 'normal',
                    color: isToday ? 'var(--color-success)' : isWeekend ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                  }}>
                    {day}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                    {dayEvents.slice(0, 3).map(ev => {
                      const et = EVENT_TYPES[ev.type] || { emoji: '📌', className: '', label: '' };
                      return (
                        <div
                          key={ev.id}
                          title={`${et.label}: ${ev.title}`}
                          onClick={() => openEdit(ev)}
                          className={`calendar-event ${et.className}`}
                        >
                          {et.emoji} {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)' }}>+{dayEvents.length - 3} mais</span>
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
                      <h3 className="admin-card-title" style={{ margin: 0, fontSize: '1.1rem', color: isCurrent ? 'var(--color-success)' : 'var(--admin-gold)' }}>
                        {period.name}
                      </h3>
                      {isCurrent && <span style={{ background: 'var(--color-success)', color: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>ATUAL</span>}
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '5px 0 0 0' }}>
                      {new Date(period.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(period.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setExpandedPeriod(isExpanded ? '' : period.id)}
                  style={{
                    width: '100%', padding: '10px', background: 'transparent',
                    border: '1px solid var(--border-color)', color: 'var(--color-text-muted)', borderRadius: '6px',
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
                      <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Nenhum evento neste período</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {periodEvents.map(event => {
                          const et = EVENT_TYPES[event.type] || { label: 'Outro', emoji: '📌', className: 'event-assessment_other' };
                          return (
                            <div
                              key={event.id}
                              className={`period-event-card ${et.className}`}
                            >
                              <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                                <button onClick={() => openEdit(event)} title="Editar" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'inherit', padding: '4px', borderRadius: '4px', cursor: 'pointer', opacity: 0.7 }}>
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => setDeleteConfirm(event)} title="Remover" style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: 'var(--color-danger)', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <p style={{ color: 'inherit', fontSize: '0.75rem', fontWeight: 'bold', margin: '0 0 3px 0' }}>
                                {et.emoji} {et.label}
                              </p>
                              <p style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: '700', margin: 0 }}>{event.title}</p>
                              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '3px 0 0 0' }}>
                                {new Date(event.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                {event.end_date !== event.start_date && ` - ${new Date(event.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                              </p>
                              {event.description && (
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: '8px 0 0 0', fontStyle: 'italic', borderTop: '1px solid currentColor', paddingTop: '8px', opacity: 0.8 }}>{event.description}</p>
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
      <div className="admin-card" style={{ marginTop: '20px', background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)', border: '1px solid var(--admin-emerald)' }}>
        <h3 className="admin-card-title" style={{ color: 'var(--admin-gold)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          📊 Resumo do Ano Letivo {currentYear}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginTop: '15px' }}>
          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid var(--color-success)' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Períodos</p>
            <p style={{ color: 'var(--color-success)', fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>{periods.length}</p>
          </div>
          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', border: '1px solid var(--color-purple)' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Total de Eventos</p>
            <p style={{ color: 'var(--color-purple)', fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>{events.length}</p>
          </div>
          {Object.entries(EVENT_TYPES).map(([key, { label, emoji }]) => {
            const count = events.filter(e => e.type === key).length;
            if (count === 0) return null;
            // Fallback colors for summary cards
            const colors: Record<string, string> = {
              'holiday': 'var(--color-danger)',
              'planning': 'var(--color-warning)',
              'meeting': '#a855f7',
              'term_milestone': 'var(--color-success)',
              'assessment': '#f97316'
            };
            const color = colors[key] || 'var(--color-primary)';
            return (
              <div key={key} style={{ textAlign: 'center', padding: '15px', background: `${color}11`, borderRadius: '8px', border: `1px solid ${color}` }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{emoji} {label}</p>
                <p style={{ color, fontSize: '1.8rem', fontWeight: 'bold', margin: '5px 0 0 0' }}>{count}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== MODAL CRIAR/EDITAR ===== */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--border-color)', borderRadius: '12px', padding: '24px', width: '95%', maxWidth: '500px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'var(--color-text)', margin: 0, fontSize: '1.1rem' }}>
                {editingEvent ? '✏️ Editar Evento' : '➕ Novo Evento'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label htmlFor="ev-title" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Título *</label>
                <input id="ev-title" name="title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--color-text)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  placeholder="Nome do evento" />
              </div>

              <div>
                <label htmlFor="ev-type" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Tipo *</label>
                <select id="ev-type" name="event_type_id" value={formData.event_type_id} onChange={e => setFormData({ ...formData, event_type_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--color-text)', fontSize: '0.9rem', boxSizing: 'border-box' }}>
                  {Object.entries(EVENT_TYPES).map(([key, { label, emoji }]) => (
                    <option key={key} value={key}>{emoji} {label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label htmlFor="ev-start" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Data Início *</label>
                  <input id="ev-start" name="start_date" type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--color-text)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="ev-end" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Data Fim *</label>
                  <input id="ev-end" name="end_date" type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--color-text)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label htmlFor="ev-desc" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Descrição</label>
                <textarea id="ev-desc" name="description" rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--color-text)', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                  placeholder="Descrição opcional" />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.is_school_day} onChange={e => setFormData({ ...formData, is_school_day: e.target.checked })} />
                Dia letivo
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !formData.title || !formData.start_date || !formData.end_date}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: saving ? 'var(--border-color)' : 'var(--color-success)', color: '#fff', fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', gap: '6px', opacity: (!formData.title || !formData.start_date || !formData.end_date) ? 0.5 : 1
                }}>
                <Save size={16} /> {saving ? 'Salvando...' : editingEvent ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CONFIRMAÇÃO DE EXCLUSÃO ===== */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--border-color)', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', border: '1px solid var(--color-danger)', textAlign: 'center' }}>
            <Trash2 size={36} color="var(--color-danger)" style={{ marginBottom: '12px' }} />
            <h3 style={{ color: 'var(--color-text)', margin: '0 0 8px 0' }}>Remover Evento?</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0 0 20px 0' }}>
              <strong style={{ color: 'var(--color-text)' }}>{deleteConfirm.title}</strong><br />
              Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '8px 20px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'var(--color-danger)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TOAST ===== */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem',
          background: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)', color: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};
