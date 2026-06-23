// Top-level wiring: screen switching, file intake, the client selector, the
// progress UI, edit mode, report history. Domain logic lives in the imports.

import { extractSamples } from './extract.js';
import { renderReport } from './report.js';
import { loadClients, getClientsCached, getActiveClient, getClient, setActiveClient, isOffline } from './clients.js';
import { initClientEditor, openClientManager } from './clientEditor.js';
import { downloadCSV } from './csv.js';
import { exportHydac } from './hydac.js';
import { exportReportPDF } from './pdf.js';
import { persistReport, updateSavedReport, fetchHistory, fetchReport, removeReport, renderHistoryList } from './history.js';

let editMode = false;
let reportDirty = false; // any manual field/status edit on the current report
let currentState = null; // most recent extraction (for CSV + save)
const $ = id => document.getElementById(id);

// Runs after any report render: refresh the limits-override selector and reset
// edit state so the toolbar matches the freshly-rendered papers.
function afterRenderReport() {
  refreshLimitsOverride();
  reportDirty = false;
  editMode = false;
  const btn = $('edit-btn');
  btn.classList.remove('active');
  btn.textContent = '✏️ Editar campos';
  $('edit-hint').textContent = '💡 Activa "Editar" para corregir datos antes de guardar.';
}

// ---------- Limits override (re-evaluate a processed report against other limits) ----------
function refreshLimitsOverride() {
  const sel = $('limits-override');
  const curId = currentState?.limitsClientId ?? currentState?.profile?.id;
  sel.innerHTML = getClientsCached()
    .map(c => `<option value="${c.id}"${c.id === curId ? ' selected' : ''}>${c.name}</option>`)
    .join('');
}

function applyLimitsOverride(clientId) {
  const chosen = getClient(clientId);
  if (!chosen || !currentState) return;
  if (reportDirty && !confirm('Cambiar los límites volverá a generar el reporte y se perderán las ediciones manuales. ¿Continuar?')) {
    refreshLimitsOverride(); // revert the dropdown to the current client
    return;
  }
  // Override only the limits (iso/water); keep the report's logo/name/id.
  // Changing limits is a recompute → drop any manual status overrides.
  currentState.samples.forEach(s => { delete s._isoLevel; delete s._waterLevel; });
  currentState.profile = { ...currentState.profile, iso: chosen.iso, water: chosen.water };
  currentState.limitsClientId = chosen.id;
  renderReport(currentState.samples, $('reports-container'), currentState);
  afterRenderReport();
  $('save-status').textContent = 'Límites: ' + chosen.name;
}

// ---------- Screens ----------
function showScreen(name) {
  $('upload-screen').style.display = name === 'upload' ? 'flex' : 'none';
  $('report-screen').style.display = name === 'report' ? 'block' : 'none';
  $('history-screen').style.display = name === 'history' ? 'block' : 'none';
}

// ---------- Client selector ----------
function refreshClientSelect() {
  const sel = $('client-select');
  const active = getActiveClient();
  sel.innerHTML = getClientsCached()
    .map(c => `<option value="${c.id}"${active && c.id === active.id ? ' selected' : ''}>${c.name}</option>`)
    .join('');
  applyClientDefaults(active, false);
}

// Fill empresa / generado-por from the client. force=true overwrites existing
// input; false only fills empty fields (used on initial load).
function applyClientDefaults(client, force) {
  if (!client) return;
  const emp = $('empresa-input'), gen = $('generado-input');
  if (force || !emp.value.trim()) emp.value = client.name && !client._offline ? client.name : emp.value;
  if (force || !gen.value.trim()) gen.value = client.default_generated_by || '';
}

// ---------- File processing ----------
async function processFile(file) {
  if (!file.name.endsWith('.pdf') && !file.type.includes('pdf')) {
    return showError('Por favor sube un archivo PDF.');
  }
  showProcessing(true);
  try {
    const samples = await extractSamples(file, setProgress);
    currentState = {
      samples,
      empresa: $('empresa-input').value.trim() || null,
      generadoPor: $('generado-input').value.trim() || null,
      profile: getActiveClient(),
    };
    renderReport(samples, $('reports-container'), currentState);
    showScreen('report');
    afterRenderReport();
    saveCurrentReport();
  } catch (err) {
    console.error('ERROR:', err.message, err.stack);
    showError('Error al extraer datos: ' + err.message);
  } finally {
    showProcessing(false);
  }
}

async function saveCurrentReport() {
  const note = $('save-status');
  note.textContent = '';
  try {
    const saved = await persistReport(currentState);
    if (currentState) currentState.savedReportId = saved?.id || null;
    note.textContent = saved ? '✓ Guardado en el historial' : '⚠ No guardado (sin conexión)';
  } catch (err) {
    console.error('No se pudo guardar el reporte:', err.message);
    note.textContent = '⚠ No se pudo guardar';
  }
}

const BATCH_SIZE = 4;
function setProgress(doneBatches, totalBatches, pageStart, pageEnd, totalPages) {
  const pct = Math.round((doneBatches / totalBatches) * 100);
  $('progress-bar').style.width = pct + '%';
  if (pageStart != null) {
    const batchLabel = totalPages > BATCH_SIZE ? ` (páginas ${pageStart}–${pageEnd} de ${totalPages})` : '';
    $('progress-text').textContent = doneBatches < totalBatches
      ? `Analizando lote ${doneBatches + 1} de ${totalBatches}${batchLabel}…`
      : '✓ Análisis completo';
  }
  $('progress-bar-wrap').style.display = totalBatches > 1 ? 'block' : 'none';
}

function showProcessing(on) {
  $('upload-form').style.display = on ? 'none' : 'block';
  $('processing').style.display = on ? 'flex' : 'none';
  if (on) {
    $('upload-error').style.display = 'none'; // clear stale error only when starting
  } else {
    $('progress-bar-wrap').style.display = 'none';
    $('progress-bar').style.width = '0%';
    $('progress-text').textContent = '';
    // NOTE: do not hide upload-error here — it would swallow a just-shown error.
  }
}

function showError(msg) {
  const el = $('upload-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// ---------- History ----------
async function openHistory() {
  showScreen('history');
  const list = $('history-list');
  list.innerHTML = '<p style="color:#999;padding:24px;text-align:center">Cargando…</p>';
  try {
    const rows = await fetchHistory();
    renderHistoryList(list, rows, { onOpen: openSavedReport, onDelete: deleteSavedReport });
  } catch (err) {
    list.innerHTML = `<p style="color:var(--orange);padding:24px;text-align:center">No se pudo cargar el historial: ${err.message}</p>`;
  }
}

async function openSavedReport(id) {
  try {
    const r = await fetchReport(id);
    if (!r) return;
    currentState = { samples: r.samples, empresa: r.client_name, generadoPor: r.generated_by, profile: r.profile, savedReportId: r.id };
    renderReport(r.samples, $('reports-container'), currentState);
    afterRenderReport();
    $('save-status').textContent = 'Reporte del historial';
    showScreen('report');
  } catch (err) {
    alert('No se pudo abrir el reporte: ' + err.message);
  }
}

async function deleteSavedReport(id) {
  if (!confirm('¿Eliminar este reporte del historial?')) return;
  try { await removeReport(id); openHistory(); }
  catch (err) { alert('No se pudo eliminar: ' + err.message); }
}

// ---------- Edit mode ----------
function toggleEdit() {
  editMode = !editMode;
  document.querySelectorAll('.report-paper').forEach(p => p.classList.toggle('edit-mode', editMode));
  const btn = $('edit-btn');
  btn.classList.toggle('active', editMode);
  btn.textContent = editMode ? '✅ Listo' : '✏️ Editar campos';
  $('edit-hint').textContent = editMode
    ? '✏️ Campos en amarillo son editables. El estado de ISO y agua también se puede cambiar.'
    : '💡 Activa "Editar" para corregir datos antes de guardar.';
  // Leaving edit mode with changes → commit the manual edits to history.
  if (!editMode && reportDirty && currentState?.savedReportId) commitEdits();
}

async function commitEdits() {
  const note = $('save-status');
  try {
    await updateSavedReport(currentState.savedReportId, currentState);
    reportDirty = false;
    note.textContent = '✓ Cambios guardados';
  } catch (err) {
    console.error('No se pudieron guardar los cambios:', err.message);
    note.textContent = '⚠ Cambios no guardados';
  }
}

function resetApp() {
  $('reports-container').innerHTML = '';
  $('file-input').value = '';
  $('save-status').textContent = '';
  editMode = false;
  showScreen('upload');
}

// ---------- Init ----------
async function init() {
  const dropZone = $('drop-zone');
  const fileInput = $('file-input');
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag');
    const f = e.dataTransfer.files[0]; if (f) processFile(f);
  });
  fileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });

  $('client-select').addEventListener('change', e => {
    setActiveClient(e.target.value);
    applyClientDefaults(getActiveClient(), true);
  });
  $('manage-clients-btn').addEventListener('click', openClientManager);
  $('limits-override').addEventListener('change', e => applyLimitsOverride(e.target.value));
  // Track manual edits so a limits re-render can warn before discarding them.
  const rc = $('reports-container');
  rc.addEventListener('input', () => { reportDirty = true; });
  rc.addEventListener('change', () => { reportDirty = true; });
  $('history-btn').addEventListener('click', openHistory);
  $('history-back-btn').addEventListener('click', resetApp);
  $('edit-btn').addEventListener('click', toggleEdit);
  $('new-report-btn').addEventListener('click', resetApp);
  $('print-btn').addEventListener('click', () => window.print());
  $('pdf-btn').addEventListener('click', async () => {
    const btn = $('pdf-btn'); const txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'Generando…';
    try { await exportReportPDF(); }
    catch (err) { alert('No se pudo generar el PDF: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = txt; }
  });
  $('csv-btn').addEventListener('click', () => { if (currentState) downloadCSV(currentState); });
  $('hydac-btn').addEventListener('click', async () => {
    if (!currentState) return;
    const btn = $('hydac-btn'); const txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'Generando…';
    try { await exportHydac(currentState); }
    catch (err) { alert('No se pudo exportar a HYDAC: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = txt; }
  });

  initClientEditor(refreshClientSelect);
  await loadClients();
  refreshClientSelect();
  if (isOffline()) showError('Sin conexión con la base de datos — usando límites por defecto. Configura Supabase para clientes e historial.');
}

document.addEventListener('DOMContentLoaded', init);
