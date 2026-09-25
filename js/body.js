// Bodyweight and measurements, with a per-metric "friends can see this" switch.
import * as api from './api.js';
import { state, METRICS } from './store.js';
import { fmtMetric } from './social.js';
import { h, mount, toast, spinner, lineChart, toW, fromW, toL, fromL, wUnit, lUnit, fmtDay, todayISO, currentPage } from './ui.js';

const unitFor = def => (def.kind === 'w' ? wUnit() : def.kind === 'pct' ? '%' : lUnit());
const toView = (def, v) => (def.kind === 'w' ? toW(v) : def.kind === 'pct' ? +v : toL(v));
const fromView = (def, v) => (def.kind === 'w' ? fromW(v) : def.kind === 'pct' ? v : fromL(v));

export async function renderBody(root, key = 'bodyweight') {
  const def = METRICS.find(m => m.key === key) || METRICS[0];
  const uid = api.userId();
  const path = `body_metrics?owner=eq.${uid}&metric=eq.${def.key}&select=*&order=measured_on.asc,created_at.asc`;
  const content = h('div', {}, spinner());
  mount(root,
    h('h1', {}, 'Body'),
    h('div', { class: 'chips scroll' }, METRICS.map(m => h('a', { class: 'chip' + (m.key === def.key ? ' on' : ''), href: '#/body/' + m.key }, m.label))),
    content);

  let rows = [];
  try { rows = await api.get(path); } catch (e) { rows = api.cached(path) || []; }
  // include entries saved offline
  const pending = api.LS.get('ft.outbox', []).filter(o => o.op === 'upsert' && o.table === 'body_metrics' && o.row.metric === def.key).map(o => o.row);
  rows = [...rows.filter(r => !pending.some(p => p.id === r.id)), ...pending].sort((a, b) => a.measured_on.localeCompare(b.measured_on));

  const shared = (state.profile?.shared_metrics || []).includes(def.key);
  let val = '', date = todayISO();
  const add = e => {
    e.preventDefault();
    const n = parseFloat(String(val).replace(',', '.'));
    if (!(n > 0)) return toast('Enter a value', 'err');
    api.upsert('body_metrics', { id: api.uuid(), owner: uid, metric: def.key, value: +fromView(def, n).toFixed(3), measured_on: date });
    toast('Saved');
    renderBody(root, def.key);
  };
  const latest = rows[rows.length - 1];
  mount(content,
    h('section', { class: 'card' },
      h('div', { class: 'row between' },
        h('div', {}, h('span', { class: 'muted small' }, 'Latest'), h('div', { class: 'big-num' }, latest ? fmtMetric(def, latest.value) : '—')),
        h('label', { class: 'switch' },
          h('input', { type: 'checkbox', checked: shared, onchange: e => toggleShare(def.key, e.target.checked) }),
          h('span', {}, 'Friends can see'))),
      h('form', { class: 'row gap', onsubmit: add },
        h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: 0, placeholder: unitFor(def), 'aria-label': `${def.label} in ${unitFor(def)}`, 'data-noautofocus': '1', oninput: e => (val = e.target.value) }),
        h('input', { type: 'date', value: date, max: todayISO(), 'aria-label': 'Date', class: 'date', onchange: e => (date = e.target.value || todayISO()) }),
        h('button', { class: 'btn primary', type: 'submit' }, 'Add'))),
    lineChart(rows.map(r => ({ x: new Date(r.measured_on + 'T12:00'), y: toView(def, +r.value) })),
      { fmt: v => (Math.round(v * 10) / 10) + ' ' + unitFor(def), label: `${def.label} (${unitFor(def)})` }),
    rows.length > 0 && h('h2', {}, 'Entries'),
    [...rows].reverse().map(r => h('div', { class: 'card row between' },
      h('span', {}, fmtDay(r.measured_on + 'T12:00')),
      h('span', { class: 'row gap' }, h('strong', {}, fmtMetric(def, r.value)),
        h('button', { class: 'icon-btn', 'aria-label': 'Delete entry', onclick: () => { api.remove('body_metrics', 'id=eq.' + r.id); renderBody(root, def.key); } }, '✕')))));
}

async function toggleShare(key, on) {
  const cur = new Set(state.profile?.shared_metrics || []);
  on ? cur.add(key) : cur.delete(key);
  const list = [...cur];
  try {
    await api.patch('profiles', 'id=eq.' + api.userId(), { shared_metrics: list });
    state.profile.shared_metrics = list;
    toast(on ? 'Friends can now see this' : 'Now private');
  } catch (e) { toast(e.message, 'err'); renderBody(currentPage(), key); }
}
