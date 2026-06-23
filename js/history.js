// Report history: persist each generated report to Supabase and render the
// saved-reports list. A report stores its samples plus a snapshot of the limits
// used, so it re-renders identically later regardless of profile changes.

import { getReports, getReport, deleteReport, saveReport, updateReport } from './api.js';
import { classifyISO, classifyWater, overallStatus, LEVELS } from './classify.js';

const RANK = { normal: 0, warning: 1, critical: 2, error: 3 };
const esc = s => (s || '').toString().replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Worst overall status across all samples, per the report's own limits.
function worstStatus(samples, profile) {
  let worst = 'normal';
  for (const d of samples) {
    const isoLv = d._isoLevel || classifyISO(d.isoCode, profile);
    const waterLv = d._waterLevel || classifyWater(d.waterKFppm, profile);
    const lv = overallStatus(isoLv, waterLv);
    if (RANK[lv] > RANK[worst]) worst = lv;
  }
  return worst;
}

// state = { samples, empresa, generadoPor, profile }. Returns the saved row, or
// null if it can't be saved (offline / no backend).
export async function persistReport(state) {
  if (!state.profile || state.profile._offline) return null;
  return saveReport({
    client_id: state.profile.id || null,
    client_name: state.empresa || state.profile.name || null,
    generated_by: state.generadoPor || null,
    overall_status: worstStatus(state.samples, state.profile),
    sample_count: state.samples.length,
    samples: state.samples,
    profile: state.profile,
  });
}

// Re-save an existing report after manual edits (status overrides), so the
// stored copy matches what the analyst approved.
export async function updateSavedReport(id, state) {
  if (!id) return null;
  return updateReport(id, {
    overall_status: worstStatus(state.samples, state.profile),
    sample_count: state.samples.length,
    samples: state.samples,
  });
}

export const fetchHistory = () => getReports();
export const fetchReport = (id) => getReport(id);
export const removeReport = (id) => deleteReport(id);

export function renderHistoryList(container, rows, { onOpen, onDelete }) {
  if (!rows.length) {
    container.innerHTML = '<p style="color:#999;padding:24px;text-align:center">No hay reportes guardados todavía.</p>';
    return;
  }
  container.innerHTML = rows.map(r => {
    const L = LEVELS[r.overall_status] || LEVELS.normal;
    const date = new Date(r.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    return `<div class="history-row">
      <span class="status-badge ${L.key}">${L.label}</span>
      <div class="hr-main">
        <div class="hr-client">${esc(r.client_name) || '—'}</div>
        <div class="hr-meta">${date} · ${r.sample_count} muestra(s)${r.generated_by ? ' · ' + esc(r.generated_by) : ''}</div>
      </div>
      <button class="link-btn hr-open" data-id="${r.id}">Abrir</button>
      <button class="link-btn hr-del" data-id="${r.id}" style="color:#c00">Eliminar</button>
    </div>`;
  }).join('');

  container.querySelectorAll('.hr-open').forEach(b => b.onclick = () => onOpen(b.dataset.id));
  container.querySelectorAll('.hr-del').forEach(b => b.onclick = () => onDelete(b.dataset.id));
}
