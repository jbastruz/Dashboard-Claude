import { formatDistanceToNow, format } from "date-fns";
import { fr as frLocale } from "date-fns/locale/fr";

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: frLocale });
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), "HH:mm:ss", { locale: frLocale });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd/MM HH:mm", { locale: frLocale });
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
