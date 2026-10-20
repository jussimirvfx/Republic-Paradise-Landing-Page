export function parseOpeningDate(value, now = new Date()) {
  if (typeof value !== 'string') return null;
  const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(value) ? value.split('/').reverse().join('-') : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date <= now && date.toISOString().slice(0,10) === iso ? date : null;
}
export function companyAge(value, now = new Date()) {
  const date = parseOpeningDate(value, now);
  if (!date) return null;
  return now.getUTCFullYear() - date.getUTCFullYear()
    - Number(now.getUTCMonth() < date.getUTCMonth() || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate()));
}
