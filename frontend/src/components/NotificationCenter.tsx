import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface Notification {
    id: number;
    title: string;
    message: string;
    type: 'info' | 'alert' | 'warning' | 'success';
    is_read: boolean;
    created_at: string;
    action_url?: string | null;
}

const NotificationIcon: React.FC<{ type: string }> = ({ type }) => {
    const icons: Record<string, string> = {
        info: 'ℹ️',
        alert: '🔴',
        warning: '⚠️',
        success: '✅'
    };
    return <span className="text-xl">{icons[type] || 'ℹ️'}</span>;
};

const NotificationBadge: React.FC<{ count: number }> = ({ count }) => {
    if (count === 0) return null;
    
    return (
        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            {count > 99 ? '99+' : count}
        </span>
    );
};

export const NotificationCenter: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const isRead = filter === 'unread' ? false : undefined;
            const data = await api.notifications.getAll(0, 50, typeFilter, isRead);
            setNotifications(data.notifications || []);
            setUnreadCount(data.unread || 0);
            setError(null);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [filter, typeFilter]);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const data = await api.notifications.getUnreadCount();
            setUnreadCount(data.unread_count || 0);
        } catch (err) {
            console.error('Error fetching unread count:', err);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        // Poll para atualizar contador a cada 30 segundos
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications, fetchUnreadCount]);

    const handleMarkAsRead = async (notificationId: number) => {
        try {
            await api.notifications.markAsRead(notificationId);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
            await fetchUnreadCount();
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.is_read) {
            handleMarkAsRead(notification.id);
        }
        if (notification.action_url) {
            window.location.href = notification.action_url;
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread' && n.is_read) return false;
        if (typeFilter && n.type !== typeFilter) return false;
        return true;
    });

    return (
        <div className="w-full max-w-2xl mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Notificações</h1>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        ✕
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            {/* Filtros */}
            <div className="mb-6 flex flex-wrap gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-full transition-colors ${
                        filter === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Todas ({notifications.length})
                </button>
                <button
                    onClick={() => setFilter('unread')}
                    className={`px-4 py-2 rounded-full transition-colors ${
                        filter === 'unread'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Não Lidas ({unreadCount})
                </button>

                {/* Filtro por tipo */}
                <select
                    value={typeFilter || ''}
                    onChange={(e) => setTypeFilter(e.target.value || undefined)}
                    className="px-3 py-2 border border-gray-300 rounded-full hover:border-gray-400"
                >
                    <option value="">Todos os tipos</option>
                    <option value="info">📋 Info</option>
                    <option value="alert">🔴 Alerta</option>
                    <option value="warning">⚠️ Aviso</option>
                    <option value="success">✅ Sucesso</option>
                </select>
            </div>

            {/* Lista de Notificações */}
            {loading ? (
                <div className="text-center py-8 text-gray-500">
                    Carregando notificações...
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-lg">Nenhuma notificação</p>
                    <p className="text-gray-400 text-sm">Você está em dia! 🎉</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredNotifications.map((notification) => (
                        <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`p-4 rounded-lg border-l-4 cursor-pointer transition-colors ${
                                notification.is_read
                                    ? 'bg-gray-50 border-gray-300'
                                    : 'bg-blue-50 border-blue-500 hover:bg-blue-100'
                            } ${notification.action_url ? 'hover:shadow-md' : ''}`}
                        >
                            <div className="flex items-start gap-3">
                                <NotificationIcon type={notification.type} />
                                
                                <div className="flex-1">
                                    <h3 className={`font-semibold ${notification.is_read ? 'text-gray-700' : 'text-blue-900'}`}>
                                        {notification.title}
                                    </h3>
                                    <p className="text-gray-600 text-sm mt-1">
                                        {notification.message}
                                    </p>
                                    <p className="text-gray-400 text-xs mt-2">
                                        {new Date(notification.created_at).toLocaleString('pt-BR')}
                                    </p>
                                </div>

                                {!notification.is_read && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkAsRead(notification.id);
                                        }}
                                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Marcar como lida
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const NotificationBell: React.FC = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                const data = await api.notifications.getUnreadCount();
                setUnreadCount(data.unread_count || 0);
            } catch (err) {
                console.error('Error fetching unread count:', err);
            }
        };

        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="notification-bell-btn"
            >
                🔔
                <NotificationBadge count={unreadCount} />
            </button>

            {showDropdown && (
                <div className="notification-dropdown">
                    <NotificationCenter onClose={() => setShowDropdown(false)} />
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
