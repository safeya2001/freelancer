import { formatDistanceToNow, format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export function timeAgo(date: string, locale = 'ar'): string {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: locale === 'ar' ? ar : enUS,
  });
}

export function formatDate(date: string, locale = 'ar'): string {
  return format(new Date(date), 'PP', { locale: locale === 'ar' ? ar : enUS });
}

export function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
