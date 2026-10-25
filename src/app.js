'use strict';
const E = RoomEngine,
  $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  NS = 'http://www.w3.org/2000/svg',
  KEY = 'room-study-plan-v1';

const { fresh, validate } = RoomModel;
function allItems() {
  return [state.bathroom, state.sink, ...state.items].filter((i) => i.enabled !== false);
}
let state = fresh(),
  storageOK = true;
const storage = {
  getItem(key) {
    return globalThis.localStorage.getItem(key);
  },
  setItem(key, value) {
    return globalThis.localStorage.setItem(key, value);
  },
};
try {
  const v = storage.getItem(KEY);
  if (v) state = validate(JSON.parse(v));
} catch (e) {
  storageOK = false;
}
let tab = 'room',
  selected = null,
  activeWall = null,
  arrange = true,
  zoom = 1,
  reference = false,
  history = [],
  future = [],
  solved,
  g,
  poly,
  drag = null,
  toastTimer;
const unitFactor = () => RoomModel.unitFactor(state.unit),
  unitLabel = () => RoomModel.unitLabel(state.unit);
const fmt = (v) => RoomModel.fmt(v, state.unit),
  num = (v) => RoomModel.num(v, state.unit),
  parsePosition = (v) => RoomModel.parsePosition(v, state.unit);
function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
function checkpoint() {
  history.push(JSON.stringify(state));
  if (history.length > 60) history.shift();
  future = [];
}
function save() {
  try {
    storage.setItem(KEY, JSON.stringify(state));
    storageOK = true;
  } catch (e) {
    storageOK = false;
  }
  renderSaveStatus();
}
function toast(msg) {
  $('#toast').textContent = msg;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}
function recalc() {
  solved = E.solve(state.known, state.shape);
  g = E.geometry(solved.values, state.shape);
  poly = E.points(g, state.shape);
}
function itemRect(i) {
  let r = g.W / 600,
    w = i.w || i.bw * r,
    d = i.d || i.bd * r;
  return { x: i.x * g.W, y: i.y * g.H, w: i.rot % 180 ? d : w, h: i.rot % 180 ? w : d };
}
function fixedRects() {
  return [];
}
function invalidGeometry() {
  if (state.shape === 'rectangle') return g.W <= 0 || g.H <= 0;
  if (state.shape === 'l')
    return g.NW >= g.W || g.ND >= g.H || Object.values(solved.values).some((v) => v <= 0);
  return (
    Object.values(solved.values).some((v) => v <= 0) ||
    g.L + g.NW > g.W - g.R - g.EW + 0.01 ||
    g.ND >= g.H ||
    g.EW + g.R >= g.W ||
    g.R < 0 ||
    Math.abs(g.L + g.NW + g.M + g.EW + g.R - g.W) > 0.1 ||
    Math.abs(g.NT + g.ND - g.H) > 0.1
  );
}
function measureRow(key, name, letter, detail, val, derived, section) {
  let status = val != null ? (derived ? 'CALCULATED' : 'MEASURED') : 'UNKNOWN';
  return `<div class="measurement-row ${derived ? 'derived' : ''} ${activeWall === key ? 'selected' : ''}" id="row-${key}"><label class="row-label" for="input-${key}">${letter ? `<span class="letter">${letter}</span>` : ''}${name}<span class="row-status ${derived ? 'derived' : ''}">${status}</span></label><div class="input-wrap"><input id="input-${key}" data-field="${key}" data-section="${section}" inputmode="decimal" autocomplete="off" value="${val != null ? fmt(val) : ''}" placeholder="${state.unit === 'ft' ? `e.g. 8' 6&quot;` : 'Unknown'}" aria-describedby="detail-${key}"><span class="suffix">${unitLabel()}</span></div><div class="row-detail" id="detail-${key}">${detail}</div></div>`;
}
function renderMeasurements() {
  const list = $('#measurementList');
  if (tab === 'room') {
    list.innerHTML =
      '<div class="list-label">The outline · from your sketch</div>' +
      E.fieldsFor(state.shape)
        .map(([k, n, l, d]) =>
          measureRow(k, n, l, d, solved.values[k], k in solved.derived, 'room'),
        )
        .join('') +
      `<p class="section-note">${state.shape === 'study' ? 'A = C + D + G + H + I<br>B = F + E<br>' : state.shape === 'l' ? 'B = F + E<br>' : ''}Clear any field to leave it unknown.</p>`;
  } else if (tab === 'furniture') {
    list.innerHTML =
      '<p class="section-note">Drag any piece on the plan to move it. Select it for measurements and left / right rotation controls.</p>' +
      allItems()
        .map(
          (i) =>
            `<button class="furniture-row ${selected === i.id ? 'active' : ''}" data-item="${esc(i.id)}"><span class="swatch" style="background:${i.color}"></span><span><b>${esc(i.name)}</b><small>${i.w && i.d ? fmt(i.w) + ' × ' + fmt(i.d) + ' ' + unitLabel() : 'Size not measured yet'}</small></span><span>↗</span></button>`,
        )
        .join('') +
      '<button class="add-button" id="addFurniture">+ Add furniture</button>';
  } else {
    const f = state.fixtures;
    list.innerHTML =
      `<div class="feature-toggles"><label><input type="checkbox" data-feature="bathroom" ${state.bathroom.enabled !== false ? 'checked' : ''}> Include bathroom</label><label><input type="checkbox" data-feature="sink" ${state.sink.enabled !== false ? 'checked' : ''}> Include sink</label></div>` +
      '<p class="section-note">Bathroom and sink can both move and rotate. Select either on the plan, or enter their sizes below.</p><h3 class="fixture-head">Bathroom · editable</h3><button class="add-button" data-item="bathroom" style="margin:0 0 15px">Select bathroom · move & rotate ↗</button>' +
      measureRow(
        'BW',
        'Bathroom width',
        null,
        'Width before rotation',
        state.bathroom.w,
        false,
        'bathroom',
      ) +
      measureRow(
        'BD',
        'Bathroom depth',
        null,
        'Depth before rotation',
        state.bathroom.d,
        false,
        'bathroom',
      ) +
      '<h3 class="fixture-head">Sink · editable</h3><button class="add-button" data-item="sink" style="margin:0 0 15px">Select sink · move & rotate ↗</button>' +
      measureRow('SW', 'Sink width', null, 'Width before rotation', state.sink.w, false, 'sink') +
      measureRow('SD', 'Sink depth', null, 'Depth before rotation', state.sink.d, false, 'sink') +
      `<h3 class="fixture-head">Window · left wall</h3><label class="window-toggle"><input type="checkbox" id="windowEnabled" ${f.windowEnabled !== false ? 'checked' : ''}> Include window</label>` +
      measureRow(
        'WO',
        'Offset from top',
        null,
        'Top corner to the start of the window',
        f.WO,
        false,
        'fixture',
      ) +
      measureRow(
        'WL',
        'Window length',
        null,
        'Opening length along the left wall',
        f.WL,
        false,
        'fixture',
      );
  }
  if ($('#windowEnabled'))
    $('#windowEnabled').onchange = () => {
      checkpoint();
      state.fixtures.windowEnabled = $('#windowEnabled').checked;
      render();
      save();
    };
  list.querySelectorAll('[data-feature]').forEach(
    (input) =>
      (input.onchange = () => {
        checkpoint();
        state[input.dataset.feature].enabled = input.checked;
        selected = null;
        render();
        save();
      }),
  );
  list.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener('focus', () => {
      if (input.dataset.section === 'room') {
        activeWall = input.dataset.field;
        draw();
      }
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('change', () => {
      let val = ['SY', 'WO'].includes(input.dataset.field)
        ? parsePosition(input.value)
        : num(input.value);
      if (
        Number.isNaN(val) ||
        val > 1e6 ||
        (val !== null && val <= 0 && !['SY', 'WO'].includes(input.dataset.field))
      ) {
        toast('Enter a positive measurement, or leave it blank.');
        renderMeasurements();
        return;
      }
      checkpoint();
      let feature = ['bathroom', 'sink'].includes(input.dataset.section),
        target =
          input.dataset.section === 'room'
            ? state.known
            : feature
              ? state[input.dataset.section]
              : state.fixtures,
        key = feature
          ? ['BW', 'SW'].includes(input.dataset.field)
            ? 'w'
            : 'd'
          : input.dataset.field;
      if (val == null) {
        if (feature) target[key] = null;
        else delete target[key];
      } else target[key] = val;
      render();
      save();
    });
  });
  list
    .querySelectorAll('[data-item]')
    .forEach((b) => (b.onclick = () => selectItem(b.dataset.item)));
  if ($('#addFurniture')) $('#addFurniture').onclick = () => $('#addDialog').showModal();
}
function svg(tag, attrs = {}, parent = $('#plan')) {
  let n = document.createElementNS(NS, tag);
  for (let k in attrs) n.setAttribute(k, attrs[k]);
  parent.append(n);
  return n;
}
function textAt(x, y, str, attrs = {}, parent) {
  let t = svg('text', { x, y, ...attrs }, parent);
  t.textContent = str;
  return t;
}
function dimension(key, x1, y1, x2, y2) {
  let value = solved.values[key],
    letter = E.fieldsFor(state.shape).find((f) => f[0] === key)[2],
    cls = value != null ? (key in solved.derived ? 'derived' : 'measured') : 'unknown';
  let group = svg('g', {
    class: `dim ${cls} ${activeWall === key ? 'active' : ''}`,
    role: 'button',
    tabindex: 0,
    'aria-label': `${letter}: ${E.fieldsFor(state.shape).find((f) => f[0] === key)[1]}, ${value != null ? fmt(value) + ' ' + unitLabel() : 'unknown'}`,
  });
  svg('line', { x1, y1, x2, y2 }, group);
  let vertical = x1 === x2;
  for (let [x, y] of [
    [x1, y1],
    [x2, y2],
  ])
    svg(
      'line',
      {
        x1: x - (vertical ? 4 : 0),
        y1: y - (vertical ? 0 : 4),
        x2: x + (vertical ? 4 : 0),
        y2: y + (vertical ? 0 : 4),
      },
      group,
    );
  let x = (x1 + x2) / 2,
    y = (y1 + y2) / 2,
    label = letter + ' · ' + (value != null ? fmt(value) : '?'),
    w = Math.max(39, label.length * 5.4 + 12);
  svg('rect', { x: x - w / 2, y: y - 9, width: w, height: 18, rx: 4, class: 'pill' }, group);
  textAt(x, y + 3, label, { 'text-anchor': 'middle' }, group);
  group.onclick = () => focusWall(key);
  group.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      focusWall(key);
    }
  };
}
function focusWall(k) {
  tab = 'room';
  activeWall = k;
  renderMeasurements();
  renderTabs();
  draw();
  let input = $('#input-' + k);
  input.focus();
  input.select();
  input.closest('.measurement-row').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function draw() {
  const plan = $('#plan');
  plan.replaceChildren();
  let ratio = g.W / 600;
  // Keep type and controls legible as real dimensions change.
  const s = 600 / g.W,
    gg = {};
  for (let k in g) gg[k] = g[k] * s;
  const p = poly.map(([x, y]) => [x * s, y * s]);
  let { W, H, L, NW, ND, EW, R, ED = 0, NT } = gg;
  let boundsW = W + 155,
    boundsH = H + ED + 130;
  let vw = boundsW / zoom,
    vh = boundsH / zoom;
  plan.setAttribute('viewBox', `${(W - vw) / 2 - 12} ${(H + ED - vh) / 2 - 2} ${vw} ${vh}`);
  const defs = svg('defs');
  let pattern = svg(
    'pattern',
    { id: 'floor', patternUnits: 'userSpaceOnUse', width: 22, height: 40 },
    defs,
  );
  svg('rect', { width: 22, height: 40, fill: '#efebdf' }, pattern);
  svg(
    'path',
    {
      d: 'M 0 0 H 22 M 0 40 H 22 M 22 0 V 40',
      fill: 'none',
      stroke: '#ddd8c9',
      'stroke-width': '.5',
    },
    pattern,
  );
  svg('path', { d: 'M 5 0 V 40 M 12 0 V 40', stroke: '#e7e1d3', 'stroke-width': '.4' }, pattern);
  let hatch = svg(
    'pattern',
    {
      id: 'hatch',
      width: 6,
      height: 6,
      patternUnits: 'userSpaceOnUse',
      patternTransform: 'rotate(45)',
    },
    defs,
  );
  svg('rect', { width: 6, height: 6, fill: '#eaece5' }, hatch);
  svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#dce1d3', 'stroke-width': 1 }, hatch);
  let floor = svg('polygon', {
    points: p.map((a) => a.join(',')).join(' '),
    fill: 'url(#floor)',
    stroke: '#6f7c64',
    'stroke-width': 3,
    'stroke-linejoin': 'miter',
  });
  floor.onclick = () => {
    selected = null;
    renderInspector();
    draw();
  };
  // Entry opening is left open, as in the reference. No swing direction is assumed.
  if (state.shape === 'study') {
    svg('line', {
      x1: W - R - EW + 0.5,
      y1: H + ED,
      x2: W - R - 0.5,
      y2: H + ED,
      stroke: '#f6f7f1',
      'stroke-width': 5,
    });
    svg('line', {
      x1: W - R - EW,
      y1: H + ED,
      x2: W - R,
      y2: H + ED,
      stroke: '#a0ad91',
      'stroke-width': 1,
      'stroke-dasharray': '3 3',
    });
    textAt(W - R - EW / 2, H + ED - 15, 'ENTRANCE', {
      'text-anchor': 'middle',
      class: 'floor-label',
    });
  }
  let fs = fixedRects();
  let f = state.fixtures,
    wo = (f.WO ?? 0) * s,
    wl = (f.WL ?? g.H) * s;
  if (f.windowEnabled !== false) {
    svg('line', { x1: 0, y1: wo, x2: 0, y2: wo + wl, stroke: '#9eb6ab', 'stroke-width': 5 });
    svg('line', { x1: 0, y1: wo, x2: 0, y2: wo + wl, stroke: '#e5eeea', 'stroke-width': 2 });
    textAt(10, H / 2, 'WINDOW', {
      'font-size': 7,
      'letter-spacing': 1.5,
      fill: '#859f92',
      transform: `rotate(-90 10 ${H / 2})`,
    });
  }
  let badIds = new Set(),
    rects = allItems().map((i) => ({ ...itemRect(i), id: i.id }));
  for (let a of rects) {
    if (
      !E.fits(a, poly) ||
      fs.some((b) => E.overlap(a, b)) ||
      rects.some((b) => a.id !== b.id && E.overlap(a, b))
    )
      badIds.add(a.id);
  }
  for (let i of allItems()) {
    let r = itemRect(i),
      x = r.x * s,
      y = r.y * s,
      bboxW = r.w * s,
      bboxH = r.h * s,
      w = (i.w || i.bw * ratio) * s,
      h = (i.d || i.bd * ratio) * s;
    let group = svg('g', {
      class: `furniture ${selected === i.id ? 'selected' : ''} ${!i.locked ? 'movable' : ''} ${badIds.has(i.id) ? 'invalid' : ''}`,
      role: 'button',
      tabindex: 0,
      'data-piece': i.id,
      'aria-label': `${i.name}${i.locked ? ', locked' : ''}`,
      transform: `translate(${x} ${y})`,
    });
    const rotation =
      i.rot === 90
        ? `translate(${h} 0) rotate(90)`
        : i.rot === 180
          ? `translate(${w} ${h}) rotate(180)`
          : i.rot === 270
            ? `translate(0 ${w}) rotate(270)`
            : '';
    const surface = svg('g', { 'data-orientation': i.rot, transform: rotation }, group);
    svg('rect', { x: 1.5, y: 2.5, width: w, height: h, rx: 2, fill: '#4c513416' }, surface);
    svg(
      'rect',
      {
        width: w,
        height: h,
        rx: 2,
        fill: i.type === 'bathroom' ? 'url(#hatch)' : i.color,
        class: 'outline',
      },
      surface,
    );
    const light = '#ffffff60',
      stroke = '#6e775540';
    if (i.type === 'bed') {
      const pad = Math.min(7, w / 10, h / 10),
        ph = Math.min(32, h * 0.22);
      svg(
        'rect',
        { x: pad, y: pad, width: Math.max(1, w - 2 * pad), height: ph, rx: 3, fill: light, stroke },
        surface,
      );
      svg(
        'line',
        { x1: pad, y1: Math.min(h * 0.28, 45), x2: w - pad, y2: Math.min(h * 0.28, 45), stroke },
        surface,
      );
      svg(
        'rect',
        {
          x: pad,
          y: h * 0.32,
          width: Math.max(1, w - 2 * pad),
          height: h * 0.62,
          rx: 2,
          fill: '#fff2',
        },
        surface,
      );
    } else if (i.type === 'sofa') {
      svg(
        'rect',
        {
          x: 6,
          y: 6,
          width: Math.max(2, w - 12),
          height: Math.max(2, h - 12),
          rx: 3,
          fill: light,
          stroke,
        },
        surface,
      );
      svg('line', { x1: w / 2, y1: 6, x2: w / 2, y2: h - 6, stroke }, surface);
      svg(
        'line',
        { x1: 6, y1: 6, x2: w - 6, y2: 6, stroke: '#6e775570', 'stroke-width': 3 },
        surface,
      );
    } else if (i.type === 'wardrobe') {
      svg('line', { x1: w / 2, y1: 0, x2: w / 2, y2: h, stroke }, surface);
      svg(
        'line',
        { x1: w / 2 - 4, y1: h * 0.4, x2: w / 2 - 4, y2: h * 0.6, stroke: '#6e775580' },
        surface,
      );
      svg(
        'line',
        { x1: w / 2 + 4, y1: h * 0.4, x2: w / 2 + 4, y2: h * 0.6, stroke: '#6e775580' },
        surface,
      );
    } else if (i.type === 'sink') {
      const pad = Math.min(5, w / 5, h / 5);
      svg(
        'rect',
        {
          x: pad,
          y: pad * 1.8,
          width: Math.max(1, w - 2 * pad),
          height: Math.max(1, h - pad * 3.6),
          rx: Math.min(10, w / 3),
          fill: '#f8fbf6',
          stroke: '#a7b8a6',
          'stroke-width': 1,
        },
        surface,
      );
      svg('circle', { cx: w / 2, cy: h * 0.34, r: Math.min(2, w / 10), fill: '#98ad9e' }, surface);
    } else if (i.type === 'tv')
      svg(
        'rect',
        {
          x: w * 0.18,
          y: 3,
          width: w * 0.64,
          height: Math.max(2, h * 0.18),
          rx: 1,
          fill: '#5d685590',
        },
        surface,
      );
    else if (i.type !== 'bathroom')
      svg(
        'rect',
        {
          x: 4,
          y: 4,
          width: Math.max(1, w - 8),
          height: Math.max(1, h - 8),
          rx: 2,
          fill: '#fff1',
          stroke,
        },
        surface,
      );
    let name = i.name === 'Bedside stand' ? 'Stand' : i.name,
      font = Math.min(11, Math.max(5.5, bboxW / (name.length * 0.6 + 1)));
    textAt(
      bboxW / 2,
      bboxH / 2 + 3,
      name,
      { 'text-anchor': 'middle', 'font-size': font, fill: '#38442f', 'font-weight': 500 },
      group,
    );
    if (i.type === 'bathroom' && bboxW > 65 && bboxH > 50)
      textAt(
        bboxW / 2,
        bboxH / 2 + 17,
        i.w && i.d ? fmt(i.w) + ' × ' + fmt(i.d) : 'CLICK TO MEASURE',
        { 'text-anchor': 'middle', 'font-size': 6.5, 'letter-spacing': 0.6, fill: '#86927b' },
        group,
      );
    if (!i.w || !i.d)
      textAt(
        bboxW - 5,
        bboxH - 4,
        '~',
        { 'text-anchor': 'end', 'font-size': 10, fill: '#6c775a' },
        group,
      );
    group.onpointerdown = (ev) => startDrag(ev, i);
    group.onkeydown = (ev) => itemKey(ev, i);
  }
  renderCanvasTools();
  dimension('W', 0, -25, W, -25);
  dimension('H', -28, 0, -28, H);
  if (state.shape === 'study') {
    dimension('L', 0, H + 21, L, H + 21);
    dimension('NW', L, H - ND + 18, L + NW, H - ND + 18);
    dimension('ND', L + NW + 16, H - ND, L + NW + 16, H);
    dimension('NT', -61, 0, -61, NT);
    dimension('M', L + NW, H + 21, W - R - EW, H + 21);
    dimension('EW', W - R - EW, H + ED + 22, W - R, H + ED + 22);
    dimension('R', W - R, H + 21, W, H + 21);
    dimension('ED', W - R + 25, H, W - R + 25, H + ED);
  } else if (state.shape === 'l') {
    dimension('NW', W - NW, H + 22, W, H + 22);
    dimension('ND', W + 24, H - ND, W + 24, H);
    dimension('NT', W + 24, 0, W + 24, H - ND);
  }
}
function selectItem(id) {
  selected = id;
  activeWall = null;
  renderInspector();
  if (tab === 'furniture') renderMeasurements();
  draw();
}
function renderCanvasTools() {
  const i = allItems().find((o) => o.id === selected),
    tools = $('#objectTools');
  tools.hidden = !i || reference;
  if (!i) return;
  $('#objectName').textContent = i.name;
  $('#objectAngle').textContent = i.rot + '°';
  $('#canvasRotateLeft').disabled = i.locked;
  $('#canvasRotateRight').disabled = i.locked;
  $('#canvasLock').textContent = i.locked ? 'Unlock' : 'Lock';
}
function rotatePiece(id, direction = 1) {
  const i = allItems().find((o) => o.id === id);
  if (!i || i.locked) return;
  checkpoint();
  i.rot = (i.rot + direction * 90 + 360) % 360;
  render();
  save();
  focusPiece(i.id);
}
function toggleLock(id) {
  const i = allItems().find((o) => o.id === id);
  if (!i) return;
  checkpoint();
  i.locked = !i.locked;
  render();
  save();
}
function renderInspector() {
  const panel = $('#selectionPanel'),
    i = allItems().find((o) => o.id === selected);
  if (!i) {
    panel.innerHTML =
      '<div class="inspector-empty">Drag any piece to move it.<br>Select furniture, bathroom, or sink to enter its size. Rotate with ↶ / ↷ or press R.</div>';
    return;
  }
  let r = itemRect(i);
  panel.innerHTML = `<h3 class="selected-name">${esc(i.name)}<span>${i.rot}°</span></h3><p class="furniture-kind">${i.locked ? 'LOCKED IN PLACE' : ['bathroom', 'sink'].includes(i.type) ? 'EDITABLE ' + i.name.toUpperCase() : 'DRAG TO MOVE · R TO ROTATE'}</p><label class="inspector-field">Width · ${unitLabel()}<input data-prop="w" value="${i.w ? fmt(i.w) : ''}" placeholder="Unknown" inputmode="decimal"></label><label class="inspector-field">Depth · ${unitLabel()}<input data-prop="d" value="${i.d ? fmt(i.d) : ''}" placeholder="Unknown" inputmode="decimal"></label><div class="inspector-actions rotation-actions"><button id="rotateItemLeft" ${i.locked ? 'disabled' : ''}>↶ Rotate left</button><button id="rotateItemRight" ${i.locked ? 'disabled' : ''}>↷ Rotate right</button></div><div class="eyebrow" style="margin-top:18px">POSITION IN THIS LAYOUT</div><label class="inspector-field">From left wall · ${unitLabel()}<input data-prop="x" value="${fmt(r.x)}" inputmode="decimal" ${i.locked ? 'disabled' : ''}></label><label class="inspector-field">From top wall · ${unitLabel()}<input data-prop="y" value="${fmt(r.y)}" inputmode="decimal" ${i.locked ? 'disabled' : ''}></label><div class="nudge-controls" aria-label="Move selected object"><button data-nudge="ArrowLeft" ${i.locked ? 'disabled' : ''} aria-label="Move left">←</button><button data-nudge="ArrowUp" ${i.locked ? 'disabled' : ''} aria-label="Move up">↑</button><button data-nudge="ArrowDown" ${i.locked ? 'disabled' : ''} aria-label="Move down">↓</button><button data-nudge="ArrowRight" ${i.locked ? 'disabled' : ''} aria-label="Move right">→</button></div><div class="inspector-actions"><button id="lockItem">${i.locked ? 'Unlock' : 'Lock position'}</button>${!['bathroom', 'sink'].includes(i.type) ? '<button id="removeItem">Remove</button>' : ''}</div><p class="inspector-tip">${!i.w || !i.d ? '~ Unmeasured sizes use sketch proportions. ' : ''}Drag directly on the plan. R rotates 90°; Shift + R turns the other way. Arrow keys move 1 cm; Shift + arrows move 10 cm. Width and depth always refer to the original orientation.</p>`;
  panel.querySelectorAll('[data-prop]').forEach((input) => {
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        input.blur();
      }
    });
    input.onchange = () => {
      let k = input.dataset.prop,
        val = ['x', 'y'].includes(k) ? parsePosition(input.value) : num(input.value);
      if (
        Number.isNaN(val) ||
        val > 1e6 ||
        (['x', 'y'].includes(k) && val > 1000 * (k === 'x' ? g.W : g.H)) ||
        (['w', 'd'].includes(k) && val !== null && val <= 0) ||
        (['x', 'y'].includes(k) && val == null)
      ) {
        toast('Enter a valid measurement.');
        renderInspector();
        return;
      }
      if (i.locked && ['x', 'y'].includes(k)) {
        toast('Unlock this piece to change its position.');
        renderInspector();
        return;
      }
      checkpoint();
      i[k] = k === 'x' ? val / g.W : k === 'y' ? val / g.H : val;
      recalc();
      renderMeasurements();
      renderStats();
      draw();
      save();
    };
  });
  $('#rotateItemLeft').onclick = () => rotatePiece(i.id, -1);
  $('#rotateItemRight').onclick = () => rotatePiece(i.id, 1);
  $('#lockItem').onclick = () => toggleLock(i.id);
  panel
    .querySelectorAll('[data-nudge]')
    .forEach((b) => (b.onclick = () => nudgePiece(i, b.dataset.nudge, 1)));
  if ($('#removeItem'))
    $('#removeItem').onclick = () => {
      checkpoint();
      state.items = state.items.filter((o) => o.id !== i.id);
      selected = null;
      render();
      save();
      toast('Furniture removed. Undo to bring it back.');
    };
}
function allRoomKnown() {
  return (
    E.fieldsFor(state.shape).every((f) => solved.values[f[0]] > 0) &&
    !solved.conflict &&
    !invalidGeometry()
  );
}
function renderStats() {
  let total = E.fieldsFor(state.shape).length,
    count = Object.keys(solved.values).length,
    known = Object.keys(state.known).length,
    derived = Object.keys(solved.derived).length;
  $('#progressCount').textContent = `${count} / ${total}`;
  $('#progressBar').style.width = (count / total) * 100 + '%';
  $('#progressTitle').textContent =
    count === 0
      ? 'A blank canvas'
      : count === total
        ? 'Outline measured'
        : `${known} measured · ${derived} calculated`;
  $('#progressHint').textContent =
    count === total
      ? 'All wall dimensions are resolved. Next, measure your furniture.'
      : `${total - count} dimensions still unknown. Every measurement helps.`;
  let valid = allRoomKnown(),
    areaKnown =
      (state.shape === 'rectangle'
        ? ['W', 'H']
        : state.shape === 'l'
          ? ['W', 'H', 'NW', 'ND']
          : ['W', 'H', 'NW', 'ND', 'EW', 'ED']
      ).every((k) => solved.values[k] > 0) &&
      !solved.conflict &&
      !invalidGeometry(),
    perimeterKnown =
      (state.shape === 'rectangle'
        ? ['W', 'H']
        : state.shape === 'l'
          ? ['W', 'H']
          : ['W', 'H', 'ND', 'ED']
      ).every((k) => solved.values[k] > 0) &&
      !solved.conflict &&
      !invalidGeometry(),
    area = (g.W * g.H - (g.NW || 0) * (g.ND || 0) + (g.EW || 0) * (g.ED || 0)) / 10000;
  $('#areaValue').textContent = areaKnown
    ? (state.unit === 'ft' ? area * 10.7639 : area).toFixed(2)
    : '—';
  $('#areaUnit').textContent = state.unit === 'ft' ? 'ft²' : 'm²';
  $('#areaHint').textContent =
    (areaKnown
      ? 'Gross area inside the room outline.'
      : 'Enter the room dimensions to calculate floor area.') +
    (perimeterKnown
      ? ` Perimeter: ${fmt(2 * (g.W + g.H + (state.shape === 'study' ? g.ND + g.ED : 0)))} ${unitLabel()}.`
      : '');
  if (
    areaKnown &&
    state.bathroom.enabled !== false &&
    state.bathroom.w &&
    state.bathroom.d &&
    E.fits(itemRect(state.bathroom), poly)
  )
    $('#areaHint').textContent +=
      ` Excluding bathroom: ${((g.W * g.H - (g.NW || 0) * (g.ND || 0) + (g.EW || 0) * (g.ED || 0) - state.bathroom.w * state.bathroom.d) / (state.unit === 'ft' ? 929.0304 : 10000)).toFixed(2)} ${state.unit === 'ft' ? 'ft²' : 'm²'}.`;
  $('#scaleBadge').textContent = valid
    ? 'Room outline measured'
    : count
      ? 'Some dimensions still unknown'
      : 'Sketch proportions · unmeasured';
  $('#scaleNote').textContent = valid
    ? 'Room dimensions resolved'
    : '~ Sketch sizes are placeholders';
  let next = E.fieldsFor(state.shape).find((f) => !(f[0] in solved.values));
  $('#nextTitle').textContent = valid
    ? 'Time to make room'
    : solved.conflict
      ? 'Check your measurements'
      : next
        ? `Measure ${next[2]} · ${next[1].toLowerCase()}`
        : 'Check your outline';
  $('#nextHint').textContent = valid
    ? 'Select each piece and add its width and depth. Then move things around to find a layout that works.'
    : solved.conflict
      ? 'Your entered wall lengths do not close the outline. Check the two relationships below.'
      : next?.[3] +
        '. Leave unknown lengths blank; the planner calculates every uniquely determined value.';
  $('#nextBtn').innerHTML =
    (valid ? 'Measure furniture' : 'Enter a measurement') + ' <span>→</span>';
  $('#nextBtn').onclick = () => {
    if (valid) {
      tab = 'furniture';
      renderTabs();
      renderMeasurements();
    } else focusWall((next || E.fieldsFor(state.shape)[0])[0]);
  };
  let warnings = [];
  if (solved.conflict)
    warnings.push(
      'Wall measurements conflict. Check the relationships shown under the room dimensions.',
    );
  if (invalidGeometry())
    warnings.push(
      'These measurements cannot form this room shape. Check the recess and entrance lengths.',
    );
  let fs = fixedRects(),
    rs = allItems().map((i) => ({ ...itemRect(i), id: i.id, name: i.name })),
    outside = rs.filter((r) => !E.fits(r, poly)),
    overlaps = [];
  rs.forEach((a, j) => {
    rs.slice(j + 1)
      .concat(fs)
      .forEach((b) => {
        if (E.overlap(a, b)) overlaps.push(a.name + ' + ' + b.name);
      });
  });
  if (outside.length)
    warnings.push(
      `${outside.map((x) => x.name).join(', ')} ${outside.length > 1 ? 'extend' : 'extends'} beyond the room.`,
    );
  if (overlaps.length) warnings.push('Overlapping: ' + overlaps.join('; ') + '.');
  if ((outside.length || overlaps.length) && (!valid || allItems().some((i) => !i.w || !i.d)))
    warnings.push('Placement checks use preview proportions wherever sizes are unknown.');
  if (fs.some((r) => !E.fits(r, poly)))
    warnings.push('A fixed feature extends beyond the room. Check its size and offset.');
  if (
    state.fixtures.windowEnabled !== false &&
    (state.fixtures.WO || 0) + (state.fixtures.WL || g.H) > g.H + 0.01
  )
    warnings.push('The window extends past the left wall. Check its offset and length.');
  $('#warnings').innerHTML = warnings.map((t) => `<div class="warning">${esc(t)}</div>`).join('');
  $('#undoBtn').disabled = !history.length;
  $('#redoBtn').disabled = !future.length;
}
function renderTabs() {
  $$('[data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-selected', b.dataset.tab === tab);
  });
}
function render() {
  recalc();
  $('#roomShape').value = state.shape;
  $('#units').value = state.unit;
  renderTabs();
  renderMeasurements();
  renderInspector();
  renderStats();
  draw();
  renderSaveStatus();
}
function localPoint(ev) {
  let m = $('#plan').getScreenCTM();
  return new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
}
function startDrag(ev, i) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  ev.stopPropagation();
  const p = localPoint(ev);
  selected = i.id;
  activeWall = null;
  if (!i.locked) {
    drag = { id: i.id, start: p, x: i.x, y: i.y, moved: false, pointerId: ev.pointerId };
    $('#plan').setPointerCapture(ev.pointerId);
  }
  renderInspector();
  draw();
  focusPiece(i.id);
}
document.addEventListener('pointermove', (ev) => {
  if (!drag || ev.pointerId !== drag.pointerId) return;
  let p = localPoint(ev),
    dx = ((p.x - drag.start.x) * g.W) / 600,
    dy = ((p.y - drag.start.y) * g.W) / 600;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 1) return;
  let i = allItems().find((o) => o.id === drag.id);
  if (!i || i.locked) return;
  if (!drag.moved) {
    checkpoint();
    drag.moved = true;
  }
  i.x = Math.max(0, drag.x + dx / g.W);
  i.y = Math.max(0, drag.y + dy / g.H);
  draw();
});
function finishDrag(ev) {
  if (!drag || ev.pointerId !== drag.pointerId) return;
  if (drag.moved) {
    renderInspector();
    renderStats();
    save();
  }
  drag = null;
}
document.addEventListener('pointerup', finishDrag);
document.addEventListener('pointercancel', finishDrag);
function focusPiece(id) {
  [...$('#plan').querySelectorAll('[data-piece]')]
    .find((el) => el.dataset.piece === id)
    ?.focus({ preventScroll: true });
}
function nudgePiece(i, key, step) {
  if (i.locked) return;
  checkpoint();
  selected = i.id;
  if (key === 'ArrowLeft') i.x = Math.max(0, i.x - step / g.W);
  if (key === 'ArrowRight') i.x += step / g.W;
  if (key === 'ArrowUp') i.y = Math.max(0, i.y - step / g.H);
  if (key === 'ArrowDown') i.y += step / g.H;
  renderInspector();
  renderStats();
  draw();
  focusPiece(i.id);
  save();
}
function itemKey(ev, i) {
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    selectItem(i.id);
    focusPiece(i.id);
    return;
  }
  if (i.locked) return;
  if (ev.key.toLowerCase() === 'r' && !ev.metaKey && !ev.ctrlKey) {
    ev.preventDefault();
    rotatePiece(i.id, ev.shiftKey ? -1 : 1);
    return;
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) {
    ev.preventDefault();
    nudgePiece(i, ev.key, ev.shiftKey ? 10 : 1);
  }
}
$('#canvasRotateLeft').onclick = () => rotatePiece(selected, -1);
$('#canvasRotateRight').onclick = () => rotatePiece(selected, 1);
$('#canvasLock').onclick = () => toggleLock(selected);
$$('[data-tab]').forEach(
  (b) =>
    (b.onclick = () => {
      tab = b.dataset.tab;
      renderTabs();
      renderMeasurements();
    }),
);
$('#units').onchange = () => {
  checkpoint();
  state.unit = $('#units').value;
  render();
  save();
};
$('#modeBtn').onclick = () => {
  tab = 'furniture';
  renderTabs();
  renderMeasurements();
  if (!selected && allItems().length) selectItem(allItems()[0].id);
  else renderInspector();
  toast('Drag any piece to move it. Use ↶ / ↷ or press R to rotate.');
};

$('#planView').onclick = () => $('#plan').focus();
$('#zoomIn').onclick = () => {
  zoom = Math.min(2.5, zoom + 0.2);
  $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
  draw();
};
$('#zoomOut').onclick = () => {
  zoom = Math.max(0.6, zoom - 0.2);
  $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
  draw();
};
$('#zoomLabel').onclick = () => {
  zoom = 1;
  $('#zoomLabel').textContent = 'Fit';
  draw();
};
function undo() {
  if (!history.length) return;
  future.push(JSON.stringify(state));
  state = JSON.parse(history.pop());
  render();
  save();
}
function redo() {
  if (!future.length) return;
  history.push(JSON.stringify(state));
  state = JSON.parse(future.pop());
  render();
  save();
}
$('#undoBtn').onclick = undo;
$('#redoBtn').onclick = redo;
document.addEventListener('keydown', (ev) => {
  if (
    (ev.metaKey || ev.ctrlKey) &&
    ev.key.toLowerCase() === 'z' &&
    !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
  ) {
    ev.preventDefault();
    ev.shiftKey ? redo() : undo();
  }
});
$('#exportBtn').onclick = () => $('#exportDialog').showModal();
function download(content, type, name) {
  let url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#downloadJson').onclick = () => {
  download(JSON.stringify(state, null, 2), 'application/json', 'room-study-plan.json');
  toast('Your plan file is ready.');
};
$('#downloadSvg').onclick = () => {
  let clone = $('#plan').cloneNode(true);
  clone.setAttribute('xmlns', NS);
  const exportHeight = ((g.H + (g.ED || 0)) * 600) / g.W + 150;
  clone.setAttribute('viewBox', `-85 -65 770 ${exportHeight}`);
  clone.setAttribute('width', 1200);
  clone.setAttribute('height', Math.round((1200 * exportHeight) / 770));
  const style = document.createElementNS(NS, 'style');
  style.textContent =
    '.dim text{font:10px sans-serif;fill:#7d8e6c}.dim line{stroke:#a4b493;stroke-width:.7}.dim .pill{fill:#f8faf3;stroke:#d4ddc8;stroke-width:.6}.furniture .outline{stroke:#8f9e82;stroke-width:1}.furniture text{font-family:sans-serif}.floor-label{font:9px sans-serif;fill:#8f9c80}';
  clone.prepend(style);
  textAt(10, 10, '', {}, clone);
  let label = document.createElementNS(NS, 'text');
  label.setAttribute('x', (g.W / 600) * 0);
  label.setAttribute('y', -45);
  label.setAttribute('font-size', '9');
  label.setAttribute('fill', '#7d8e6c');
  label.textContent = `Room Study · units: ${unitLabel()} · ${allRoomKnown() ? 'Room outline measured' : 'Illustrative: unknown dimensions remain'} · furniture ~ = unmeasured`;
  clone.append(label);
  download(new XMLSerializer().serializeToString(clone), 'image/svg+xml', 'room-study-drawing.svg');
};
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = async (ev) => {
  let file = ev.target.files[0];
  if (!file) return;
  try {
    if (file.size > 25000000) throw Error();
    let raw = JSON.parse(await file.text());
    if (raw.format === 'room-study-library') {
      const added = layoutStore.import(raw);
      renderSaveStatus();
      showLayouts();
      toast(added + ' saved layouts imported.');
    } else {
      let data = validate(raw);
      checkpoint();
      state = data;
      selected = null;
      render();
      save();
      toast('Your plan is restored. Save a named copy to keep this layout.');
    }
  } catch (e) {
    toast('Could not import this Room Study file. Check the file and available browser storage.');
  }
  ev.target.value = '';
};
$('#resetBtn').onclick = () => {
  checkpoint();
  state = fresh();
  selected = null;
  activeWall = null;
  zoom = 1;
  render();
  save();
  toast('Fresh canvas. Use Undo to restore your previous plan.');
};
$('#closeAdd').onclick = () => $('#addDialog').close();
$('#addForm').onsubmit = (ev) => {
  ev.preventDefault();
  if (state.items.length >= 100) {
    toast('A plan supports up to 100 furniture pieces.');
    return;
  }
  checkpoint();
  let id = 'piece-' + crypto.randomUUID(),
    type = $('#newType').value;
  state.items.push({
    id,
    name: $('#newName').value.trim() || 'New furniture',
    type,
    color: '#a9b59a',
    x: 0.4,
    y: 0.35,
    bw: 70,
    bd: 50,
    w: null,
    d: null,
    rot: 0,
    locked: false,
  });
  selected = id;
  arrange = true;
  $('#modeBtn').classList.add('active');
  $('#modeBtn span').textContent = 'Move & rotate';
  $('#canvasInstruction').textContent = 'Drag to move · Select + R to rotate';
  $('#addDialog').close();
  $('#addForm').reset();
  render();
  save();
  toast('Added. Enter its measurements in the detail panel.');
};
$('#roomShape').onchange = () => {
  checkpoint();
  state.shape = $('#roomShape').value;
  state.known = {};
  selected = null;
  activeWall = null;
  zoom = 1;
  $('#zoomLabel').textContent = 'Fit';
  render();
  save();
  toast('Room template changed. Enter its measurements; Undo restores the previous room.');
};
const layoutStore = new RoomPlans.LayoutStore(storage, validate);
let libraryAvailable = true,
  renameLayoutId = null;
try {
  layoutStore.ensureStarting(state);
} catch (e) {
  libraryAvailable = false;
}
function renderSaveStatus() {
  let lib;
  try {
    lib = layoutStore.read();
    libraryAvailable = true;
  } catch (e) {
    libraryAvailable = false;
  }
  const active = lib?.plans.find((p) => p.id === lib.activeId),
    modified = active && layoutStore.signature(active.data) !== layoutStore.signature(state);
  $('#layoutName').textContent = active
    ? active.name + (modified ? ' · edited' : '')
    : 'My bedroom';
  $('#savedCount').textContent = lib?.plans.length ?? '—';
  $('#saveState').textContent = !storageOK
    ? '○ Draft not stored · export a backup'
    : !libraryAvailable
      ? '○ Saved plans unavailable'
      : '◉ Draft autosaved';
  $('#savedPlansBtn').title = 'Open your named layouts, saved in this browser';
}
function showSaveDialog(renameId = null) {
  renameLayoutId = renameId;
  let lib;
  try {
    lib = layoutStore.read();
  } catch (e) {
    toast('Saved layouts could not be read. Export your current plan to keep it.');
    return;
  }
  const existing = lib.plans.find((p) => p.id === renameId);
  $('#savePlanTitle').textContent = existing ? 'Rename this layout.' : 'Keep this layout.';
  $('#savePlanDescription').textContent = existing
    ? 'Only the name changes. Its saved measurements and positions stay the same.'
    : 'Each save keeps a separate copy of all measurements, positions, and rotations. Move things around without losing this one.';
  $('#confirmSavePlan').textContent = existing ? 'Save name' : 'Save this floorplan';
  $('#savePlanName').value = existing ? existing.name : 'Layout ' + (lib.plans.length + 1);
  $('#savePlanDialog').showModal();
  $('#savePlanName').focus();
  $('#savePlanName').select();
}
function miniature(data, name) {
  const result = E.solve(data.known, data.shape),
    shape = E.geometry(result.values, data.shape),
    vertices = E.points(shape, data.shape),
    s = 600 / shape.W;
  const W = 600,
    H = (shape.H + (shape.ED || 0)) * s;
  const pieces = [data.bathroom, data.sink, ...data.items].filter((i) => i.enabled !== false);
  const rects = pieces
    .map((i) => {
      let scale = shape.W / 600,
        w = i.w || i.bw * scale,
        d = i.d || i.bd * scale;
      return `<rect x="${i.x * shape.W * s}" y="${i.y * shape.H * s}" width="${(i.rot % 180 ? d : w) * s}" height="${(i.rot % 180 ? w : d) * s}" rx="2" fill="${i.color}" stroke="#8c9d7d" stroke-width="1.5"/>`;
    })
    .join('');
  return `<svg class="layout-thumbnail" viewBox="-18 -18 ${W + 36} ${H + 36}" role="img" aria-label="Preview of ${esc(name)}"><polygon points="${vertices.map(([x, y]) => [x * s, y * s].join(',')).join(' ')}" fill="#eeeadd" stroke="#75846b" stroke-width="3"/>${rects}</svg>`;
}
function renderLayouts() {
  const list = $('#savedLayoutsList');
  let lib;
  try {
    lib = layoutStore.read();
  } catch (e) {
    list.innerHTML =
      '<p class="section-note">Saved layouts could not be read. Your current draft can still be exported.</p>';
    return;
  }
  $('#libraryCount').textContent =
    lib.plans.length + ' ' + (lib.plans.length === 1 ? 'layout' : 'layouts');
  const signature = layoutStore.signature(state);
  list.innerHTML =
    lib.plans
      .slice()
      .reverse()
      .map((p) => {
        const match = layoutStore.signature(p.data) === signature;
        const date = new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date(p.createdAt));
        return `<article class="layout-card">${miniature(p.data, p.name)}<div class="layout-card-content"><div class="layout-card-title"><h3>${esc(p.name)}</h3>${match ? '<span class="layout-match">Matches draft</span>' : ''}</div><p>${esc(date)} · ${p.data.items.length + [p.data.bathroom, p.data.sink].filter((i) => i.enabled !== false).length} objects</p><div class="layout-card-actions"><button class="button restore-layout" data-restore="${esc(p.id)}">Open layout →</button><button class="rename-layout" data-rename="${esc(p.id)}">Rename</button></div></div></article>`;
      })
      .join('') || '<p class="section-note">Save your first floorplan to keep a layout here.</p>';
  list
    .querySelectorAll('[data-restore]')
    .forEach((b) => (b.onclick = () => restoreLayout(b.dataset.restore)));
  list
    .querySelectorAll('[data-rename]')
    .forEach((b) => (b.onclick = () => showSaveDialog(b.dataset.rename)));
}
function showLayouts() {
  renderLayouts();
  if (!$('#layoutsDialog').open) $('#layoutsDialog').showModal();
}
function restoreLayout(id) {
  try {
    const result = layoutStore.restore(id, state);
    checkpoint();
    state = result.data;
    selected = null;
    activeWall = null;
    zoom = 1;
    $('#zoomLabel').textContent = 'Fit';
    render();
    save();
    $('#layoutsDialog').close();
    toast(
      result.backup
        ? 'Layout opened. Your previous draft was kept in Saved plans.'
        : 'Saved layout opened.',
    );
  } catch (e) {
    toast('Could not open this layout. Your current plan is unchanged.');
  }
}
$('#savePlanBtn').onclick = () => showSaveDialog();
$('#savedPlansBtn').onclick = showLayouts;
$('#closeSavePlan').onclick = () => $('#savePlanDialog').close();
$('#closeLayouts').onclick = () => $('#layoutsDialog').close();
$('#savePlanForm').onsubmit = (ev) => {
  ev.preventDefault();
  const name = $('#savePlanName').value.trim();
  if (!name) {
    toast('Give this layout a name.');
    return;
  }
  try {
    if (renameLayoutId) layoutStore.rename(renameLayoutId, name);
    else layoutStore.create(state, name);
    $('#savePlanDialog').close();
    renderSaveStatus();
    if ($('#layoutsDialog').open) renderLayouts();
    toast(
      renameLayoutId
        ? 'Layout renamed.'
        : '“' + name + '” saved. You can try a new arrangement now.',
    );
  } catch (e) {
    toast('Could not store this layout. Export your plan to keep a backup.');
  }
};
$('#exportLibrary').onclick = () => {
  try {
    download(
      JSON.stringify(layoutStore.export(), null, 2),
      'application/json',
      'room-study-saved-layouts.json',
    );
    toast('Your saved-layouts backup is ready.');
  } catch (e) {
    toast('Saved layouts could not be exported.');
  }
};
$('#importLibrary').onclick = () => $('#importFile').click();
globalThis.addEventListener?.('storage', (ev) => {
  if (ev.key === layoutStore.key) {
    renderSaveStatus();
    if ($('#layoutsDialog').open) renderLayouts();
  }
});

render();
save();

$('#helpBtn').onclick = () => $('#helpDialog').showModal();
