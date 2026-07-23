export type TimeFormat = '12h' | '24h';

export type AppSettings = {
  timeFormat: TimeFormat;
};

/** `time24` is a "HH:MM" 24-hour string, as stored everywhere in the DB. */
export function formatTimeDisplay(time24: string | null, format: TimeFormat): string | null {
  if (!time24) return null;
  const [hourStr, minuteStr] = time24.split(':');
  const hour24 = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour24) || Number.isNaN(minute)) return null;

  if (format === '24h') {
    return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}
