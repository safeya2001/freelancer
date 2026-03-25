import { useState, useEffect } from 'react';
import { notificationsApi } from '@/services/api';
import { Notification } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) load();
    const interval = setInterval(() => { if (isAuthenticated) load(); }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  async function load() {
    try {
      const res = await notificationsApi.list();
      setNotifications(res.data.data.notifications);
      setUnreadCount(res.data.data.unread_count);
    } catch {}
  }

  async function markRead(id: string) {
    await notificationsApi.markRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  return { notifications, unreadCount, markRead, markAllRead, reload: load };
}
