// Olive Baby API - Date Helpers
import { 
  startOfDay, 
  endOfDay, 
  subDays, 
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  format,
  parseISO,
  isAfter,
  isBefore,
  isValid
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function getDateRange(days: number): { start: Date; end: Date } {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(new Date(), days - 1));
  return { start, end };
}

export function get24hRange(): { start: Date; end: Date } {
  const end = new Date();
  const start = subDays(end, 1);
  return { start, end };
}

export function calculateDurationSeconds(startTime: Date, endTime: Date): number {
  return differenceInSeconds(endTime, startTime);
}

export function calculateDurationMinutes(startTime: Date, endTime: Date): number {
  return differenceInMinutes(endTime, startTime);
}

export function calculateDurationHours(startTime: Date, endTime: Date): number {
  return differenceInHours(endTime, startTime);
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  if (minutes > 0) {
    return `${minutes}min ${secs}s`;
  }
  return `${secs}s`;
}

export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm', { locale: ptBR });
}

export function isValidDate(date: unknown): boolean {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date as string);
  return isValid(d);
}

export function isFutureDate(date: Date): boolean {
  return isAfter(date, new Date());
}

export function isPastDate(date: Date): boolean {
  return isBefore(date, new Date());
}
