// Olive Baby API - Timezone Helpers
// Handles timezone conversions for consistent date/time handling across the app

import { format, parseISO, formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

// Default timezone for Brazil
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// Common Brazilian timezones
export const BRAZILIAN_TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)', offset: -3 },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)', offset: -4 },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)', offset: -4 },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)', offset: -5 },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)', offset: -2 },
];

// All supported timezones
export const SUPPORTED_TIMEZONES = [
  ...BRAZILIAN_TIMEZONES,
  { value: 'America/New_York', label: 'Nova York (EST)', offset: -5 },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)', offset: -8 },
  { value: 'Europe/London', label: 'Londres (GMT)', offset: 0 },
  { value: 'Europe/Lisbon', label: 'Lisboa (WET)', offset: 0 },
  { value: 'Europe/Paris', label: 'Paris (CET)', offset: 1 },
  { value: 'Asia/Tokyo', label: 'Tóquio (JST)', offset: 9 },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)', offset: 11 },
];

/**
 * Validates if a timezone string is valid IANA timezone
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a UTC date to a specific timezone
 * @param date - UTC Date object or ISO string
 * @param timezone - IANA timezone identifier (e.g., 'America/Sao_Paulo')
 * @returns Date object in the specified timezone
 */
export function toUserTimezone(date: Date | string, timezone: string = DEFAULT_TIMEZONE): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(d, timezone);
}

/**
 * Converts a local date from a specific timezone to UTC
 * @param date - Local Date object or ISO string
 * @param timezone - IANA timezone identifier
 * @returns UTC Date object
 */
export function fromUserTimezone(date: Date | string, timezone: string = DEFAULT_TIMEZONE): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return fromZonedTime(d, timezone);
}

/**
 * Formats a UTC date to a string in the user's timezone
 * @param date - UTC Date or ISO string
 * @param timezone - IANA timezone identifier
 * @param formatStr - date-fns format string
 * @returns Formatted date string
 */
export function formatInUserTimezone(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
  formatStr: string = "dd/MM/yyyy 'às' HH:mm"
): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, timezone, formatStr, { locale: ptBR });
}

/**
 * Formats date only in user's timezone
 */
export function formatDateInTimezone(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatInUserTimezone(date, timezone, 'dd/MM/yyyy');
}

/**
 * Formats time only in user's timezone
 */
export function formatTimeInTimezone(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatInUserTimezone(date, timezone, 'HH:mm');
}

/**
 * Formats date and time in user's timezone
 */
export function formatDateTimeInTimezone(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatInUserTimezone(date, timezone, "dd/MM/yyyy 'às' HH:mm");
}

/**
 * Gets the current time in a specific timezone
 */
export function nowInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Gets the start of day in a specific timezone (as UTC)
 * @param date - Reference date
 * @param timezone - User's timezone
 * @returns UTC Date representing start of day in user's timezone
 */
export function startOfDayInTimezone(
  date: Date | string = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const zonedDate = toZonedTime(d, timezone);
  zonedDate.setHours(0, 0, 0, 0);
  return fromZonedTime(zonedDate, timezone);
}

/**
 * Gets the end of day in a specific timezone (as UTC)
 * @param date - Reference date
 * @param timezone - User's timezone
 * @returns UTC Date representing end of day in user's timezone
 */
export function endOfDayInTimezone(
  date: Date | string = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const zonedDate = toZonedTime(d, timezone);
  zonedDate.setHours(23, 59, 59, 999);
  return fromZonedTime(zonedDate, timezone);
}

/**
 * Gets the timezone offset in hours for a specific timezone
 */
export function getTimezoneOffset(timezone: string = DEFAULT_TIMEZONE): number {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
}

/**
 * Formats a relative time description
 */
export function formatRelativeTime(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return days === 1 ? 'há 1 dia' : `há ${days} dias`;
  }
  if (hours > 0) {
    return hours === 1 ? 'há 1 hora' : `há ${hours} horas`;
  }
  if (minutes > 0) {
    return minutes === 1 ? 'há 1 minuto' : `há ${minutes} minutos`;
  }
  return 'agora';
}

/**
 * Parses a datetime-local input value to UTC Date
 * datetime-local inputs don't include timezone, so we assume it's in user's timezone
 * @param localDateTimeString - String from datetime-local input (YYYY-MM-DDTHH:mm)
 * @param timezone - User's timezone
 * @returns UTC Date
 */
export function parseDateTimeLocalToUTC(
  localDateTimeString: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  // datetime-local format: YYYY-MM-DDTHH:mm
  // We need to interpret this as being in the user's timezone
  const [datePart, timePart] = localDateTimeString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  // Create a date in the user's timezone
  const localDate = new Date(year, month - 1, day, hours, minutes);
  
  // Convert from user's timezone to UTC
  return fromZonedTime(localDate, timezone);
}

/**
 * Formats a UTC Date to datetime-local input format in user's timezone
 * @param utcDate - UTC Date
 * @param timezone - User's timezone
 * @returns String in datetime-local format (YYYY-MM-DDTHH:mm)
 */
export function formatDateTimeLocalFromUTC(
  utcDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const d = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return formatInTimeZone(d, timezone, "yyyy-MM-dd'T'HH:mm");
}

export default {
  DEFAULT_TIMEZONE,
  BRAZILIAN_TIMEZONES,
  SUPPORTED_TIMEZONES,
  isValidTimezone,
  toUserTimezone,
  fromUserTimezone,
  formatInUserTimezone,
  formatDateInTimezone,
  formatTimeInTimezone,
  formatDateTimeInTimezone,
  nowInTimezone,
  startOfDayInTimezone,
  endOfDayInTimezone,
  getTimezoneOffset,
  formatRelativeTime,
  parseDateTimeLocalToUTC,
  formatDateTimeLocalFromUTC,
};
