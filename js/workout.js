// Active workout logging, exercise picker, exercise details and the rest timer.
import * as api from './api.js';
import { state, exName, addExercise, lastSets, details, saveDetails, saveRoutine, CATEGORIES } from './store.js';
import { h, mount, toast, sheet, confirmSheet, fmtW, toW, fromW, wUnit, clock, duration, currentPage } from './ui.js';

const AKEY = 'ft.active';
export const active = () => api.LS.get(AKEY);
const save = w => api.LS.set(AKEY, w);

// ---------- start / finish -----------------------------------------------
export async function startWorkout(routine) {
  if (active()) { location.hash = '#/workout'; return; }
  const w = {
    id: api.uuid(), name: routine?.name || 'Workout', routine_id: routine?.id || null,
    started_at: new Date().toISOString(), items: [],
  };
  for (const it of routine?.items || []) w.items.push(newItem(it.exercise_id, it.rest, it.sets, it.reps));
  save(w);
  api.upsert('workouts', { id: w.id, name: w.name, routine_id: w.routine_id, started_at: w.started_at, owner: api.userId() });
  location.hash = '#/workout';
  fillPrev(w);
}

function newItem(exercise_id, rest = 90, sets = 3, reps = null) {
  return { key: api.uuid(), exercise_id, rest: rest || 90, targetReps: reps || null, prev: null,
    sets: Array.from({ length: Math.max(1, sets || 1) }, (_, i) => ({ id: api.uuid(), set_no: i + 1, reps: reps || null, weight_kg: null, done: false })) };
}

async function fillPrev(w) {
  await Promise.all(w.items.filter(it => it.prev == null).map(async it => {
    const prev = await lastSets(it.exercise_id, w.id).catch(() => []);
    const cur = active(); if (!cur || cur.id !== w.id) return;
    const target = cur.items.find(x => x.key === it.key); if (!target) return;
    target.prev = prev;
    // prefill empty rows with last time's numbers
    target.sets.forEach((s, i) => {
      const p = prev[i] || prev[prev.length - 1];
      if (p && !s.done) { if (s.weight_kg == null) s.weight_kg = +p.weight_kg; if (s.reps == null) s.reps = p.reps; }
    });
    save(cur);
  }));
  if (location.hash.startsWith('#/workout')) renderWorkout(currentPage());
}

function persistSet(w, item, s) {
  const position = w.items.indexOf(item);
  api.upsert('sets', { id: s.id, workout_id: w.id, owner: api.userId(), exercise_id: item.exercise_id,
    position, set_no: s.set_no, reps: s.reps || 0, weight_kg: s.weight_kg || 0 });
}

async function finish(w) {
  const logged = w.items.reduce((n, it) => n + it.sets.filter(s => s.done).length, 0);
  if (!logged) {
    if (await confirmSheet('Nothing logged', 'No sets are ticked. Discard this workout?', 'Discard')) discard(w, true);
    return;
  }
  const ended = new Date().toISOString();
  api.upsert('workouts', { id: w.id, name: w.name, notes: w.notes || null, ended_at: ended, owner: api.userId(),
    started_at: w.started_at, routine_id: w.routine_id });
  api.LS.del(AKEY); stopRest();
  const doneItems = w.items.filter(it => it.sets.some(s => s.done));
  const asRoutineItems = doneItems.map(it => ({ exercise_id: it.exercise_id, sets: it.sets.filter(s => s.done).length,
    reps: it.targetReps || it.sets.find(s => s.done)?.reps || null, rest: it.rest }));
  const routine = state.routines.find(r => r.id === w.routine_id);
  location.hash = '#/history/' + w.id;  // switch screen first, then show the pop-up on top
  sheet('Workout saved 💪', close => h('div', {},
    h('p', {}, `${logged} sets · ${duration(w.started_at, ended)}`),
    routine && h('button', { class: 'btn block', onclick: () => { saveRoutine({ ...routine, items: asRoutineItems }); toast('Routine updated'); close(); } },
      `Update “${routine.name}” with today's exercises`),
    h('button', { class: 'btn block', onclick: () => {
      saveRoutine({ id: api.uuid(), name: routine ? routine.name + ' (copy)' : w.name, items: asRoutineItems });
      toast('Saved as a routine'); close(); } }, 'Save as a new routine'),
    h('button', { class: 'btn primary block', onclick: close }, 'Done')));
}

async function discard(w, skipConfirm) {
  if (!skipConfirm && !(await confirmSheet('Discard workout?', 'Everything logged in this workout will be deleted.', 'Discard'))) return;
  api.remove('workouts', 'id=eq.' + w.id);
  api.LS.del(AKEY); stopRest();
  location.hash = '#/';
}

// ---------- rest timer ---------------------------------------------------
const RKEY = 'ft.rest';
export const restState = () => api.LS.get(RKEY);
export function startRest(seconds) {
  api.LS.set(RKEY, { end: Date.now() + seconds * 1000, total: seconds, beeped: false });
  primeAudio();
  tickRest();
}
export function stopRest() { api.LS.del(RKEY); tickRest(); }
function adjustRest(delta) {
  const r = restState(); if (!r) return;
  r.end += delta * 1000; r.total = Math.max(1, r.total + delta); api.LS.set(RKEY, r); tickRest();
}
let audio;
function primeAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch {} }
function beep() {
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
  if (!audio) return;
  [0, 0.25, 0.5].forEach(t => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.value = 0.2;
    o.connect(g); g.connect(audio.destination);
    o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.15);
  });
}
export function tickRest() {
  const bar = document.getElementById('restbar');
  if (!bar) return;
  const r = restState();
  if (!r) { bar.hidden = true; return; }
  const left = Math.ceil((r.end - Date.now()) / 1000);
  if (left <= 0 && !r.beeped) { r.beeped = true; api.LS.set(RKEY, r); beep(); }
  if (left <= -5) { stopRest(); return; }
  bar.hidden = false;
  mount(bar,
    h('div', { class: 'rest-fill', style: { width: Math.max(0, Math.min(100, (left / r.total) * 100)) + '%' } }),
    h('button', { class: 'icon-btn', onclick: () => adjustRest(-15), 'aria-label': 'Minus 15 seconds' }, '−15'),
    h('div', { class: 'rest-time' }, left > 0 ? clock(left) : 'Go!'),
    h('button', { class: 'icon-btn', onclick: () => adjustRest(15), 'aria-label': 'Plus 15 seconds' }, '+15'),
    h('button', { class: 'icon-btn', onclick: stopRest, 'aria-label': 'Stop rest timer' }, 'Skip'));
}
setInterval(tickRest, 250);

// ---------- exercise picker ---------------------------------------------
export function pickExercise(onPick) {
  sheet('Add exercise', close => {
    let q = '', cat = '';
    const list = h('div', { class: 'list' });
    const draw = () => {
      const me = api.userId();
      const ql = q.trim().toLowerCase();
      const items = state.exercises.filter(x => (x.owner == null || x.owner === me)
        && (!cat || x.category === cat) && (!ql || x.name.toLowerCase().includes(ql)));
      const exact = state.exercises.some(x => x.name.toLowerCase() === ql && (x.owner == null || x.owner === me));
      mount(list,
        ql && !exact && h('button', { class: 'list-item create', onclick: () => createFlow(q.trim()) }, `＋ Create “${q.trim()}”`),
        items.slice(0, 150).map(x => h('button', { class: 'list-item', onclick: () => { close(); onPick(x); } },
          h('span', {}, x.name), h('span', { class: 'muted small' }, x.owner ? 'Custom · ' + x.category : x.category))),
        !items.length && !ql && h('p', { class: 'muted center' }, 'No exercises in this category.'));
    };
    const createFlow = name => {
      chips.hidden = true;
      mount(list, h('p', {}, `Which body area is “${name}”?`),
        h('div', { class: 'chips' }, CATEGORIES.map(c => h('button', { class: 'chip', onclick: () => {
          const ex = addExercise(name, c); toast('Exercise created'); close(); onPick(ex); } }, c))));
    };
    const chips = h('div', { class: 'chips scroll' }, ['', ...CATEGORIES].map(c =>
      h('button', { class: 'chip' + (c === cat ? ' on' : ''), onclick: e => {
        cat = c; chips.querySelectorAll('.chip').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); draw(); } }, c || 'All')));
    draw();
    return h('div', {},
      h('input', { type: 'search', placeholder: 'Search or type a new exercise', 'aria-label': 'Search exercises',
        oninput: e => { q = e.target.value; chips.hidden = false; draw(); } }),
      chips, list);
  });
}

// ---------- exercise details (seat height, machine, adjustments) ----------
export function detailsSummary(d) {
  if (!d) return '';
  const bits = [];
  const machine = [d.machine_brand, d.machine_model].filter(Boolean).join(' ');
  if (machine) bits.push(machine);
  if (d.seat_height) bits.push('Seat ' + d.seat_height);
  for (const a of d.adjustments || []) if (a.label || a.value) bits.push(`${a.label || 'Setting'} ${a.value || ''}`.trim());
  return bits.join(' · ');
}

export async function editDetails(exerciseId, onSaved) {
  const d = (await details(exerciseId)) || {};
  sheet(exName(exerciseId), close => {
    const f = { machine_brand: d.machine_brand || '', machine_model: d.machine_model || '', seat_height: d.seat_height || '',
      notes: d.notes || '', adjustments: (d.adjustments || []).map(a => ({ ...a })) };
    const adjBox = h('div', {});
    const drawAdj = () => mount(adjBox, f.adjustments.map((a, i) => h('div', { class: 'row gap adj' },
      h('input', { placeholder: 'e.g. Back pad', value: a.label, 'aria-label': 'Adjustment name', oninput: e => (a.label = e.target.value) }),
      h('input', { placeholder: 'e.g. 4', value: a.value, 'aria-label': 'Adjustment value', class: 'short', oninput: e => (a.value = e.target.value) }),
      h('button', { class: 'icon-btn', 'aria-label': 'Remove adjustment', onclick: () => { f.adjustments.splice(i, 1); drawAdj(); } }, '✕'))),
      h('button', { class: 'btn small', onclick: () => { f.adjustments.push({ label: '', value: '' }); drawAdj(); } }, '＋ Add adjustment'));
    drawAdj();
    const field = (label, key, ph) => h('label', { class: 'field' }, h('span', {}, label),
      h('input', { value: f[key], placeholder: ph, oninput: e => (f[key] = e.target.value), 'data-noautofocus': '1' }));
    return h('div', {},
      h('p', { class: 'muted small' }, 'Only you can see these.'),
      h('div', { class: 'row gap' }, field('Machine brand', 'machine_brand', 'e.g. Technogym'), field('Model', 'machine_model', 'e.g. Selection 700')),
      field('Seat height', 'seat_height', 'e.g. 5'),
      h('div', { class: 'field' }, h('span', {}, 'Other adjustments'), adjBox),
      h('label', { class: 'field' }, h('span', {}, 'Notes'),
        h('textarea', { rows: 3, placeholder: 'Grip, cues, anything to remember', oninput: e => (f.notes = e.target.value) }, f.notes)),
      h('button', { class: 'btn primary block', onclick: () => {
        f.adjustments = f.adjustments.filter(a => a.label.trim() || a.value.trim());
        saveDetails(exerciseId, f); toast('Saved'); close(); onSaved?.(f); } }, 'Save'),
      h('a', { class: 'btn block ghost', href: '#/exercise/' + exerciseId, onclick: close }, 'View history for this exercise'));
  });
}

// ---------- active workout screen ----------------------------------------
const detailCache = new Map();

export function renderWorkout(root) {
  const w = active();
  if (!w) {
    mount(root, h('div', { class: 'empty' }, h('p', {}, 'No workout in progress.'), h('a', { class: 'btn primary', href: '#/' }, 'Go to Train')));
    return;
  }
  const rerender = () => renderWorkout(root);
  const upd = fn => { const cur = active(); fn(cur); save(cur); return cur; };

  const elapsed = h('span', { class: 'muted small', id: 'elapsed' }, duration(w.started_at, new Date()));
  const header = h('div', { class: 'wk-head' },
    h('input', { class: 'wk-name', value: w.name, 'aria-label': 'Workout name', onchange: e => {
      const cur = upd(c => (c.name = e.target.value || 'Workout'));
      api.upsert('workouts', { id: cur.id, name: cur.name, owner: api.userId(), started_at: cur.started_at }); } }),
    elapsed,
    h('button', { class: 'btn primary', onclick: () => finish(active()) }, 'Finish'));

  const cards = w.items.map((it, idx) => {
    const d = detailCache.get(it.exercise_id);
    if (d === undefined) {
      detailCache.set(it.exercise_id, null);
      details(it.exercise_id).then(x => { detailCache.set(it.exercise_id, x); if (x) rerender(); });
    }
    const summary = detailsSummary(d);
    const rows = it.sets.map((s, si) => {
      const p = it.prev?.[si];
      const wIn = h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: 0, class: 'num',
        value: s.weight_kg == null ? '' : +toW(s.weight_kg).toFixed(2), 'aria-label': `Set ${s.set_no} weight in ${wUnit()}`,
        onchange: e => { const cur = upd(c => { const t = c.items[idx].sets[si]; t.weight_kg = e.target.value === '' ? null : fromW(+e.target.value); });
          if (s.done) persistSet(cur, cur.items[idx], cur.items[idx].sets[si]); } });
      const rIn = h('input', { type: 'number', inputmode: 'numeric', min: 0, step: 1, class: 'num',
        value: s.reps ?? '', placeholder: it.targetReps || '', 'aria-label': `Set ${s.set_no} reps`,
        onchange: e => { const cur = upd(c => { c.items[idx].sets[si].reps = e.target.value === '' ? null : Math.round(+e.target.value); });
          if (s.done) persistSet(cur, cur.items[idx], cur.items[idx].sets[si]); } });
      const tick = h('button', { class: 'tick' + (s.done ? ' on' : ''), 'aria-pressed': String(s.done), 'aria-label': `Log set ${s.set_no}`,
        onclick: () => {
          const cur = upd(c => {
            const t = c.items[idx].sets[si];
            if (!t.done && (t.reps == null || t.reps === 0)) t.reps = it.targetReps || p?.reps || null;
            if (!t.done && t.weight_kg == null) t.weight_kg = p ? +p.weight_kg : 0;
            t.done = !t.done && !!t.reps;
          });
          const t = cur.items[idx].sets[si];
          if (t.done) { persistSet(cur, cur.items[idx], t); startRest(it.rest); }
          else if (!t.reps) toast('Enter reps first');
          else api.remove('sets', 'id=eq.' + t.id);
          rerender();
        } }, '✓');
      return h('div', { class: 'set-row' + (s.done ? ' done' : '') },
        h('span', { class: 'set-no' }, s.set_no),
        h('span', { class: 'prev muted small' }, p ? `${fmtW(p.weight_kg, false)}×${p.reps}` : '—'),
        wIn, rIn, tick);
    });
    const menu = () => sheet(exName(it.exercise_id), close => h('div', { class: 'stack' },
      h('button', { class: 'btn block', onclick: () => { close(); editDetails(it.exercise_id, f => { detailCache.set(it.exercise_id, f); rerender(); }); } }, 'Machine & seat settings'),
      h('label', { class: 'field' }, h('span', {}, 'Rest timer (seconds)'),
        h('input', { type: 'number', inputmode: 'numeric', min: 0, step: 15, value: it.rest, 'data-noautofocus': '1',
          onchange: e => { upd(c => (c.items[idx].rest = Math.max(0, +e.target.value || 0))); } })),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn', disabled: idx === 0, onclick: () => { upd(c => c.items.splice(idx - 1, 0, c.items.splice(idx, 1)[0])); resequence(); close(); rerender(); } }, '↑ Move up'),
        h('button', { class: 'btn', disabled: idx === w.items.length - 1, onclick: () => { upd(c => c.items.splice(idx + 1, 0, c.items.splice(idx, 1)[0])); resequence(); close(); rerender(); } }, '↓ Move down')),
      h('button', { class: 'btn danger block', onclick: () => {
        const cur = active(); cur.items[idx].sets.filter(s => s.done).forEach(s => api.remove('sets', 'id=eq.' + s.id));
        cur.items.splice(idx, 1); save(cur); resequence(); close(); rerender(); } }, 'Remove exercise')));

    return h('section', { class: 'card ex-card' },
      h('div', { class: 'ex-head' },
        h('button', { class: 'ex-title', onclick: () => editDetails(it.exercise_id, f => { detailCache.set(it.exercise_id, f); rerender(); }) },
          h('strong', {}, exName(it.exercise_id)),
          h('span', { class: 'muted small' }, summary || 'Tap to add machine / seat settings')),
        h('button', { class: 'icon-btn', 'aria-label': 'Exercise options', onclick: menu }, '⋯')),
      d?.notes && h('p', { class: 'note small' }, d.notes),
      h('div', { class: 'set-row head muted small' }, h('span', {}, 'Set'), h('span', {}, 'Last'), h('span', {}, wUnit()), h('span', {}, 'Reps'), h('span', {}, '')),
      rows,
      h('div', { class: 'row gap' },
        h('button', { class: 'btn small', onclick: () => { upd(c => {
          const t = c.items[idx]; const last = t.sets[t.sets.length - 1]; const p = t.prev?.[t.sets.length];
          t.sets.push({ id: api.uuid(), set_no: t.sets.length + 1, reps: p?.reps ?? last?.reps ?? t.targetReps, weight_kg: p ? +p.weight_kg : last?.weight_kg ?? null, done: false }); }); rerender(); } }, '＋ Add set'),
        it.sets.length > 1 && h('button', { class: 'btn small ghost', onclick: () => { upd(c => {
          const s = c.items[idx].sets.pop(); if (s.done) api.remove('sets', 'id=eq.' + s.id); }); rerender(); } }, 'Remove last set')));
  });

  mount(root, header,
    cards,
    !w.items.length && h('p', { class: 'muted center' }, 'Add your first exercise to get started.'),
    h('button', { class: 'btn block', onclick: () => pickExercise(ex => {
      const cur = upd(c => c.items.push(newItem(ex.id)));
      rerender(); fillPrev(cur); }) }, '＋ Add exercise'),
    h('label', { class: 'field' }, h('span', {}, 'Workout notes'),
      h('textarea', { rows: 2, placeholder: 'How did it feel?', oninput: e => upd(c => (c.notes = e.target.value)) }, w.notes || '')),
    h('button', { class: 'btn danger ghost block', onclick: () => discard(active()) }, 'Discard workout'));

  clearInterval(renderWorkout.t);
  renderWorkout.t = setInterval(() => {
    const el = document.getElementById('elapsed'); const cur = active();
    if (!el || !cur) return clearInterval(renderWorkout.t);
    el.textContent = duration(cur.started_at, new Date());
  }, 15000);
}

// Keep saved sets' exercise order in sync after reordering.
function resequence() {
  const w = active(); if (!w) return;
  w.items.forEach(it => it.sets.filter(s => s.done).forEach(s => persistSet(w, it, s)));
}
