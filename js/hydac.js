// Exports extracted samples into the HYDAC Fluid Care upload template.
//
// The template (templates/hydac-template.xlsx, sheet "AllTest") is column-
// oriented: column D holds a field key per row, and each sample's values go in
// its own column starting at E. Row positions differ between template versions,
// so we map by the column-D key, never by hardcoded row numbers.
//
// Source values are LOAMS particle counts per 1 ml; HYDAC wants per 100 ml → ×100.
// Differential bins (4-6µm…) are derived from the cumulative counts by
// subtracting the next channel. ISO 4406 codes come from the report's isoCode.

import { nextSeq } from './api.js';

const TEMPLATE_URL = 'templates/hydac-template.xlsx';
const FIRST_VALUE_COL = 4; // 0-based column index of "E" (sample 1)

const pad2 = n => String(n).padStart(2, '0');

function colLetter(idx) {
  let s = '', n = idx + 1;
  while (n) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

// Excel serial date (days since 1899-12-30).
const excelSerial = d => Math.floor((d.getTime() - Date.UTC(1899, 11, 30)) / 86400000);

// Best-effort sample date; falls back to today if LOAMS' date string won't parse.
function sampleDate(s) {
  if (s.sampledDate) { const d = new Date(s.sampledDate); if (!isNaN(d)) return d; }
  return new Date();
}

// Build the { fieldKey: value } map for one sample.
function fieldsFor(sample, meta) {
  const x = v => (v == null ? null : Math.round(v * 100)); // /1ml → /100ml
  const c4 = x(sample.particles4um), c6 = x(sample.particles6um), c14 = x(sample.particles14um),
        c21 = x(sample.particles21um), c38 = x(sample.particles38um), c70 = x(sample.particles70um);
  const diff = (a, b) => (a == null || b == null ? null : a - b);
  const iso = (sample.isoCode || '').split('/').map(t => parseInt(t.trim(), 10));

  const f = {
    // cumulative >Xµm (direct, ×100)
    particle_count_sae_cumulative_room_4: c4,
    particle_count_sae_cumulative_room_6: c6,
    particle_count_sae_cumulative_room_14: c14,
    particle_count_sae_cumulative_room_21: c21,
    particle_count_sae_cumulative_room_38: c38,
    particle_count_sae_cumulative_room_70: c70,
    // differential bins (adjacent subtraction)
    particle_count_sae_room_4: diff(c4, c6),
    particle_count_sae_room_6: diff(c6, c14),
    particle_count_sae_room_14: diff(c14, c21),
    particle_count_sae_room_21: diff(c21, c38),
    particle_count_sae_room_38: diff(c38, c70),
    particle_count_sae_room_70: c70,
    // water + metadata
    water_content: sample.waterKFppm,
    sample_no: meta.sampleNo,
    date: meta.dateSerial,
    asset_reference: sample.unitId || sample.componentDescription || null,
    analysis_package: meta.pkg,
    reason_analysis: 'Routine',
  };
  if (iso.length === 3 && iso.every(n => !isNaN(n))) {
    f.particle_count_sae_iso_room_4 = iso[0];
    f.particle_count_sae_iso_room_6 = iso[1];
    f.particle_count_sae_iso_room_14 = iso[2];
  }
  if (meta.bottle != null) f.bottle_number = meta.bottle;
  return f;
}

// state = { samples, profile, ... }. Downloads the filled .xlsx.
export async function exportHydac(state) {
  if (typeof XLSX === 'undefined') throw new Error('La librería de Excel no se cargó. Recarga la página.');
  const samples = state.samples || [];
  if (!samples.length) throw new Error('No hay muestras para exportar.');

  const buf = await (await fetch(TEMPLATE_URL)).arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Map every field key (column D) → row number.
  const range = XLSX.utils.decode_range(ws['!ref']);
  const keyRow = {};
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cell = ws['D' + (r + 1)];
    if (cell && typeof cell.v === 'string') keyRow[cell.v] = r + 1;
  }

  let maxCol = FIRST_VALUE_COL - 1;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const dt = sampleDate(s);
    const ymd = String(dt.getFullYear()).slice(2) + pad2(dt.getMonth() + 1) + pad2(dt.getDate());

    let seqNum = null, bottle = null;
    try { seqNum = await nextSeq('sample_' + ymd); } catch { /* counter optional */ }
    try { bottle = await nextSeq('bottle'); } catch { /* counter optional */ }
    const sampleNo = seqNum != null
      ? `${ymd}-${seqNum}`
      : `${ymd}-${pad2(dt.getHours())}${pad2(dt.getMinutes())}${pad2(dt.getSeconds())}${i}`;

    const meta = { sampleNo, dateSerial: excelSerial(dt), pkg: 'Basic', bottle };
    const fields = fieldsFor(s, meta);
    const col = colLetter(FIRST_VALUE_COL + i);
    maxCol = FIRST_VALUE_COL + i;

    for (const [key, val] of Object.entries(fields)) {
      const row = keyRow[key];
      if (row == null || val == null || val === '') continue;
      const addr = col + row;
      if (key === 'date') ws[addr] = { t: 'n', v: val, z: 'mm/dd/yyyy' };
      else if (typeof val === 'number') ws[addr] = { t: 'n', v: val };
      else ws[addr] = { t: 's', v: String(val) };
    }
  }

  if (maxCol > range.e.c) { range.e.c = maxCol; ws['!ref'] = XLSX.utils.encode_range(range); }

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `hydac_${today}.xlsx`);
}
