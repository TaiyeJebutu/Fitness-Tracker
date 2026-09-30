// Active workout logging, exercise picker, exercise details and the rest timer.
import * as api from './api.js';
import { state, exName, addExercise, lastSets, details, saveDetails, saveRoutine, setUnilateral, CATEGORIES } from './store.js';
import { checkBadges } from './badges.js';
import { musclePicker, AREA_MUSCLES, workoutMuscles } from './musclemap.js';
import { h, mount, toast, sheet, confirmSheet, fmtW, toW, fromW, wUnit, clock, duration, currentPage, ic, haptic, confetti, rirText, showRir, holdScreenOn } from './ui.js';

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
  for (const it of routine?.items || []) w.items.push(newItem(it.exercise_id, it.rest, it.sets, it.reps, knownUni(it.exercise_id)));
  save(w);
  api.upsert('workouts', { id: w.id, name: w.name, routine_id: w.routine_id, started_at: w.started_at, owner: api.userId() });
  location.hash = '#/workout';
  fillPrev(w);
}

function newItem(exercise_id, rest = 90, sets = 3, reps = null, uni = false) {
  const it = { key: api.uuid(), exercise_id, rest: rest || 90, targetReps: reps || null, prev: null, uni: false, sets: [] };
  layout(it, Math.max(1, sets || 1), uni);
  return it;
}

// Unilateral exercises get an L and an R row per set; others one row per set.
const SIDES = uni => (uni ? ['L', 'R'] : [null]);
function layout(it, count, uni) {
  it.uni = !!uni;
  it.sets = [];
  for (let n = 1; n <= count; n++)
    for (const side of SIDES(uni)) it.sets.push({ id: api.uuid(), set_no: n, side, reps: it.targetReps || null, weight_kg: null, done: false });
}
const setCount = it => new Set(it.sets.map(s => s.set_no)).size;
/** Left/right setting this phone already knows about (so rows appear correctly straight away). */
const knownUni = id => !!api.LS.get('ft.details.' + id)?.unilateral;
const label = s => s.set_no + (s.side || '');

/** Last time's numbers for this row: same side and set number if possible. */
function prevFor(it, s) {
  const prev = it.prev || [];
  let pool = prev.filter(p => (p.side || null) === (s.side || null));
  if (!pool.length) pool = prev.filter((p, i, a) => a.findIndex(q => q.set_no === p.set_no) === i); // other mode last time
  return pool[s.set_no - 1] || null;
}

async function fillPrev(w) {
  await Promise.all(w.items.filter(it => it.prev == null).map(async it => {
    const [prev, d] = await Promise.all([lastSets(it.exercise_id, w.id).catch(() => []), details(it.exercise_id).catch(() => null)]);
    const cur = active(); if (!cur || cur.id !== w.id) return;
    const target = cur.items.find(x => x.key === it.key); if (!target) return;
    target.prev = prev;
    if (!!d?.unilateral !== target.uni && !target.sets.some(s => s.done)) layout(target, setCount(target), d?.unilateral);
    // prefill empty rows with last time's numbers
    target.sets.forEach(s => {
      const p = prevFor(target, s) || prev[prev.length - 1];
      if (p && !s.done) { if (s.weight_kg == null) s.weight_kg = +p.weight_kg; if (s.reps == null) s.reps = p.reps; }
    });
    save(cur);
  }));
  if (location.hash.startsWith('#/workout')) renderWorkout(currentPage());
}

function persistSet(w, item, s) {
  const position = w.items.indexOf(item);
  api.upsert('sets', { id: s.id, workout_id: w.id, owner: api.userId(), exercise_id: item.exercise_id,
    position, set_no: s.set_no, reps: s.reps || 0, weight_kg: s.weight_kg || 0, rir: s.rir ?? null, ...(s.side ? { side: s.side } : {}) });
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
  setTimeout(checkBadges, 300);
  const doneItems = w.items.filter(it => it.sets.some(s => s.done));
  const asRoutineItems = doneItems.map(it => ({ exercise_id: it.exercise_id, sets: new Set(it.sets.filter(s => s.done).map(s => s.set_no)).size,
    reps: it.targetReps || it.sets.find(s => s.done)?.reps || null, rest: it.rest }));
  const routine = state.routines.find(r => r.id === w.routine_id);
  location.hash = '#/history/' + w.id;  // switch screen first, then show the pop-up on top
  confetti();
  sheet('Workout saved', close => h('div', {},
    h('div', { class: 'saved-hero' }, h('span', { class: 'saved-ico' }, ic('check', 30)),
      h('p', {}, h('strong', {}, `${logged} set${logged === 1 ? '' : 's'}`), ' · ', duration(w.started_at, ended))),
    workoutMuscles(doneItems.flatMap(it => it.sets.filter(s => s.done).map(s => ({ exercise_id: it.exercise_id, side: s.side })))),
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
  location.hash = '#/train';
}

// ---------- rest timer ---------------------------------------------------
const RKEY = 'ft.rest';
export const restState = () => api.LS.get(RKEY);
/** Start the floating countdown: the automatic rest timer, or a warm-up / any-time timer (label 'Timer'). */
export function startRest(seconds, label = 'Rest') {
  api.LS.set(RKEY, { end: Date.now() + seconds * 1000, total: seconds, beeped: false, label });
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
  if (!r) { bar.hidden = true; holdScreenOn(false); return; }
  holdScreenOn(true);
  const left = Math.ceil((r.end - Date.now()) / 1000);
  if (left <= 0 && !r.beeped) { r.beeped = true; api.LS.set(RKEY, r); beep(); }
  if (left <= -5) { stopRest(); return; }
  bar.hidden = false;
  mount(bar,
    h('div', { class: 'rest-fill', style: { width: Math.max(0, Math.min(100, (left / r.total) * 100)) + '%' } }),
    h('div', { class: 'rest-time' }, ic('timer', 22), h('span', {}, left > 0 ? clock(left) : 'Go!'), h('span', { class: 'rest-label' }, r.label || 'Rest')),
    h('button', { class: 'icon-btn', onclick: () => adjustRest(-15), 'aria-label': 'Minus 15 seconds' }, '−15'),
    h('button', { class: 'icon-btn', onclick: () => adjustRest(15), 'aria-label': 'Plus 15 seconds' }, '+15'),
    h('button', { class: 'icon-btn', onclick: stopRest, 'aria-label': 'Stop rest timer' }, 'Skip'));
}
setInterval(tickRest, 250);

// ---------- any-time countdown (warm-ups, stretches…) --------------------------
const TKEY = 'ft.timerLast';
export function timerSheet() {
  const last = api.LS.get(TKEY) || 60;
  sheet('Timer', close => {
    const go = s => { if (!(s >= 5 && s <= 3600)) return toast('Pick between 5 seconds and 60 minutes', 'err'); api.LS.set(TKEY, s); startRest(s, 'Timer'); haptic(); close(); };
    let m = String(Math.floor(last / 60)), sec = String(last % 60);
    const num = (label, v, max, set) => h('label', { class: 'field compact' }, h('span', {}, label),
      h('input', { type: 'number', inputmode: 'numeric', min: 0, max, step: 1, value: v, 'aria-label': label, 'data-noautofocus': '1', oninput: e => set(e.target.value) }));
    return h('div', {},
      h('p', { class: 'muted small' }, 'A countdown for warm-ups, stretches or anything else. It uses the same floating timer as rest (starting one replaces the other).'),
      h('div', { class: 'timer-presets' }, [30, 60, 90, 120, 180].map(s => h('button', { class: 'btn timer-preset', onclick: () => go(s) }, s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60} min`))),
      h('div', { class: 'pick-head' }, 'Or choose a time'),
      h('div', { class: 'row gap dur' }, num('Minutes', m, 60, v => (m = v)), num('Seconds', sec, 59, v => (sec = v))),
      h('button', { class: 'btn primary block', onclick: () => go((+m || 0) * 60 + (+sec || 0)) }, ic('play', 18), 'Start timer'),
      restState() && h('button', { class: 'btn ghost block', onclick: () => { stopRest(); close(); } }, 'Stop the current timer'));
  });
}

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
        ql && !exact && h('button', { class: 'list-item create', onclick: () => createFlow(q.trim()) }, ic('plus', 18), `Create “${q.trim()}”`),
        items.slice(0, 150).map(x => h('button', { class: 'list-item', onclick: () => { close(); onPick(x); } },
          h('span', {}, x.name), h('span', { class: 'muted small' }, x.owner ? 'Custom · ' + x.category : x.category))),
        !items.length && !ql && h('p', { class: 'muted center' }, 'No exercises in this category.'));
    };
    const createFlow = name => {
      chips.hidden = true;
      mount(list, exerciseForm({ name }, f => { const ex = createExercise(f); close(); onPick(ex); }, 'Create & add'));
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

// ---------- create / edit an exercise ------------------------------------
/** Form for an exercise's name, body area and left/right. Calls onSubmit({name, category, unilateral}). */
export function exerciseForm(init, onSubmit, submitLabel = 'Save') {
  const f = { name: init.name || '', category: init.category || '', unilateral: !!init.unilateral,
    muscles: [...(init.muscles || [])], muscles2: [...(init.muscles2 || [])] };
  const picker = musclePicker(f);
  const err = h('p', { class: 'error', role: 'alert' });
  const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Body area' });
  const drawChips = () => mount(chips, CATEGORIES.map(c => h('button', { type: 'button', class: 'chip' + (c === f.category ? ' on' : ''), role: 'radio',
    'aria-checked': String(c === f.category), onclick: () => {
      f.category = c; drawChips();
      // no muscles picked yet: start from the usual ones for this body area
      if (!f.muscles.length && !f.muscles2.length && AREA_MUSCLES[c]) { [f.muscles, f.muscles2] = AREA_MUSCLES[c].map(x => [...x]); picker.redraw(); }
    } }, c)));
  drawChips();
  return h('form', { class: 'exercise-form', onsubmit: e => {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) return (err.textContent = 'Give it a name');
    if (!f.category) return (err.textContent = 'Pick a body area');
    const clash = state.exercises.find(x => x.id !== init.id && (x.owner == null || x.owner === api.userId()) && x.name.toLowerCase() === name.toLowerCase());
    if (clash) return (err.textContent = `You already have “${clash.name}”`);
    onSubmit({ ...f, name: name.slice(0, 80) });
  } },
    h('label', { class: 'field' }, h('span', {}, 'Name'),
      h('input', { value: f.name, maxlength: 80, placeholder: 'e.g. Single-leg Press', 'data-noautofocus': init.name ? '1' : null, oninput: e => (f.name = e.target.value) })),
    h('div', { class: 'field' }, h('span', {}, 'Body area'), chips),
    picker,
    h('label', { class: 'switch uni-switch' },
      h('input', { type: 'checkbox', checked: f.unilateral, onchange: e => (f.unilateral = e.target.checked) }),
      h('span', {}, h('strong', {}, 'Unilateral (left & right)'), h('br'), h('span', { class: 'muted small' }, 'Log each side separately'))),
    err,
    h('button', { class: 'btn primary block', type: 'submit' }, submitLabel));
}

export function createExercise(f) {
  const ex = addExercise(f.name, f.category, f.muscles, f.muscles2);
  if (f.unilateral) setUnilateral(ex.id, true);
  toast('Exercise created');
  return ex;
}

export function newExerciseSheet(onCreated) {
  sheet('New exercise', close => exerciseForm({}, f => { const ex = createExercise(f); close(); onCreated?.(ex); }, 'Create exercise'));
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
      notes: d.notes || '', adjustments: (d.adjustments || []).map(a => ({ ...a })), unilateral: !!d.unilateral };
    const adjBox = h('div', {});
    const drawAdj = () => mount(adjBox, f.adjustments.map((a, i) => h('div', { class: 'row gap adj' },
      h('input', { placeholder: 'e.g. Back pad', value: a.label, 'aria-label': 'Adjustment name', oninput: e => (a.label = e.target.value) }),
      h('input', { placeholder: 'e.g. 4', value: a.value, 'aria-label': 'Adjustment value', class: 'short', oninput: e => (a.value = e.target.value) }),
      h('button', { class: 'icon-btn', 'aria-label': 'Remove adjustment', onclick: () => { f.adjustments.splice(i, 1); drawAdj(); } }, ic('close', 18)))),
      h('button', { class: 'btn small', onclick: () => { f.adjustments.push({ label: '', value: '' }); drawAdj(); } }, ic('plus', 18), 'Add adjustment'));
    drawAdj();
    const field = (label, key, ph) => h('label', { class: 'field' }, h('span', {}, label),
      h('input', { value: f[key], placeholder: ph, oninput: e => (f[key] = e.target.value), 'data-noautofocus': '1' }));
    return h('div', {},
      h('label', { class: 'switch uni-switch' },
        h('input', { type: 'checkbox', checked: f.unilateral, 'data-noautofocus': '1', onchange: e => (f.unilateral = e.target.checked) }),
        h('span', {}, h('strong', {}, 'Unilateral (left & right)'), h('br'), h('span', { class: 'muted small' }, 'Log each side separately'))),
      h('p', { class: 'muted small' }, 'Only you can see these settings.'),
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
let lastTicked = null;   // the set just ticked gets a little 'pop'
let rirOpen = null;      // the set whose reps-in-reserve picker is showing

export function renderWorkout(root) {
  const w = active();
  if (!w) {
    mount(root, h('div', { class: 'empty' }, h('p', {}, 'No workout in progress.'), h('a', { class: 'btn primary', href: '#/train' }, 'Go to Train')));
    return;
  }
  const rerender = () => renderWorkout(root);
  const upd = fn => { const cur = active(); fn(cur); save(cur); return cur; };

  const since = () => { const t = Math.max(0, Math.floor((Date.now() - new Date(w.started_at)) / 1000)); return t >= 3600 ? `${Math.floor(t / 3600)}:${clock(t % 3600).padStart(5, '0')}` : clock(t).padStart(5, '0'); };
  const elapsed = h('div', { class: 'wk-clock', id: 'elapsed', 'aria-label': 'Time since you started' }, since());
  const doneSets = w.items.reduce((n, it) => n + it.sets.filter(s => s.done).length, 0);
  const doneEx = w.items.filter(it => it.sets.length && it.sets.every(s => s.done)).length;
  const header = h('div', {},
    h('div', { class: 'wk-head' },
      h('input', { class: 'wk-name', value: w.name, 'aria-label': 'Workout name', onchange: e => {
        const cur = upd(c => (c.name = e.target.value || 'Workout'));
        api.upsert('workouts', { id: cur.id, name: cur.name, owner: api.userId(), started_at: cur.started_at }); } }),
      h('button', { class: 'btn dark', onclick: () => finish(active()) }, 'Finish')),
    elapsed,
    h('div', { class: 'wk-subrow' },
      h('div', { class: 'wk-sub' }, w.items.length ? `${doneEx} of ${w.items.length} exercise${w.items.length === 1 ? '' : 's'} done · ${doneSets} set${doneSets === 1 ? '' : 's'} logged` : 'Add an exercise to begin'),
      h('button', { class: 'btn small timer-btn', onclick: timerSheet }, ic('timer', 16), 'Timer')));

  const cards = w.items.map((it, idx) => {
    const d = detailCache.get(it.exercise_id);
    if (d === undefined) {
      detailCache.set(it.exercise_id, null);
      details(it.exercise_id).then(x => { detailCache.set(it.exercise_id, x); if (x) rerender(); });
    }
    const summary = detailsSummary(d);
    const onDetails = f => {
      detailCache.set(it.exercise_id, f);
      if (f.unilateral !== it.uni) {
        const cur = active(); const t = cur.items[idx];
        if (t.sets.some(s => s.done)) toast('Left/right will apply next time you add this exercise');
        else { layout(t, setCount(t), f.unilateral); t.sets.forEach(s => { const p = prevFor(t, s); if (p) { s.weight_kg = +p.weight_kg; s.reps = p.reps; } }); save(cur); }
      }
      rerender();
    };
    const rows = it.sets.map((s, si) => {
      const p = prevFor(it, s);
      const side = s.side === 'L' ? ' left' : s.side === 'R' ? ' right' : '';
      const wIn = h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: 0, class: 'num',
        value: s.weight_kg == null ? '' : +toW(s.weight_kg).toFixed(2), 'aria-label': `Set ${s.set_no}${side} weight in ${wUnit()}`,
        onchange: e => { const cur = upd(c => { const t = c.items[idx].sets[si]; t.weight_kg = e.target.value === '' ? null : fromW(+e.target.value); });
          if (s.done) persistSet(cur, cur.items[idx], cur.items[idx].sets[si]); } });
      const rIn = h('input', { type: 'number', inputmode: 'numeric', min: 0, step: 1, class: 'num',
        value: s.reps ?? '', placeholder: it.targetReps || '', 'aria-label': `Set ${s.set_no}${side} reps`,
        onchange: e => { const cur = upd(c => { c.items[idx].sets[si].reps = e.target.value === '' ? null : Math.round(+e.target.value); });
          if (s.done) persistSet(cur, cur.items[idx], cur.items[idx].sets[si]); } });
      const tick = h('button', { class: 'tick' + (s.done ? ' on' : '') + (s.id === lastTicked ? ' pop' : ''), 'aria-pressed': String(s.done), 'aria-label': `Log set ${s.set_no}${side}`,
        onclick: () => {
          const cur = upd(c => {
            const t = c.items[idx].sets[si];
            if (!t.done && (t.reps == null || t.reps === 0)) t.reps = it.targetReps || p?.reps || null;
            if (!t.done && t.weight_kg == null) t.weight_kg = p ? +p.weight_kg : 0;
            t.done = !t.done && !!t.reps;
          });
          const t = cur.items[idx].sets[si];
          if (t.done) { persistSet(cur, cur.items[idx], t); startRest(it.rest); lastTicked = t.id; rirOpen = t.id; haptic(); }
          else if (rirOpen === t.id) rirOpen = null;
          else if (!t.reps) toast('Enter reps first');
          else api.remove('sets', 'id=eq.' + t.id);
          rerender();
        } }, ic('check', 22));
      const rir = showRir();
      const setRir = v => { const cur = upd(c => { const t = c.items[idx].sets[si]; t.rir = t.rir === v ? null : v; });
        const t = cur.items[idx].sets[si]; if (t.done) persistSet(cur, cur.items[idx], t); rirOpen = null; haptic(8); rerender(); };
      const no = rir && s.done
        ? h('button', { class: 'set-no rir-toggle' + (s.side ? ' sided' : ''), 'aria-label': `RIR for set ${s.set_no}${side}${s.rir != null ? ': ' + rirText(s.rir) : ''} — tap to change`,
            onclick: () => { rirOpen = rirOpen === s.id ? null : s.id; rerender(); } }, label(s), s.rir != null && h('small', {}, rirText(s.rir) + ' RIR'))
        : h('span', { class: 'set-no' + (s.side ? ' sided' : '') }, label(s));
      const row = h('div', { class: 'set-row' + (s.done ? ' done' : '') + (s.side === 'R' ? ' side-r' : '') },
        no,
        h('span', { class: 'prev muted small' }, p ? `${fmtW(p.weight_kg, false)}×${p.reps}${rir && p.rir != null ? ' @' + rirText(p.rir) : ''}` : '—'),
        wIn, rIn, tick);
      if (!(rir && s.done && rirOpen === s.id)) return row;
      return [row, h('div', { class: 'rir-pick', role: 'group', 'aria-label': `Reps in reserve for set ${s.set_no}${side}` },
        h('span', { class: 'rir-label' }, 'RIR'),
        [0, 1, 2, 3, 4, 5].map(v => h('button', { class: 'rir-btn' + (s.rir === v ? ' on' : ''), 'aria-pressed': String(s.rir === v), onclick: () => setRir(v) }, rirText(v))),
        h('button', { class: 'icon-btn rir-close', 'aria-label': 'Skip', onclick: () => { rirOpen = null; rerender(); } }, ic('close', 16)))];
    });
    const menu = () => sheet(exName(it.exercise_id), close => h('div', { class: 'stack' },
      h('button', { class: 'btn block', onclick: () => { close(); editDetails(it.exercise_id, onDetails); } }, 'Machine & seat settings'),
      h('label', { class: 'field' }, h('span', {}, 'Rest timer (seconds)'),
        h('input', { type: 'number', inputmode: 'numeric', min: 0, step: 15, value: it.rest, 'data-noautofocus': '1',
          onchange: e => { upd(c => (c.items[idx].rest = Math.max(0, +e.target.value || 0))); } })),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn', disabled: idx === 0, onclick: () => { upd(c => c.items.splice(idx - 1, 0, c.items.splice(idx, 1)[0])); resequence(); close(); rerender(); } }, ic('up', 18), 'Move up'),
        h('button', { class: 'btn', disabled: idx === w.items.length - 1, onclick: () => { upd(c => c.items.splice(idx + 1, 0, c.items.splice(idx, 1)[0])); resequence(); close(); rerender(); } }, ic('down', 18), 'Move down')),
      h('button', { class: 'btn danger block', onclick: () => {
        const cur = active(); cur.items[idx].sets.filter(s => s.done).forEach(s => api.remove('sets', 'id=eq.' + s.id));
        cur.items.splice(idx, 1); save(cur); resequence(); close(); rerender(); } }, 'Remove exercise')));

    return h('section', { class: 'card ex-card' },
      h('div', { class: 'ex-head' },
        h('button', { class: 'ex-title', onclick: () => editDetails(it.exercise_id, onDetails) },
          h('strong', {}, exName(it.exercise_id)),
          h('span', { class: 'settings-chip' }, ic('settings', 14), summary || 'Add machine / seat settings')),
        h('button', { class: 'icon-btn', 'aria-label': 'Exercise options', onclick: menu }, ic('more', 22))),
      d?.notes && h('p', { class: 'note small' }, d.notes),
      h('div', { class: 'set-row head muted small' }, h('span', {}, 'Set'), h('span', {}, 'Last'), h('span', {}, wUnit()), h('span', {}, 'Reps'), h('span', {}, '')),
      rows,
      h('div', { class: 'row gap' },
        h('button', { class: 'btn small', onclick: () => { upd(c => {
          const t = c.items[idx]; const n = setCount(t) + 1;
          for (const side of SIDES(t.uni)) {
            const last = [...t.sets].reverse().find(x => (x.side || null) === side);
            const row = { id: api.uuid(), set_no: n, side, done: false };
            const p = prevFor(t, row);
            t.sets.push({ ...row, reps: p?.reps ?? last?.reps ?? t.targetReps, weight_kg: p ? +p.weight_kg : last?.weight_kg ?? null });
          } }); rerender(); } }, ic('plus', 18), 'Add set'),
        setCount(it) > 1 && h('button', { class: 'btn small ghost', onclick: () => { upd(c => {
          const t = c.items[idx]; const n = setCount(t);
          t.sets.filter(x => x.set_no === n && x.done).forEach(x => api.remove('sets', 'id=eq.' + x.id));
          t.sets = t.sets.filter(x => x.set_no !== n); }); rerender(); } }, 'Remove last set')));
  });

  mount(root, header,
    cards,
    !w.items.length && h('p', { class: 'muted center' }, 'Add your first exercise to get started.'),
    h('button', { class: 'btn block', onclick: () => pickExercise(ex => {
      const cur = upd(c => c.items.push(newItem(ex.id, 90, 3, null, knownUni(ex.id))));
      rerender(); fillPrev(cur); }) }, ic('plus', 18), 'Add exercise'),
    h('label', { class: 'field' }, h('span', {}, 'Workout notes'),
      h('textarea', { rows: 2, placeholder: 'How did it feel?', oninput: e => upd(c => (c.notes = e.target.value)) }, w.notes || '')),
    h('button', { class: 'btn danger ghost block', onclick: () => discard(active()) }, 'Discard workout'));

  lastTicked = null;
  clearInterval(renderWorkout.t);
  renderWorkout.t = setInterval(() => {
    const el = document.getElementById('elapsed');
    if (!el || !active()) return clearInterval(renderWorkout.t);
    el.textContent = since();
  }, 1000);
}

// Keep saved sets' exercise order in sync after reordering.
function resequence() {
  const w = active(); if (!w) return;
  w.items.forEach(it => it.sets.filter(s => s.done).forEach(s => persistSet(w, it, s)));
}
