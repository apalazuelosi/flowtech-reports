// Modal UI for managing clients: pick the active one, create, edit, delete.
// A client carries limits (ISO codes + water ppm), an optional logo, a default
// "generado por", and notes. Saves go to Supabase via js/clients.js.

import {
  getClientsCached, getActiveClient, setActiveClient,
  saveClient, deleteClient, blankClient, getClient, loadClients, isOffline,
} from './clients.js';
import { fmtISO } from './classify.js';

let overlay, onChangeCb;

export function initClientEditor(onChange) {
  onChangeCb = onChange;
  overlay = document.getElementById('client-modal');
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

export function openClientManager() {
  renderList();
  overlay.classList.add('open');
}

const close = () => overlay.classList.remove('open');
const esc = s => (s || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function offlineBanner() {
  return isOffline()
    ? '<p style="font-size:.8rem;color:#b8860b;background:#fffbe6;padding:8px 12px;border-radius:8px;margin-bottom:14px">⚠ Sin conexión con la base de datos — los cambios no se guardarán. Verifica la configuración de Supabase.</p>'
    : '';
}

function renderList() {
  const active = getActiveClient();
  const items = getClientsCached().map(c => `
    <div class="profile-item${active && c.id === active.id ? ' active' : ''}" data-id="${c.id}">
      ${c.logo ? `<img src="${c.logo}" alt="" style="height:26px;width:26px;object-fit:contain;border-radius:4px;background:#f4f4f4"/>` : ''}
      <div style="flex:1">
        <div class="pi-name">${esc(c.name)}</div>
        <div class="pi-meta">ISO ${fmtISO(c.iso.warn)} / ${fmtISO(c.iso.crit)} · Agua ${c.water.warn}/${c.water.crit} ppm</div>
      </div>
      <button class="link-btn pi-edit" data-id="${c.id}">Editar</button>
      ${c._offline ? '' : `<button class="link-btn pi-del" data-id="${c.id}" style="color:#c00">Eliminar</button>`}
    </div>`).join('');

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h2>Clientes</h2><button class="modal-close" id="cm-x">×</button></div>
      <div class="modal-body">
        ${offlineBanner()}
        <p style="font-size:.82rem;color:#777;margin-bottom:14px">Selecciona el cliente activo. Sus límites definen los estados de ISO y agua, y su logo/datos se usan en el reporte.</p>
        <div class="profile-list">${items || '<p style="color:#999;font-size:.85rem">No hay clientes todavía.</p>'}</div>
        <button class="btn btn-orange" id="cm-new" ${isOffline() ? 'disabled' : ''}>+ Nuevo cliente</button>
      </div>
      <div class="modal-foot"><button class="btn" id="cm-done">Listo</button></div>
    </div>`;

  overlay.querySelector('#cm-x').onclick = close;
  overlay.querySelector('#cm-done').onclick = close;
  overlay.querySelector('#cm-new').onclick = () => renderEdit(blankClient());

  overlay.querySelectorAll('.profile-item').forEach(it => {
    it.addEventListener('click', e => {
      if (e.target.closest('.pi-edit') || e.target.closest('.pi-del')) return;
      setActiveClient(it.dataset.id);
      onChangeCb?.();
      renderList();
    });
  });
  overlay.querySelectorAll('.pi-edit').forEach(b =>
    b.onclick = () => renderEdit(structuredClone(getClient(b.dataset.id))));
  overlay.querySelectorAll('.pi-del').forEach(b =>
    b.onclick = async () => {
      if (!confirm('¿Eliminar este cliente?')) return;
      b.disabled = true;
      try { await deleteClient(b.dataset.id); onChangeCb?.(); renderList(); }
      catch (err) { alert('No se pudo eliminar: ' + err.message); b.disabled = false; }
    });
}

function isoBoxes(prefix, code) {
  return `<div class="iso-inputs">
    <input class="text-input" id="${prefix}-p4" type="number" min="0" max="30" value="${code.p4}"/>
    <span class="iso-sep">/</span>
    <input class="text-input" id="${prefix}-p6" type="number" min="0" max="30" value="${code.p6}"/>
    <span class="iso-sep">/</span>
    <input class="text-input" id="${prefix}-p14" type="number" min="0" max="30" value="${code.p14}"/>
  </div>`;
}

function renderEdit(client) {
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h2>${client.id ? 'Editar cliente' : 'Nuevo cliente'}</h2><button class="modal-close" id="ce-x">×</button></div>
      <div class="modal-body">
        ${offlineBanner()}
        <div class="field-block">
          <label class="field-label">Nombre del cliente / empresa</label>
          <input class="text-input" id="ce-name" value="${esc(client.name)}" placeholder="Ej. Aceros del Norte"/>
        </div>
        <div class="field-row" style="gap:14px">
          <div class="field-block" style="flex:1">
            <label class="field-label">Generado por (por defecto)</label>
            <input class="text-input" id="ce-genby" value="${esc(client.default_generated_by)}" placeholder="Ej. Ramiro Oropeza"/>
          </div>
          <div class="field-block" style="flex:0 0 auto">
            <label class="field-label">Logo</label>
            <div style="display:flex;align-items:center;gap:8px">
              <img id="ce-logo-preview" src="${client.logo || ''}" alt="" style="height:34px;width:34px;object-fit:contain;border-radius:6px;background:#f0f0f0;${client.logo ? '' : 'display:none'}"/>
              <label class="btn-tertiary" style="cursor:pointer;margin:0">Subir<input id="ce-logo" type="file" accept="image/*" style="display:none"/></label>
              <button class="link-btn" id="ce-logo-clear" type="button" style="${client.logo ? '' : 'display:none'}">Quitar</button>
            </div>
          </div>
        </div>
        <div class="section-divider"></div>
        <div class="modal-section-title">Límites ISO 4406 (4µm / 6µm / 14µm)</div>
        <div class="limits-grid">
          <div class="limit-block">
            <h5>Precaución a partir de</h5>
            ${isoBoxes('ce-isow', client.iso.warn)}
            <span class="hint">Cualquier componente ≥ este código → precaución</span>
          </div>
          <div class="limit-block">
            <h5>Crítico a partir de</h5>
            ${isoBoxes('ce-isoc', client.iso.crit)}
            <span class="hint">Cualquier componente ≥ este código → crítico</span>
          </div>
        </div>
        <div class="section-divider"></div>
        <div class="modal-section-title">Límites de agua (ppm KF)</div>
        <div class="limits-grid">
          <div class="limit-block"><h5>Precaución (ppm)</h5><input class="text-input" id="ce-watw" type="number" min="0" value="${client.water.warn}"/></div>
          <div class="limit-block"><h5>Crítico (ppm)</h5><input class="text-input" id="ce-watc" type="number" min="0" value="${client.water.crit}"/></div>
        </div>
        <div id="ce-err" style="display:none;color:var(--orange);font-size:.82rem;margin-top:14px"></div>
      </div>
      <div class="modal-foot">
        <button class="btn-tertiary" id="ce-back">← Volver</button>
        <button class="btn btn-orange" id="ce-save" ${isOffline() ? 'disabled' : ''}>Guardar cliente</button>
      </div>
    </div>`;

  let logoData = client.logo || null;
  const preview = overlay.querySelector('#ce-logo-preview');
  const clearBtn = overlay.querySelector('#ce-logo-clear');
  overlay.querySelector('#ce-logo').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 400 * 1024) { alert('El logo debe pesar menos de 400 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { logoData = reader.result; preview.src = logoData; preview.style.display = ''; clearBtn.style.display = ''; };
    reader.readAsDataURL(file);
  });
  clearBtn.onclick = () => { logoData = null; preview.style.display = 'none'; clearBtn.style.display = 'none'; };

  overlay.querySelector('#ce-x').onclick = close;
  overlay.querySelector('#ce-back').onclick = renderList;
  overlay.querySelector('#ce-save').onclick = async () => {
    const err = overlay.querySelector('#ce-err');
    const name = val('ce-name').trim();
    if (!name) { err.textContent = 'Ingresa un nombre para el cliente.'; err.style.display = 'block'; return; }
    client.name = name;
    client.default_generated_by = val('ce-genby').trim() || null;
    client.logo = logoData;
    client.iso = { warn: readIso('ce-isow'), crit: readIso('ce-isoc') };
    client.water = { warn: num('ce-watw'), crit: num('ce-watc') };
    const btn = overlay.querySelector('#ce-save');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const saved = await saveClient(client);
      setActiveClient(saved.id);
      onChangeCb?.();
      renderList();
    } catch (e) {
      err.textContent = 'No se pudo guardar: ' + e.message; err.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Guardar cliente';
    }
  };
}

const val = id => document.getElementById(id).value;
const num = id => Number(document.getElementById(id).value) || 0;
const readIso = prefix => ({ p4: num(prefix + '-p4'), p6: num(prefix + '-p6'), p14: num(prefix + '-p14') });
