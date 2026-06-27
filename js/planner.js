/* ============================================================
   RUME — Room Planner (functional core, single-file build for file://).
   SAT collision geometry, auto furniture layout, luminous mushroom
   lamp cluster placement, and a consultation/quote modal.
   Driven by [data-planner-action]; safe no-op if planner absent.
   ============================================================ */
(function () {
  'use strict';
  const root = document.getElementById('floorplan');
  if (!root) return; // not the planner page

  /* ---------------- config (cm; px = cm*SCALE) ---------------- */
  const SCALE = 2, ROOM = 350, OFFSET = 20, WALL_T = 15;
  const FURN = {
    bed:       { width: 140, height: 210, name: 'Bed' },
    sideTable: { width: 40,  height: 40,  name: 'Side Table' },
    tvTable:   { width: 180, height: 40,  name: 'TV Console' }
  };
  const LIGHT_RADII = [5, 7.5, 10];
  const LIGHT_CATALOG = {
    5:   { label: 'Small · Ø10 cm', price: 49000 },
    7.5: { label: 'Medium · Ø15 cm', price: 69000 },
    10:  { label: 'Large · Ø20 cm', price: 89000 }
  };
  const DOOR_DEADZONE = { x: 320, y: 320, width: 60, height: 60, angle: 0 };
  const DOOR_ARC = { pivotX: 350, pivotY: 290, radius: 60 };
  const KRW = (n) => 'KRW ' + n.toLocaleString('en-US');
  const toPx = (cm) => OFFSET + cm * SCALE;

  /* ---------------- geometry (pure) ---------------- */
  function getVertices(r) {
    const a = (r.angle * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    const hw = r.width / 2, hh = r.height / 2;
    return [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }]
      .map((v) => ({ x: r.x + (v.x * cos - v.y * sin), y: r.y + (v.x * sin + v.y * cos) }));
  }
  function overlapRect(A, B) {
    const axesOf = (vs) => { const ax = []; for (let i = 0; i < vs.length; i++) { const p1 = vs[i], p2 = vs[(i + 1) % vs.length]; ax.push({ x: -(p2.y - p1.y), y: p2.x - p1.x }); } return ax; };
    const proj = (vs, ax) => { let mn = Infinity, mx = -Infinity; for (const p of vs) { const d = p.x * ax.x + p.y * ax.y; if (d < mn) mn = d; if (d > mx) mx = d; } return { mn, mx }; };
    const vA = getVertices(A), vB = getVertices(B);
    for (const ax of [...axesOf(vA), ...axesOf(vB)]) { const a = proj(vA, ax), b = proj(vB, ax); if (a.mx < b.mn || b.mx < a.mn) return false; }
    return true;
  }
  function circleInRect(cx, cy, r, rect) {
    const a = (-rect.angle * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    const dx = cx - rect.x, dy = cy - rect.y;
    const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
    return Math.abs(lx) <= rect.width / 2 - r && Math.abs(ly) <= rect.height / 2 - r;
  }
  function circleOverlapRect(cx, cy, r, rect) {
    const a = (-rect.angle * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    const dx = cx - rect.x, dy = cy - rect.y;
    const lx = Math.abs(dx * cos - dy * sin), ly = Math.abs(dx * sin + dy * cos);
    const hw = rect.width / 2, hh = rect.height / 2;
    if (lx > hw + r || ly > hh + r) return false;
    if (lx <= hw || ly <= hh) return true;
    return (lx - hw) ** 2 + (ly - hh) ** 2 <= r * r;
  }
  function circleOverlapArc(cx, cy, r, arc) {
    if (cx > arc.pivotX || cy < arc.pivotY) return false;
    return Math.hypot(cx - arc.pivotX, cy - arc.pivotY) < arc.radius + r;
  }

  /* ---------------- layout (pure) ---------------- */
  const WALLS = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
  function layoutFurniture() {
    const placed = [];
    const { width: bw, height: bh } = FURN.bed;
    let bed = null;
    for (let t = 0; t < 300; t++) {
      const w = WALLS[Math.floor(Math.random() * 4)];
      const b = { width: bw, height: bh, angle: 0, name: 'Bed', x: 0, y: 0 };
      if (w === 'NORTH') { b.angle = 0; b.x = bw / 2 + Math.random() * (ROOM - bw); b.y = bh / 2; }
      else if (w === 'SOUTH') { b.angle = 180; b.x = bw / 2 + Math.random() * (ROOM - bw); b.y = ROOM - bh / 2; }
      else if (w === 'WEST') { b.angle = 270; b.x = bh / 2; b.y = bw / 2 + Math.random() * (ROOM - bw); }
      else { b.angle = 90; b.x = ROOM - bh / 2; b.y = bw / 2 + Math.random() * (ROOM - bw); }
      if (!overlapRect(b, DOOR_DEADZONE)) { bed = b; break; }
    }
    if (!bed) bed = { x: 70, y: 105, width: 140, height: 210, angle: 0, name: 'Bed' };
    placed.push(bed);

    let side = 1;
    if (bed.angle === 0) side = bed.x > ROOM - bed.x ? -1 : 1;
    else if (bed.angle === 180) side = bed.x < ROOM - bed.x ? -1 : 1;
    else if (bed.angle === 270) side = bed.y < ROOM - bed.y ? -1 : 1;
    else if (bed.angle === 90) side = bed.y > ROOM - bed.y ? -1 : 1;
    const rad = (bed.angle * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const st = FURN.sideTable, offY = -bed.height / 2 + st.height / 2, offX = bed.width / 2 + st.width / 2;
    const lx = side * offX;
    const sideTable = { width: st.width, height: st.height, angle: bed.angle, name: 'Side Table',
      x: bed.x + (lx * cos - offY * sin), y: bed.y + (lx * sin + offY * cos) };
    if (sideTable.x < 0 || sideTable.x > ROOM || sideTable.y < 0 || sideTable.y > ROOM || overlapRect(sideTable, DOOR_DEADZONE)) {
      const aLx = -side * offX;
      sideTable.x = bed.x + (aLx * cos - offY * sin);
      sideTable.y = bed.y + (aLx * sin + offY * cos);
    }
    placed.push(sideTable);

    const tv = FURN.tvTable;
    for (let t = 0; t < 400; t++) {
      const w = WALLS[Math.floor(Math.random() * 4)];
      const o = { width: tv.width, height: tv.height, angle: 0, name: 'TV Console', x: 0, y: 0 };
      if (w === 'NORTH') { o.angle = 0; o.x = tv.width / 2 + Math.random() * (ROOM - tv.width); o.y = tv.height / 2; }
      else if (w === 'SOUTH') { o.angle = 0; o.x = tv.width / 2 + Math.random() * (ROOM - tv.width); o.y = ROOM - tv.height / 2; }
      else if (w === 'WEST') { o.angle = 90; o.x = tv.height / 2; o.y = tv.width / 2 + Math.random() * (ROOM - tv.width); }
      else { o.angle = 90; o.x = ROOM - tv.height / 2; o.y = tv.width / 2 + Math.random() * (ROOM - tv.width); }
      if (!overlapRect(o, bed) && !overlapRect(o, sideTable) && !overlapRect(o, DOOR_DEADZONE)) { placed.push(o); break; }
    }
    return placed;
  }
  function placeLightCluster(furniture) {
    const lights = [], count = Math.floor(Math.random() * 4) + 4;
    const sideTable = furniture.find((f) => f.name === 'Side Table');
    let sx, sy;
    if (sideTable && Math.random() > 0.4) { sx = sideTable.x; sy = sideTable.y; }
    else { sx = 60 + Math.random() * 230; sy = 60 + Math.random() * 230; }
    for (let i = 0; i < count; i++) {
      for (let t = 0; t < 500; t++) {
        const r = LIGHT_RADII[Math.floor(Math.random() * LIGHT_RADII.length)];
        const ang = Math.random() * Math.PI * 2, dist = Math.random() * 50;
        const x = sx + Math.cos(ang) * dist, y = sy + Math.sin(ang) * dist;
        if (x - r < 0 || x + r > ROOM || y - r < 0 || y + r > ROOM) continue;
        if (circleOverlapArc(x, y, r, DOOR_ARC)) continue;
        const onTable = sideTable ? circleInRect(x, y, r, sideTable) : false;
        if (!onTable && furniture.some((f) => circleOverlapRect(x, y, r, f))) continue;
        if (lights.some((l) => Math.hypot(x - l.x, y - l.y) < r + l.r + 2)) continue;
        lights.push({ x, y, r });
        break;
      }
    }
    return lights;
  }

  /* ---------------- store ---------------- */
  const state = { furniture: [], lights: [], lightsPlaced: false };
  const subs = new Set();
  const setState = (patch) => { Object.assign(state, patch); subs.forEach((fn) => fn(state)); };
  const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

  /* ---------------- render ---------------- */
  const LINE = 'rgba(36,23,19,0.26)', SUB = 'rgba(36,23,19,0.55)';
  const FURN_LINE = 'rgba(36,23,19,0.5)', FLOOR = '#FFFDF9';
  const WIN_FILL = '#F7F1EA', WIN_LINE = 'rgba(36,23,19,0.2)', DOOR = 'rgba(36,23,19,0.45)', ARC = 'rgba(36,23,19,0.18)';
  function renderStructure(layer) {
    const o = OFFSET, s = ROOM * SCALE, wT = WALL_T * SCALE;
    let svg = `<path d="M ${o - wT} ${o - wT} H ${o + s + wT} V ${o + s + wT} H ${o - wT} Z M ${o} ${o} H ${o + s} V ${o + s} H ${o} Z" fill="url(#wall-hatch)" stroke="${LINE}" stroke-width="1" fill-rule="evenodd" opacity=".85"/>`;
    svg += `<rect x="${o}" y="${o}" width="${s}" height="${s}" fill="${FLOOR}" stroke="${LINE}" stroke-width=".9"/>`;
    const winX = o + 115 * SCALE, winW = 120 * SCALE;
    svg += `<rect x="${winX}" y="${o - wT}" width="${winW}" height="${wT}" fill="${WIN_FILL}" stroke="${WIN_LINE}" stroke-width=".8"/>`;
    svg += `<line x1="${winX}" y1="${o - wT / 2}" x2="${winX + winW}" y2="${o - wT / 2}" stroke="${WIN_LINE}" stroke-width=".7"/>`;
    const px = o + s, py = o + 290 * SCALE, dl = 60 * SCALE;
    svg += `<line x1="${px}" y1="${py}" x2="${px}" y2="${py + dl}" stroke="${DOOR}" stroke-width="1.8"/>`;
    svg += `<path d="M ${px} ${py + dl} A ${dl} ${dl} 0 0 1 ${px - dl} ${py}" fill="none" stroke="${ARC}" stroke-width=".8" stroke-dasharray="4,4"/>`;
    layer.innerHTML = svg;
  }
  function renderFurniture(layer, furniture) {
    layer.innerHTML = furniture.map((f) => {
      const cx = toPx(f.x), cy = toPx(f.y), w = f.width * SCALE, h = f.height * SCALE;
      const pillow = f.name === 'Bed'
        ? `<line x1="${-w / 2 + 6}" y1="${-h / 2 + 30}" x2="${w / 2 - 6}" y2="${-h / 2 + 30}" stroke="${FURN_LINE}" stroke-width=".7"/>` : '';
      return `<g transform="translate(${cx},${cy}) rotate(${f.angle})">
          <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="4" fill="#ffffff" stroke="${FURN_LINE}" stroke-width="1.3"/>${pillow}
          <text x="0" y="0" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="${SUB}" font-family="Hanken Grotesk, sans-serif" transform="rotate(${-f.angle})">${f.name}</text>
        </g>`;
    }).join('');
  }
  function lampSVG(cx, cy, radius, id) {
    const d = radius * 2;
    return `<defs><radialGradient id="${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFF6DA" stop-opacity="0.5"/>
        <stop offset="45%" stop-color="#FFE3A8" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#FFE3A8" stop-opacity="0"/>
      </radialGradient></defs>
      <g transform="translate(${cx},${cy})">
        <circle r="${radius * 1.55}" fill="url(#${id})"/>
        <image href="assets/mushroom-lamp.png" x="${-d / 2}" y="${-d / 2}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid meet"/>
      </g>`;
  }
  function renderLights(layer, lights) {
    layer.innerHTML = lights.map((l, i) => lampSVG(toPx(l.x), toPx(l.y), l.r * SCALE, 'lamp_glow_' + i)).join('');
  }

  const layers = {
    structure: document.getElementById('structure-layer'),
    furniture: document.getElementById('furniture-layer'),
    light: document.getElementById('light-layer')
  };
  subscribe((st) => {
    if (layers.furniture) renderFurniture(layers.furniture, st.furniture);
    if (layers.light) renderLights(layers.light, st.lightsPlaced ? st.lights : []);
  });

  /* ---------------- quote + consult modal ---------------- */
  function calcQuote(lights) {
    const buckets = {};
    for (const { r } of lights) { if (LIGHT_CATALOG[r]) buckets[r] = (buckets[r] || 0) + 1; }
    const items = Object.entries(buckets).map(([r, c]) => { const { label, price } = LIGHT_CATALOG[r]; return { label, count: c, subtotal: price * c }; });
    return { items, total: items.reduce((s, it) => s + it.subtotal, 0) };
  }
  function quoteTable({ items, total }) {
    const rows = items.map((it) => `<tr><td>${it.label}</td><td>${it.count}</td><td>${KRW(it.subtotal)}</td></tr>`).join('');
    return `<table class="quote-table">
        <thead><tr><th>Size</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td><td></td><td>${KRW(total)}</td></tr></tfoot>
      </table>`;
  }
  const modal = document.getElementById('modal-overlay');
  const modalBody = document.getElementById('modal-body');
  const openModal = () => modal && modal.classList.add('is-open');
  const closeModal = () => modal && modal.classList.remove('is-open');

  /* ---------------- interactions via data-planner-action ---------------- */
  function setActive(btn) {
    document.querySelectorAll('[data-planner-action]').forEach((b) => b.classList.remove('is-active'));
    if (btn) btn.classList.add('is-active');
  }
  const actions = {
    furniture() { setState({ furniture: layoutFurniture(), lights: [], lightsPlaced: false }); window.rumeToast && window.rumeToast('Furniture rearranged'); },
    lamp() {
      if (!state.furniture.length) setState({ furniture: layoutFurniture() });
      setState({ lights: placeLightCluster(state.furniture), lightsPlaced: true });
      window.rumeToast && window.rumeToast('Placed ' + state.lights.length + ' luminous mushroom lamps');
    },
    shuffle() {
      const furniture = layoutFurniture();
      setState({ furniture, lights: placeLightCluster(furniture), lightsPlaced: true });
      window.rumeToast && window.rumeToast('New layout generated');
    },
    consult() {
      if (!state.lightsPlaced || !state.lights.length) {
        if (!state.furniture.length) setState({ furniture: layoutFurniture() });
        setState({ lights: placeLightCluster(state.furniture), lightsPlaced: true });
      }
      if (modalBody) modalBody.innerHTML = quoteTable(calcQuote(state.lights));
      openModal();
    }
  };
  document.querySelectorAll('[data-planner-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const act = btn.getAttribute('data-planner-action');
      if (actions[act]) { actions[act](); if (act !== 'consult') setActive(btn); }
    });
  });

  const mClose = document.getElementById('btn-modal-close');
  const mOrder = document.getElementById('btn-modal-order');
  if (mClose) mClose.addEventListener('click', closeModal);
  if (mOrder) mOrder.addEventListener('click', () => {
    window.rumeAddToCart && window.rumeAddToCart('L', 'red');
    window.rumeToast && window.rumeToast('Your request has been sent to the rume showroom.');
    closeModal();
  });
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ---------------- init ---------------- */
  if (layers.structure) renderStructure(layers.structure);
  setState({ furniture: layoutFurniture(), lights: [], lightsPlaced: false });
})();
