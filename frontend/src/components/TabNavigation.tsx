import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, ClipboardList, TrendingUp } from 'lucide-react';
import './TabNavigation.css';

export const TabNavigation: React.FC = () => {
    const location = useLocation();

    const tabs = [
        { id: 'home', path: '/dashboard', icon: Home, label: 'Início' },
        { id: 'turmas', path: '/dashboard/turmas', icon: Users, label: 'Turmas' },
        { id: 'gabarito', path: '/dashboard/gabarito', icon: ClipboardList, label: 'Gabarito' },
        { id: 'relatorios', path: '/dashboard/relatorios', icon: TrendingUp, label: 'Relatórios' },
    ];

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <nav className="tab-navigation">
            <div className="tab-container">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = isActive(tab.path);

                    return (
                        <Link
                            key={tab.id}
                            to={tab.path}
                            className={`tab-item ${active ? 'tab-item-active' : ''}`}
                        >
                            <Icon size={22} color={active ? '#3b82f6' : '#475569'} />
                            <span className={`tab-label ${active ? 'tab-label-active' : ''}`}>
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

