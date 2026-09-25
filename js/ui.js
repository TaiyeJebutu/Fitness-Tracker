// Small DOM + formatting helpers shared by every screen.

export function h(tag, props, ...kids) {
  const el = tag === 'svg' || props?.svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false || k === 'svg') continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export const svg = (tag, props = {}, ...kids) => h(tag, { ...props, svg: true }, ...kids);

export function mount(el, ...kids) { el.replaceChildren(); add(el, kids); return el; }

// ---------- toast ----------------------------------------------------
let toastTimer;
export function toast(msg, kind = '') {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.className = 'show ' + kind;
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 3200);
}

// ---------- bottom sheet (modal) -------------------------------------
export function sheet(title, build) {
  const close = () => { wrap.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => e.key === 'Escape' && close();
  const body = h('div', { class: 'sheet-body' });
  const wrap = h('div', { class: 'sheet-wrap', 'data-screen': location.hash || '#/', onclick: e => e.target === wrap && close() },
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-head' },
        h('h2', {}, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, '✕')),
      body));
  document.body.append(wrap);
  document.addEventListener('keydown', esc);
  add(body, [build(close)]);
  const first = body.querySelector('input, select, textarea');
  if (first && !first.dataset.noautofocus) setTimeout(() => first.focus(), 50);
  return close;
}

export function confirmSheet(title, message, okLabel = 'Delete', danger = true) {
  return new Promise(resolve => {
    let done = false;
    const close = sheet(title, c => h('div', {},
      h('p', { class: 'muted' }, message),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn', onclick: () => { done = true; c(); resolve(false); } }, 'Cancel'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { done = true; c(); resolve(true); } }, okLabel))));
    const obs = new MutationObserver(() => { if (!document.querySelector('.sheet-wrap') && !done) { obs.disconnect(); resolve(false); } });
    obs.observe(document.body, { childList: true });
    void close;
  });
}

// ---------- units ----------------------------------------------------
const LB = 0.45359237, IN = 2.54;
let units = 'metric';
export const setUnits = u => (units = u === 'imperial' ? 'imperial' : 'metric');
export const getUnits = () => units;
export const wUnit = () => (units === 'imperial' ? 'lb' : 'kg');
export const lUnit = () => (units === 'imperial' ? 'in' : 'cm');
const trim = n => (Math.round(n * 10) / 10).toString();
/** kg -> number in the viewer's units */
export const toW = kg => (units === 'imperial' ? kg / LB : kg);
export const fromW = v => (units === 'imperial' ? v * LB : v);
export const toL = cm => (units === 'imperial' ? cm / IN : cm);
export const fromL = v => (units === 'imperial' ? v * IN : v);
export const fmtW = (kg, unit = true) => trim(toW(+kg)) + (unit ? ' ' + wUnit() : '');
export const fmtL = (cm, unit = true) => trim(toL(+cm)) + (unit ? ' ' + lUnit() : '');
export function fmtBig(kg) {
  const v = toW(+kg);
  return (v >= 10000 ? (Math.round(v / 100) / 10) + 'k' : Math.round(v).toLocaleString()) + ' ' + wUnit();
}

// ---------- dates ----------------------------------------------------
export const fmtDate = d => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDay = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
  return fmtDay(d);
}
export function duration(a, b) {
  const m = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
export const clock = s => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;
export function mondayStart(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

export const e1rm = (kg, reps) => (reps <= 0 || reps > 12 ? null : reps === 1 ? +kg : +kg * (1 + reps / 30));

// ---------- line chart (single series, tap/hover for values) -----------
export function lineChart(points, { fmt = v => v, axis = v => Math.round(v * 10) / 10, label = '' } = {}) {
  // points: [{x: Date, y: number}] sorted by x
  const W = 340, H = 180, P = { l: 44, r: 12, t: 28, b: 24 };
  const box = h('div', { class: 'chart' });
  if (points.length < 2) {
    box.append(h('p', { class: 'muted small center' }, points.length ? 'Add another entry to see a chart.' : 'No entries yet.'));
    return box;
  }
  const xs = points.map(p => +p.x), ys = points.map(p => p.y);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.15 || Math.abs(y1) * 0.05 || 1; y0 -= pad; y1 += pad;
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = x => P.l + ((x - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
  const Y = y => P.t + (1 - (y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label + ' over time' });
  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) * i) / 3, y = Y(v);
    s.append(svg('line', { x1: P.l, x2: W - P.r, y1: y, y2: y, class: 'grid' }),
      svg('text', { x: P.l - 6, y: y + 4, 'text-anchor': 'end', class: 'axis' }, axis(v)));
  }
  [points[0], points[points.length - 1]].forEach((p, i) =>
    s.append(svg('text', { x: X(+p.x), y: H - 6, 'text-anchor': i ? 'end' : 'start', class: 'axis' },
      new Date(p.x).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))));
  s.append(svg('polyline', { class: 'line', points: points.map(p => `${X(+p.x)},${Y(p.y)}`).join(' ') }));
  points.forEach(p => s.append(svg('circle', { class: 'dot', cx: X(+p.x), cy: Y(p.y), r: 4 })));
  const cross = svg('line', { class: 'cross', y1: P.t, y2: H - P.b, style: { display: 'none' } });
  const hi = svg('circle', { class: 'dot hi', r: 6, style: { display: 'none' } });
  s.append(cross, hi);
  const tip = h('div', { class: 'tip', hidden: true });
  const move = e => {
    const r = s.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = points[0];
    for (const p of points) if (Math.abs(X(+p.x) - px) < Math.abs(X(+best.x) - px)) best = p;
    const cx = X(+best.x), cy = Y(best.y);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.style.display = '';
    hi.setAttribute('cx', cx); hi.setAttribute('cy', cy); hi.style.display = '';
    tip.hidden = false;
    tip.textContent = `${fmtDay(best.x)} · ${fmt(best.y)}`;
    const frac = cx / W;
    tip.style.left = frac * 100 + '%';
    tip.style.transform = frac > 0.66 ? 'translateX(-100%)' : frac < 0.33 ? 'none' : 'translateX(-50%)';
  };
  const leave = () => { cross.style.display = 'none'; hi.style.display = 'none'; tip.hidden = true; };
  s.addEventListener('pointermove', move);
  s.addEventListener('pointerdown', move);
  s.addEventListener('pointerleave', leave);
  box.append(h('div', { class: 'chart-title muted small' }, label), tip, s);
  return box;
}

export const spinner = () => h('div', { class: 'spinner', 'aria-label': 'Loading' });

/** The container of the screen currently shown. */
export const currentPage = () => document.querySelector('#view > .page') || document.getElementById('view');
