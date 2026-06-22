// Top-level wiring: screen switching, file intake, the profile selector, the
// progress UI and edit mode. Domain logic lives in the imported modules.

import { extractSamples } from './extract.js';
import { renderReport } from './report.js';
import { getProfiles, getActiveProfile, setActiveProfile } from './profiles.js';
import { initProfileEditor, openProfileManager } from './profileEditor.js';
import { downloadCSV } from './csv.js';

let editMode = false;
// Holds the most recent extraction so the CSV export can rebuild rows.
let currentState = null;
const $ = id => document.getElementById(id);

// ---------- Profile selector ----------
function refreshProfileSelect() {
  const sel = $('profile-select');
  const active = getActiveProfile();
  sel.innerHTML = getProfiles()
    .map(p => `<option value="${p.id}"${p.id === active.id ? ' selected' : ''}>${p.name}</option>`)
    .join('');
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
      profile: getActiveProfile(),
    };
    renderReport(samples, $('reports-container'), currentState);
    $('upload-screen').style.display = 'none';
    $('report-screen').style.display = 'block';
  } catch (err) {
    console.error('ERROR:', err.message, err.stack);
    showError('Error al extraer datos: ' + err.message);
  } finally {
    showProcessing(false);
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
  $('processing').style.display = on ? 'flex' : 'none';
  if (!on) {
    $('progress-bar-wrap').style.display = 'none';
    $('progress-bar').style.width = '0%';
    $('progress-text').textContent = '';
  }
  $('upload-error').style.display = 'none';
}

function showError(msg) {
  const el = $('upload-error');
  el.textContent = msg;
  el.style.display = 'block';
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
}

function resetApp() {
  $('upload-screen').style.display = 'flex';
  $('report-screen').style.display = 'none';
  $('reports-container').innerHTML = '';
  $('file-input').value = '';
  editMode = false;
}

// ---------- Init ----------
function init() {
  const dropZone = $('drop-zone');
  const fileInput = $('file-input');
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag');
    const f = e.dataTransfer.files[0]; if (f) processFile(f);
  });
  fileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });

  $('profile-select').addEventListener('change', e => setActiveProfile(e.target.value));
  $('manage-profiles-btn').addEventListener('click', openProfileManager);
  $('edit-btn').addEventListener('click', toggleEdit);
  $('new-report-btn').addEventListener('click', resetApp);
  $('print-btn').addEventListener('click', () => window.print());
  $('csv-btn').addEventListener('click', () => { if (currentState) downloadCSV(currentState); });

  initProfileEditor(refreshProfileSelect);
  refreshProfileSelect();
}

document.addEventListener('DOMContentLoaded', init);
