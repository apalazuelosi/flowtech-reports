// Modal UI for managing company profiles: pick the active one, create, edit,
// or delete. Limits are edited as ISO codes (three boxes) and water ppm.

import {
  getProfiles, getActiveProfile, setActiveProfile,
  saveProfile, deleteProfile, blankProfile, getProfile,
} from './profiles.js';
import { fmtISO } from './classify.js';

let overlay, onChangeCb;

export function initProfileEditor(onChange) {
  onChangeCb = onChange;
  overlay = document.getElementById('profile-modal');
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

export function openProfileManager() {
  renderList();
  overlay.classList.add('open');
}

function close() {
  overlay.classList.remove('open');
}

function renderList() {
  const active = getActiveProfile();
  const items = getProfiles().map(p => `
    <div class="profile-item${p.id === active.id ? ' active' : ''}" data-id="${p.id}">
      <div style="flex:1">
        <div class="pi-name">${esc(p.name)}${p.builtIn ? ' <span class="pi-meta">· por defecto</span>' : ''}</div>
        <div class="pi-meta">ISO ${fmtISO(p.iso.warn)} / ${fmtISO(p.iso.crit)} · Agua ${p.water.warn}/${p.water.crit} ppm</div>
      </div>
      <button class="link-btn pi-edit" data-id="${p.id}">Editar</button>
      ${p.builtIn ? '' : `<button class="link-btn pi-del" data-id="${p.id}" style="color:#c00">Eliminar</button>`}
    </div>`).join('');

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h2>Perfiles de Empresa</h2><button class="modal-close" id="pm-x">×</button></div>
      <div class="modal-body">
        <p style="font-size:.82rem;color:#777;margin-bottom:14px">Selecciona el perfil activo. Sus límites definen qué se considera aceptable, precaución o crítico para ISO y agua.</p>
        <div class="profile-list">${items}</div>
        <button class="btn btn-orange" id="pm-new">+ Nuevo perfil</button>
      </div>
      <div class="modal-foot"><button class="btn" id="pm-done">Listo</button></div>
    </div>`;

  overlay.querySelector('#pm-x').onclick = close;
  overlay.querySelector('#pm-done').onclick = close;
  overlay.querySelector('#pm-new').onclick = () => renderEdit(blankProfile());

  overlay.querySelectorAll('.profile-item').forEach(it => {
    it.addEventListener('click', e => {
      if (e.target.closest('.pi-edit') || e.target.closest('.pi-del')) return;
      setActiveProfile(it.dataset.id);
      onChangeCb?.();
      renderList();
    });
  });
  overlay.querySelectorAll('.pi-edit').forEach(b =>
    b.onclick = () => renderEdit(structuredClone(getProfile(b.dataset.id))));
  overlay.querySelectorAll('.pi-del').forEach(b =>
    b.onclick = () => {
      if (confirm('¿Eliminar este perfil?')) { deleteProfile(b.dataset.id); onChangeCb?.(); renderList(); }
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

function renderEdit(profile) {
  const ro = profile.builtIn ? 'disabled' : '';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h2>${profile.id ? 'Editar perfil' : 'Nuevo perfil'}</h2><button class="modal-close" id="pe-x">×</button></div>
      <div class="modal-body">
        ${profile.builtIn ? '<p style="font-size:.8rem;color:#b8860b;background:#fffbe6;padding:8px 12px;border-radius:8px;margin-bottom:16px">El perfil por defecto no se puede modificar. Crea uno nuevo para personalizar límites.</p>' : ''}
        <div class="field-block">
          <label class="field-label">Nombre del perfil / empresa</label>
          <input class="text-input" id="pe-name" value="${esc(profile.name)}" placeholder="Ej. Aceros del Norte" ${ro}/>
        </div>
        <div class="section-divider"></div>
        <div class="modal-section-title">Límites ISO 4406 (4µm / 6µm / 14µm)</div>
        <div class="limits-grid">
          <div class="limit-block">
            <h5>Precaución a partir de</h5>
            ${isoBoxes('pe-isow', profile.iso.warn)}
            <span class="hint">Cualquier componente ≥ este código → precaución</span>
          </div>
          <div class="limit-block">
            <h5>Crítico a partir de</h5>
            ${isoBoxes('pe-isoc', profile.iso.crit)}
            <span class="hint">Cualquier componente ≥ este código → crítico</span>
          </div>
        </div>
        <div class="section-divider"></div>
        <div class="modal-section-title">Límites de agua (ppm KF)</div>
        <div class="limits-grid">
          <div class="limit-block">
            <h5>Precaución (ppm)</h5>
            <input class="text-input" id="pe-watw" type="number" min="0" value="${profile.water.warn}" ${ro}/>
          </div>
          <div class="limit-block">
            <h5>Crítico (ppm)</h5>
            <input class="text-input" id="pe-watc" type="number" min="0" value="${profile.water.crit}" ${ro}/>
          </div>
        </div>
        <div id="pe-err" style="display:none;color:var(--orange);font-size:.82rem;margin-top:14px"></div>
      </div>
      <div class="modal-foot">
        <button class="btn-tertiary" id="pe-back">← Volver</button>
        ${profile.builtIn ? '' : '<button class="btn btn-orange" id="pe-save">Guardar perfil</button>'}
      </div>
    </div>`;

  overlay.querySelector('#pe-x').onclick = close;
  overlay.querySelector('#pe-back').onclick = renderList;
  const saveBtn = overlay.querySelector('#pe-save');
  if (saveBtn) saveBtn.onclick = () => {
    const err = overlay.querySelector('#pe-err');
    const name = val('pe-name').trim();
    if (!name) { err.textContent = 'Ingresa un nombre para el perfil.'; err.style.display = 'block'; return; }
    profile.name = name;
    profile.iso.warn = readIso('pe-isow');
    profile.iso.crit = readIso('pe-isoc');
    profile.water.warn = num('pe-watw');
    profile.water.crit = num('pe-watc');
    const saved = saveProfile(profile);
    setActiveProfile(saved.id);
    onChangeCb?.();
    renderList();
  };
}

const val = id => document.getElementById(id).value;
const num = id => Number(document.getElementById(id).value) || 0;
const readIso = prefix => ({ p4: num(prefix + '-p4'), p6: num(prefix + '-p6'), p14: num(prefix + '-p14') });
const esc = s => (s || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
