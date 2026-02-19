import React from 'react';
import './StepList.css';
import { CheckCircle2 } from 'lucide-react';

export interface StepItem {
    id: number;
    title: string;
    date: string;
    status: 'done' | 'current' | 'future';
}

interface StepListProps {
    items: StepItem[];
}

export const StepList: React.FC<StepListProps> = ({ items }) => {
    const formatDisplayDate = (dateStr: string) => {
        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(dt);
        } catch (e) {
            return '--/--';
        }
    };

    return (
        <div id="stepList">
            {items.map((item) => (
                <div key={item.id} className={`step-item ${item.status}`}>
                    <div className="step-point-container">
                        <div className="step-line" />
                        <div className="step-point">
                            {item.status === 'done' && <CheckCircle2 size={12} />}
                        </div>
                    </div>
                    <div className="step-content">
                        <div className="step-header">
                            {item.status === 'done' && <span className="step-badge done">✔ {formatDisplayDate(item.date)}</span>}
                            {item.status === 'current' && <span className="step-badge current">HOJE</span>}
                            {item.status === 'future' && <span className="step-badge future">Próxima: {formatDisplayDate(item.date)}</span>}
                        </div>
                        <div className="step-title">{item.title}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};
