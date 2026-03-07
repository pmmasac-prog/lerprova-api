import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Pin, Clock, Bookmark } from 'lucide-react';
import { api } from '../services/api';

interface EventData {
  id: number;
  title: string;
  date: string;
  type: 'holiday' | 'exam' | 'administrative' | 'activity';
  description: string;
}

export const AcademicCalendar: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 0, 1)); // Janeiro de 2026
  const [calendarEvents, setCalendarEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMasterCalendar()
      .then(data => {
        if (data && data.events) setCalendarEvents(data.events);
      })
      .catch(err => console.error("Erro ao carregar calendário:", err))
      .finally(() => setLoading(false));
  }, []);

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const renderDays = () => {
    const totalDays = daysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const firstDay = firstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const days = [];

    // Preenchendo com dias vazios para começar o mês no dia da semana correto
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ height: '80px', borderBottom: '1px solid #1e293b' }}></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `2026-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasEvents = calendarEvents.filter(e => e.date === dateStr);

      days.push(
        <div key={d} style={{ height: '80px', borderBottom: '1px solid #1e293b', borderRight: '1px solid #1e293b', padding: '10px', position: 'relative' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8' }}>{d}</span>
          <div style={{ marginTop: '5px' }}>
            {hasEvents.map(e => (
              <div 
                key={e.id} 
                style={{ 
                  fontSize: '0.6rem', 
                  padding: '2px 5px', 
                  borderRadius: '4px', 
                  background: e.type === 'holiday' ? '#ef4444' : e.type === 'administrative' ? 'var(--admin-gold)' : '#3b82f6',
                  color: '#fff',
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={e.description}
              >
                {e.title}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <h1 className="admin-title">Calendário Acadêmico 2026</h1>
          <p className="admin-subtitle">Organização de datas, feriados e períodos avaliativos.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Pin size={18} /> Fixar Datas
          </button>
          <button className="btn-emerald" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Bookmark size={18} /> Novo Evento
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginTop: '20px' }}>
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="admin-card-title">
              {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
            </h3>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button 
                className="btn-icon" 
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                className="btn-icon"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '10px' }}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <span key={d} style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold' }}>{d}</span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid #1e293b', borderLeft: '1px solid #1e293b' }}>
            {renderDays()}
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Clock size={18} color="var(--admin-gold)" /> Próximas Datas
          </h3>
          <div style={{ marginTop: '15px' }}>
            {calendarEvents.map(e => (
              <div key={e.id} style={{ paddingBottom: '15px', borderBottom: '1px solid #1e293b', marginBottom: '15px' }}>
                <p style={{ color: '#60a5fa', fontSize: '0.75rem', fontWeight: 'bold' }}>{new Date(e.date).toLocaleDateString()}</p>
                <p style={{ color: '#f3f4f6', fontSize: '0.9rem', fontWeight: '600' }}>{e.title}</p>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{e.description}</p>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: '20px', padding: '15px', background: '#1e293b', borderRadius: '12px' }}>
            <h4 style={{ color: '#ca8a04', fontSize: '0.85rem', marginBottom: '10px' }}>Bimestres 2026</h4>
            <ul style={{ color: '#94a3b8', fontSize: '0.8rem', paddingLeft: '15px', lineHeight: '1.8' }}>
              <li><b>1º Bim</b>: 15 Jan - 15 Abr</li>
              <li><b>2º Bim</b>: 16 Abr - 15 Jul</li>
              <li><b>3º Bim</b>: 16 Jul - 15 Set</li>
              <li><b>4º Bim</b>: 16 Set - 15 Dez</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
