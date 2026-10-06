/* ==================================================================
   APP TIME — Uganda wall-clock helpers
   ------------------------------------------------------------------
   All dates in this app are Uganda (EAT) wall-clock time.
   Storage in the DB is UTC (Sequelize default). Conversion happens
   at exactly two boundaries:

     - fromInput(value)   when a user submits a datetime-local string
     - format(date)       when a Date is displayed to a user

   Everywhere else — DB reads, DB writes, comparisons, arithmetic —
   values stay UTC. Never call new Date(str) directly on user input;
   always route through fromInput().

   Server timezone is irrelevant. This module uses the IANA zone name
   "Africa/Kampala" (no DST), so it behaves identically on a UTC
   server, an EAT server, or anything else.
   ================================================================== */

const TZ = 'Africa/Kampala';
const EAT_OFFSET = '+03:00';   // Kampala has no DST, so this is fixed

/* ------------------------------------------------------------------
   fromInput(value) → Date | null
   ------------------------------------------------------------------
   Accepts:
     - "2026-10-31T20:15"       (datetime-local, no zone)
     - "2026-10-31T20:15:00"    (same with seconds)
     - "2026-10-31T20:15:00Z"   (already UTC)
     - "2026-10-31T20:15:00+03:00" (already zoned)

   Naive strings are interpreted as Kampala time.
   Returns null for empty / invalid input.
   ------------------------------------------------------------------ */
function fromInput(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  const hasZone = /[zZ]$|[+\-]\d{2}:?\d{2}$/.test(s);
  const iso = hasZone ? s : `${s}:00${EAT_OFFSET}`;

  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/* ------------------------------------------------------------------
   toInput(date) → "YYYY-MM-DDTHH:MM"
   ------------------------------------------------------------------
   Formats a Date for use in a <input type="datetime-local">.
   Always in Kampala time. Empty string if date is missing/invalid.
   ------------------------------------------------------------------ */
function toInput(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);

  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/* ------------------------------------------------------------------
   format(date, opts?) → "31 Oct 2026, 20:15"
   ------------------------------------------------------------------
   Full date + time in Kampala. Pass opts to override individual
   Intl.DateTimeFormat fields (day, month, year, hour, minute, etc.).
   ------------------------------------------------------------------ */
function format(date, opts = {}) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts
  }).format(d);
}

/* ------------------------------------------------------------------
   formatDate(date, opts?) → "31 Oct 2026"
   ------------------------------------------------------------------
   Date-only in Kampala. Use for fields where the time isn't shown.
   ------------------------------------------------------------------ */
function formatDate(date, opts = {}) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts
  }).format(d);
}

/* ------------------------------------------------------------------
   formatTime(date, opts?) → "20:15"
   ------------------------------------------------------------------
   Time-only in Kampala.
   ------------------------------------------------------------------ */
function formatTime(date, opts = {}) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts
  }).format(d);
}

/* ------------------------------------------------------------------
   formatRelative(date) → "24 days left" | "3 hours left" | "Closed"
   ------------------------------------------------------------------
   For deadline display. Compares against Date.now().
   ------------------------------------------------------------------ */
function formatRelative(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const ms = d.getTime() - Date.now();
  if (ms <= 0) return 'Closed';

  const days = Math.floor(ms / 86400000);
  if (days >= 1) return days + ' day' + (days === 1 ? '' : 's') + ' left';

  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return hours + ' hour' + (hours === 1 ? '' : 's') + ' left';

  const mins = Math.floor(ms / 60000);
  if (mins >= 1) return mins + ' minute' + (mins === 1 ? '' : 's') + ' left';

  return 'Less than a minute left';
}

module.exports = {
  TZ,
  fromInput,
  toInput,
  format,
  formatDate,
  formatTime,
  formatRelative
};