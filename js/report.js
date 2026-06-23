// Renders extracted samples into branded report papers. Each sample gets two
// independent stop-signs (ISO/particles and water), classified against the
// active company profile, plus an auto-generated recommendation that stays in
// sync when the analyst overrides a status in edit mode.

import { LEVELS, classifyISO, classifyWater, parseISO, fmtISO, isoLimits } from './classify.js';
import { buildRecommendation } from './recommendation.js';

const LEVEL_ORDER = ['normal', 'warning', 'critical', 'error'];

function safeVal(v) {
  return (v == null || v === '' ? '—' : v).toString()
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function badgeOptions(selected) {
  return LEVEL_ORDER.map(k =>
    `<option value="${k}"${k === selected ? ' selected' : ''}>${LEVELS[k].label}</option>`
  ).join('');
}

function statusGroup(kind, titleLabel, level) {
  const L = LEVELS[level];
  return `
    <div class="status-group" data-kind="${kind}">
      <div class="slabel">${titleLabel}</div>
      <div class="badge-wrap">
        <span class="status-badge ${L.key}">${L.label}</span>
        <select class="status-select">${badgeOptions(level)}</select>
      </div>
    </div>`;
}

// Render every sample into the container. `ctx` = { empresa, generadoPor, profile }.
export function renderReport(samples, container, ctx) {
  const { empresa, generadoPor, profile } = ctx;
  container.innerHTML = '';
  const logo = (profile && profile.logo) || 'logo.png';
  const genDate = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

  samples.forEach((d, idx) => {
    // Respect a previously-set status (manual override or reopened report);
    // otherwise classify against the active profile.
    const isoLevel = d._isoLevel || classifyISO(d.isoCode, profile);
    const waterLevel = d._waterLevel || classifyWater(d.waterKFppm, profile);

    const particles = [
      { label: '>4 µm  (p/ml)', val: d.particles4um }, { label: '>6 µm  (p/ml)', val: d.particles6um },
      { label: '>14 µm (p/ml)', val: d.particles14um }, { label: '>21 µm (p/ml)', val: d.particles21um },
      { label: '>38 µm (p/ml)', val: d.particles38um }, { label: '>70 µm (p/ml)', val: d.particles70um },
    ];
    const maxVal = Math.max(...particles.map(p => p.val || 0)) || 1;
    const barsHTML = particles.map(p => {
      const pct = p.val != null ? Math.max(3, (p.val / maxVal) * 100) : 0;
      return `<div class="particle-bar-row">
        <span class="pb-label">${p.label}</span>
        <div class="pb-track"><div class="pb-fill" style="width:${pct}%"></div></div>
        <span class="pb-val">${p.val != null ? p.val.toLocaleString('es-MX') : 'N/R'}</span>
      </div>`;
    }).join('');

    const isoTarget = `Límite: ${fmtISO(isoLimits(profile.iso.warn))} (prec.) · ${fmtISO(isoLimits(profile.iso.crit))} (crít.)`;
    const waterTarget = `Límite: ${profile.water.warn.toLocaleString('es-MX')} (prec.) · ${profile.water.crit.toLocaleString('es-MX')} ppm (crít.)`;

    const rec = buildRecommendation(isoLevel, waterLevel, d.waterKFppm);

    const paper = document.createElement('div');
    paper.className = 'report-paper';
    paper.style.cssText = 'margin-bottom:32px';
    paper.innerHTML = `
      <div class="report-header">
        <img src="${logo}" alt="Flowtech" style="height:46px;width:auto;max-width:380px;display:block;"/>
        <div class="header-right">
          <div class="report-title">Reporte de Analisis de Fluidos</div>
          <div class="report-subtitle">ISO · Contaminación por Partículas · Agua</div>
        </div>
      </div>
      <div class="status-bar">
        ${statusGroup('iso', 'Estado · ISO / Particulas', isoLevel)}
        ${statusGroup('water', 'Estado · Contenido de Agua', waterLevel)}
        <div class="status-group right">
          <div class="slabel">Reporte generado</div>
          <div style="font-size:.8rem;color:#555;font-weight:500">${genDate}</div>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-cell">
          <h4>Informacion de Muestra</h4>
          <div class="info-row"><span class="info-key">No. Lab</span><input class="editable-field" value="${safeVal(d.labNo)}"/></div>
          <div class="info-row"><span class="info-key">Fecha de muestra</span><input class="editable-field" value="${safeVal(d.sampledDate)}"/></div>
          <div class="info-row"><span class="info-key">Recibida</span><input class="editable-field" value="${safeVal(d.receivedDate)}"/></div>
          <div class="info-row"><span class="info-key">Completada</span><input class="editable-field" value="${safeVal(d.completedDate)}"/></div>
        </div>
        <div class="info-cell">
          <h4>Unidad / Componente</h4>
          <div class="info-row"><span class="info-key">ID Unidad</span><input class="editable-field" value="${safeVal(d.unitId)}"/></div>
          <div class="info-row"><span class="info-key">Componente</span><input class="editable-field" value="${safeVal(d.componentDescription)}"/></div>
          <div class="info-row"><span class="info-key">Empresa</span><input class="editable-field" value="${safeVal(empresa || d.worksite)}"/></div>
          <div class="info-row"><span class="info-key">No. Referencia</span><input class="editable-field" value="${safeVal(d.referenceNo)}"/></div>
        </div>
        <div class="info-cell">
          <h4>Fluido</h4>
          <div class="info-row"><span class="info-key">Fabricante</span><input class="editable-field" value="${safeVal(d.fluidManufacturer)}"/></div>
          <div class="info-row"><span class="info-key">Producto</span><input class="editable-field" value="${safeVal(d.fluidProduct)}"/></div>
          <div class="info-row"><span class="info-key">Grado</span><input class="editable-field" value="${safeVal(d.fluidGrade ? 'ISO ' + d.fluidGrade.replace(/iso\s*/i, '') : null)}"/></div>
          <div class="info-row"><span class="info-key">Generado por</span><input class="editable-field" value="${safeVal(generadoPor || d.evaluatedBy)}"/></div>
        </div>
      </div>
      <div style="padding:0 36px">
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Codigo de Limpieza ISO</div>
            <div class="kpi-value iso-kpi">${safeVal(d.isoCode)}</div>
            <div class="kpi-unit">ISO 4406:1999</div>
            <div class="kpi-target">${isoTarget}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Contenido de Agua (KF)</div>
            <div class="kpi-value water-kpi">${d.waterKFppm != null ? d.waterKFppm.toLocaleString('es-MX') : 'N/R'}</div>
            <div class="kpi-unit">PPM</div>
            <div class="kpi-target">${waterTarget}</div>
          </div>
        </div>
      </div>
      <div class="section-header" style="margin-top:20px">
        <div class="section-dot iso-dot"></div><h2>Conteo de Particulas</h2>
      </div>
      <div class="results-section">${barsHTML}</div>
      <div class="section-header">
        <div class="section-dot rec-dot"></div><h2>Recomendacion de Mantenimiento</h2>
      </div>
      <div style="height:10px"></div>
      <div class="rec-section">
        <div class="rec-label">Recomendacion del Analista</div>
        <textarea class="editable-rec" rows="1">${rec}</textarea>
      </div>
      <div style="height:16px"></div>
      <div class="report-footer">
        <img src="mono.png" alt="Flowtech" style="height:30px;display:block;opacity:.45"/>
        <div class="footer-pg">Página ${idx + 1} de ${samples.length}</div>
      </div>`;

    container.appendChild(paper);
    wirePaper(paper, d);
  });
}

// Wire up live status overrides + recommendation regeneration for one paper.
function wirePaper(paper, sample) {
  const groups = {};
  paper.querySelectorAll('.status-group[data-kind]').forEach(g => {
    groups[g.dataset.kind] = {
      el: g,
      level: g.querySelector('.status-select').value,
      badge: g.querySelector('.status-badge'),
      select: g.querySelector('.status-select'),
    };
  });

  const isoKpi = paper.querySelector('.iso-kpi');
  const waterKpi = paper.querySelector('.water-kpi');
  const isoDot = paper.querySelector('.iso-dot');
  const recDot = paper.querySelector('.rec-dot');
  const recSection = paper.querySelector('.rec-section');
  const recLabel = paper.querySelector('.rec-label');
  const recBox = paper.querySelector('.editable-rec');

  function kpiClass(level) {
    return level === 'error' ? ' error'
      : level === 'critical' ? ' critical'
      : level === 'warning' ? ' warning' : '';
  }
  const recBg = { critical: '#fff8f5', warning: '#fffde6', normal: '#f5fff8' };

  function apply() {
    const isoLevel = groups.iso.level;
    const waterLevel = groups.water.level;

    // Record the displayed status on the sample so exports/history reflect
    // manual overrides instead of recomputing.
    sample._isoLevel = isoLevel;
    sample._waterLevel = waterLevel;

    isoKpi.className = 'kpi-value iso-kpi' + kpiClass(isoLevel);
    waterKpi.className = 'kpi-value water-kpi' + kpiClass(waterLevel);
    isoDot.style.background = LEVELS[isoLevel].color;

    const worse = ['error', 'critical', 'warning', 'normal'].find(l => isoLevel === l || waterLevel === l);
    recDot.style.background = LEVELS[worse].color;
    recSection.style.borderLeftColor = LEVELS[worse].color;
    recSection.style.background = recBg[worse];
    recLabel.style.color = LEVELS[worse].color;

    recBox.value = buildRecommendation(isoLevel, waterLevel, sample.waterKFppm);
    autoSize(recBox);
  }

  Object.values(groups).forEach(g => {
    g.select.addEventListener('change', () => {
      g.level = g.select.value;
      const L = LEVELS[g.level];
      g.badge.className = `status-badge ${L.key}`;
      g.badge.textContent = L.label;
      apply();
    });
  });

  apply();

  paper.querySelectorAll('.editable-rec').forEach(ta => {
    setTimeout(() => autoSize(ta), 50);
    ta.addEventListener('input', () => autoSize(ta));
  });
}

function autoSize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}
