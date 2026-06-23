// Independent classification of a sample's ISO cleanliness and water content
// against a company profile's limits. Each returns one of: 'critical',
// 'warning', 'normal'. The two are deliberately separate so the report can show
// a distinct stop-sign for each.

export const LEVELS = {
  error:    { key: 'error',    label: 'DATO ERRONEO', color: '#991b1b' },
  critical: { key: 'critical', label: 'CRITICO',      color: 'var(--orange)' },
  warning:  { key: 'warning',  label: 'PRECAUCION',   color: 'var(--warn)'   },
  normal:   { key: 'normal',   label: 'ACEPTABLE',    color: 'var(--green)'  },
};

// Parse a "18/16/13" ISO 4406 code → { p4, p6, p14 } of integers, or null.
export function parseISO(code) {
  if (!code) return null;
  const parts = code.toString().trim().split('/');
  if (parts.length !== 3) return null;
  const [p4, p6, p14] = parts.map(Number);
  if ([p4, p6, p14].some(n => Number.isNaN(n))) return null;
  return { p4, p6, p14 };
}

// Worst-component classification: a measured ISO is CRITICAL if any component
// meets/exceeds the profile's critical code, WARNING if any meets/exceeds the
// warn code, else NORMAL.
// A profile's ISO limit is a single anchor code A (for the 4µm / first number);
// the 6µm and 14µm limits are A-1 and A-2. This keeps the first number dominant
// so a borderline 6µm/14µm doesn't push the whole sample up a category.
// Accepts a number (new anchor form) or a legacy {p4,p6,p14} object (uses p4).
export function isoLimits(threshold) {
  const a = typeof threshold === 'number' ? threshold : threshold.p4;
  return { p4: a, p6: a - 1, p14: a - 2 };
}

export function classifyISO(isoCode, profile) {
  const iso = parseISO(isoCode);
  if (!iso) return 'normal';
  // Cumulative counts must decrease with size: >4µm ≥ >6µm ≥ >14µm. A larger
  // code on a finer channel is physically impossible → flag as erroneous.
  if (iso.p4 < iso.p6 || iso.p6 < iso.p14) return 'error';
  const warn = isoLimits(profile.iso.warn);
  const crit = isoLimits(profile.iso.crit);
  if (iso.p4 >= crit.p4 || iso.p6 >= crit.p6 || iso.p14 >= crit.p14) return 'critical';
  if (iso.p4 >= warn.p4 || iso.p6 >= warn.p6 || iso.p14 >= warn.p14) return 'warning';
  return 'normal';
}

export function classifyWater(ppm, profile) {
  if (ppm == null) return 'normal';
  const { warn, crit } = profile.water;
  if (ppm >= crit) return 'critical';
  if (ppm >= warn) return 'warning';
  return 'normal';
}

// The overall sample status is the worse of the two (used for history badges,
// sorting, etc.). Order: critical > warning > normal.
const RANK = { error: 3, critical: 2, warning: 1, normal: 0 };
export function overallStatus(isoLevel, waterLevel) {
  return RANK[isoLevel] >= RANK[waterLevel] ? isoLevel : waterLevel;
}

export function fmtISO(code) {
  return `${code.p4}/${code.p6}/${code.p14}`;
}
