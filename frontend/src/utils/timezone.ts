/**
 * ZAFESYS Suite - Colombia Timezone Utilities
 * 
 * All dates in the app should use Colombia timezone (America/Bogota, UTC-5)
 * regardless of where the user is accessing from (e.g., Spain).
 */

// Colombia timezone identifier
export const COLOMBIA_TZ = 'America/Bogota';

/**
 * Get current date in Colombia timezone
 * @returns Date string in YYYY-MM-DD format for Colombia
 */
export function getTodayColombia(): string {
  const now = new Date();
  // Format date in Colombia timezone
  const colombiaDate = now.toLocaleDateString('en-CA', { 
    timeZone: COLOMBIA_TZ 
  }); // en-CA gives YYYY-MM-DD format
  return colombiaDate;
}

/**
 * Get current Date object adjusted to Colombia timezone
 * Note: The Date object itself is still in local time, but the date values are Colombia's
 */
export function getColombiaDate(): Date {
  const todayStr = getTodayColombia();
  const [year, month, day] = todayStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get current time in Colombia as HH:MM string
 */
export function getCurrentTimeColombia(): string {
  const now = new Date();
  return now.toLocaleTimeString('es-CO', {
    timeZone: COLOMBIA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Get current datetime in Colombia timezone
 */
export function getNowColombia(): Date {
  const now = new Date();
  // Get Colombia date/time components
  const options: Intl.DateTimeFormatOptions = {
    timeZone: COLOMBIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  return new Date(
    parseInt(getPart('year')),
    parseInt(getPart('month')) - 1,
    parseInt(getPart('day')),
    parseInt(getPart('hour')),
    parseInt(getPart('minute')),
    parseInt(getPart('second'))
  );
}

/**
 * Format a date for display in Colombia timezone
 * @param date Date object or ISO string
 * @param options Intl.DateTimeFormatOptions
 */
export function formatDateColombia(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CO', {
    ...options,
    timeZone: COLOMBIA_TZ
  });
}

/**
 * Format time for display in Colombia timezone
 */
export function formatTimeColombia(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('es-CO', {
    timeZone: COLOMBIA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Check if a date is today in Colombia timezone
 */
export function isTodayColombia(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: COLOMBIA_TZ });
  const todayStr = getTodayColombia();
  return dateStr === todayStr;
}

/**
 * Get week days starting from Monday, based on a reference date
 * All calculations use Colombia timezone
 */
export function getWeekDaysColombia(referenceDate: Date): Date[] {
  const days: Date[] = [];
  
  // Get the reference date in Colombia timezone as string
  const refStr = referenceDate.toLocaleDateString('en-CA', { timeZone: COLOMBIA_TZ });
  const [year, month, day] = refStr.split('-').map(Number);
  const refDateColombia = new Date(year, month - 1, day);
  
  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = refDateColombia.getDay();
  
  // Calculate Monday of this week
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(refDateColombia);
  monday.setDate(refDateColombia.getDate() + mondayOffset);
  
  // Generate all 7 days
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  
  return days;
}

/**
 * Compare if two dates are the same day (ignoring time)
 * Uses Colombia timezone for comparison
 */
export function isSameDayColombia(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  const str1 = d1.toLocaleDateString('en-CA', { timeZone: COLOMBIA_TZ });
  const str2 = d2.toLocaleDateString('en-CA', { timeZone: COLOMBIA_TZ });
  
  return str1 === str2;
}

/**
 * Parse a date string and return components in Colombia timezone
 */
export function parseDateColombia(dateStr: string): { year: number; month: number; day: number } {
  const d = new Date(dateStr);
  const formatted = d.toLocaleDateString('en-CA', { timeZone: COLOMBIA_TZ });
  const [year, month, day] = formatted.split('-').map(Number);
  return { year, month, day };
}
