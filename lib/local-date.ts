export function parseTypedDate(value: string): string | null {
  const v = value.trim();
  if (!v) return '';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', min = '00'] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${min}Z`);
  if (
    Number(y) < 1000 ||
    Number(y) > 9999 ||
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== +y ||
    date.getUTCMonth() + 1 !== +mo ||
    date.getUTCDate() !== +d ||
    date.getUTCHours() !== +h ||
    date.getUTCMinutes() !== +min
  )
    return null;
  return `${y}-${mo}-${d}T${h}:${min}`;
}
export function datePart(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
// Date.parse accepts impossible calendar dates by rolling them into the next month.
export function isStoredDate(value: string) {
  if (!value) return true;
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::([0-5]\d)(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)?)?$/,
  );
  return (
    !!match &&
    parseTypedDate(`${match[1]} ${match[2] || '00:00'}`) !== null &&
    Number.isFinite(Date.parse(value))
  );
}
export function validDateRange(start: string, end: string, offset?: string) {
  return (
    !end ||
    (!!start &&
      isStoredDate(start) &&
      isStoredDate(end) &&
      Date.parse(timestamp(end, offset)) >= Date.parse(timestamp(start, offset)))
  );
}
export function editorDate(value: string) {
  return value ? `${value.slice(0, 10)} ${value.slice(11, 16) || '00:00'}` : '';
}
export function editedDate(stored: string, next: string) {
  if (!next) return '';
  if (next === parseTypedDate(editorDate(stored))) return stored;
  return next + (stored.match(/(?:Z|[+-]\d\d:\d\d)$/)?.[0] || '');
}
export function timestamp(date: string, offset?: string) {
  if (!date) return '';
  const value = date.length === 10 ? date + 'T00:00' : date;
  return value + (!/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? offset || '' : '');
}
export function wallDateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) {
  return date
    ? new Date(date.slice(0, 10) + 'T00:00Z').toLocaleDateString('en-US', {
        ...options,
        timeZone: 'UTC',
      })
    : 'Undated';
}
export function timeLabel(n: { date: string; utcOffset?: string; timePrecision?: string }) {
  if (!n.date || n.timePrecision === 'date-only' || n.date.length === 10) return '';
  const time = n.date.slice(11).replace(/(?:Z|[+-]\d\d:\d\d)$/, '');
  const explicit = n.date.match(/(?:Z|[+-]\d\d:\d\d)$/)?.[0];
  const zone = explicit === 'Z' ? '+00:00' : explicit || n.utcOffset;
  return (n.timePrecision === 'approximate' ? '≈ ' : '') + time + (zone ? ' UTC' + zone : '');
}
