// Train home, routine editor, history, and per-exercise history.
import * as api from './api.js';
import { state, exName, loadRoutines, saveRoutine } from './store.js';
import { active, startWorkout, pickExercise, editDetails, detailsSummary, exerciseForm, newExerciseSheet } from './workout.js';
import { details, setUnilateral, updateExercise, deleteExercise, CATEGORIES } from './store.js';
import { avatar } from './avatar.js';
import { h, mount, toast, sheet, confirmSheet, fmtW, fmtDate, fmtDay, duration, ago, spinner, lineChart, e1rm, toW, wUnit } from './ui.js';

// ---------- Train home ---------------------------------------------------
export async function renderTrain(root) {
  const draw = () => {
    const a = active();
    mount(root,
      a && h('a', { class: 'card resume', href: '#/workout' },
        h('strong', {}, 'Workout in progress'), h('span', { class: 'muted small' }, `${a.name} · started ${ago(a.started_at)}`),
        h('span', { class: 'btn primary small' }, 'Resume')),
      !a && h('button', { class: 'btn primary block big', onclick: () => startWorkout(null) }, 'Start empty workout'),
      h('div', { class: 'section-head' }, h('h2', {}, 'Routines'), h('a', { class: 'btn small', href: '#/routine/new' }, '＋ New')),
      state.routines.length ? state.routines.map(r => h('div', { class: 'card routine' },
        h('a', { class: 'routine-info', href: '#/routine/' + r.id },
          h('strong', {}, r.name),
          h('span', { class: 'muted small' }, (r.items || []).map(i => exName(i.exercise_id)).join(', ') || 'No exercises yet')),
        h('button', { class: 'btn primary small', disabled: !!a, onclick: () => startWorkout(r) }, 'Start')))
        : h('p', { class: 'muted' }, 'Save your usual sessions (e.g. “Push day”) as routines to start them in one tap.'),
      h('div', { class: 'section-head' }, h('h2', {}, 'Recent'), h('a', { class: 'btn small ghost', href: '#/history' }, 'All history')),
      recent);
  };
  const recent = h('div', {}, spinner());
  draw();
  loadRoutines().then(draw).catch(() => {});
  history(5).then(list => mount(recent, list.length ? list.map(workoutCard) : h('p', { class: 'muted' }, 'No workouts yet.')))
    .catch(e => mount(recent, h('p', { class: 'muted' }, e.message)));
}

async function history(limit = 50) {
  const uid = api.userId();
  return api.get(`workouts?owner=eq.${uid}&ended_at=not.is.null&select=id,name,started_at,ended_at,sets(exercise_id,reps,weight_kg,side)&order=started_at.desc&limit=${limit}`);
}

export function workoutCard(wk, who, prof) {
  const byEx = new Map();
  for (const s of wk.sets || []) byEx.set(s.exercise_id, [...(byEx.get(s.exercise_id) || []), s]);
  const vol = (wk.sets || []).reduce((t, s) => t + s.weight_kg * s.reps, 0);
  // a left + right pair counts as one set
  const count = sets => (sets.some(s => s.side) ? Math.max(sets.filter(s => s.side === 'L').length, sets.filter(s => s.side === 'R').length, sets.filter(s => !s.side).length) : sets.length);
  const total = [...byEx.values()].reduce((n, sets) => n + count(sets), 0);
  return h('a', { class: 'card wk-card', href: '#/history/' + wk.id },
    h('div', { class: 'row between' },
      h('span', { class: 'row gap' }, prof && avatar(prof, 28), h('strong', {}, who ? `${who} · ${wk.name}` : wk.name)),
      h('span', { class: 'muted small' }, fmtDate(wk.started_at))),
    h('div', { class: 'muted small' }, `${total} sets · ${fmtW(vol)} total${wk.ended_at ? ' · ' + duration(wk.started_at, wk.ended_at) : ''}`),
    h('ul', { class: 'wk-lines' }, [...byEx].slice(0, 6).map(([id, sets]) => {
      const best = sets.reduce((b, s) => (+s.weight_kg > +b.weight_kg ? s : b), sets[0]);
      return h('li', {}, h('span', {}, `${count(sets)} × ${exName(id)}${sets.some(s => s.side) ? ' (L/R)' : ''}`), h('span', { class: 'muted' }, `${fmtW(best.weight_kg)} × ${best.reps}`));
    }), byEx.size > 6 && h('li', { class: 'muted' }, `+${byEx.size - 6} more`)));
}

export async function renderHistory(root) {
  mount(root, h('h1', {}, 'History'), spinner());
  try {
    const list = await history(100);
    mount(root, h('h1', {}, 'History'), list.length ? list.map(w => workoutCard(w)) : h('p', { class: 'muted' }, 'No workouts yet.'));
  } catch (e) { mount(root, h('h1', {}, 'History'), h('p', { class: 'muted' }, e.message)); }
}

export async function renderWorkoutDetail(root, id) {
  mount(root, spinner());
  let wk;
  try { wk = (await api.get(`workouts?id=eq.${id}&select=*,profiles(username,avatar_icon,avatar_color),sets(*)`))?.[0]; }
  catch (e) { mount(root, h('p', { class: 'muted' }, e.message)); return; }
  if (!wk) {
    // may still be waiting to sync
    mount(root, h('p', { class: 'muted' }, api.pendingCount() ? 'This workout is saved on your phone and will appear once it syncs.' : 'Workout not found.'),
      h('a', { class: 'btn', href: '#/' }, 'Back'));
    return;
  }
  const mine = wk.owner === api.userId();
  const groups = new Map();
  for (const s of (wk.sets || []).sort((a, b) => a.position - b.position || a.set_no - b.set_no))
    groups.set(s.exercise_id, [...(groups.get(s.exercise_id) || []), s]);
  mount(root,
    h('a', { class: 'back', href: mine ? '#/history' : '#/feed' }, '‹ Back'),
    h('h1', {}, wk.name),
    h('p', { class: 'muted' }, `${mine ? '' : '@' + wk.profiles?.username + ' · '}${fmtDay(wk.started_at)}${wk.ended_at ? ' · ' + duration(wk.started_at, wk.ended_at) : ''}`),
    wk.notes && h('p', { class: 'note' }, wk.notes),
    [...groups].map(([exId, sets]) => h('section', { class: 'card' },
      h('a', { href: '#/exercise/' + exId }, h('strong', {}, exName(exId))),
      h('ol', { class: 'set-list' }, sets.map(s => h('li', {}, s.side && h('span', { class: 'side-tag' }, s.side), `${fmtW(s.weight_kg)} × ${s.reps}`,
        e1rm(s.weight_kg, s.reps) && h('span', { class: 'muted small' }, ` · e1RM ${fmtW(e1rm(s.weight_kg, s.reps))}`)))))),
    mine && h('button', { class: 'btn danger ghost block', onclick: async () => {
      if (!(await confirmSheet('Delete workout?', 'This removes the workout and all its sets.'))) return;
      api.remove('workouts', 'id=eq.' + wk.id); toast('Deleted'); location.hash = '#/history'; } }, 'Delete workout'));
}

// ---------- Routine editor -----------------------------------------------
export async function renderRoutine(root, id) {
  if (!state.routines.length) await loadRoutines().catch(() => {});
  const existing = state.routines.find(r => r.id === id);
  if (id !== 'new' && !existing) { mount(root, h('p', { class: 'muted' }, 'Routine not found.'), h('a', { class: 'btn', href: '#/' }, 'Back')); return; }
  const r = existing ? JSON.parse(JSON.stringify(existing)) : { id: api.uuid(), name: '', items: [] };
  const list = h('div', {});
  const uni = new Map();   // exercise id -> left/right setting (per exercise, shared everywhere)
  const loadUni = ids => Promise.all(ids.filter(x => !uni.has(x)).map(async x => uni.set(x, !!(await details(x).catch(() => null))?.unilateral)));
  const draw = () => mount(list, r.items.map((it, i) => h('div', { class: 'card routine-item' },
    h('div', { class: 'row between' }, h('strong', {}, exName(it.exercise_id)),
      h('div', { class: 'row' },
        h('button', { class: 'icon-btn', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { r.items.splice(i - 1, 0, r.items.splice(i, 1)[0]); draw(); } }, '↑'),
        h('button', { class: 'icon-btn', 'aria-label': 'Move down', disabled: i === r.items.length - 1, onclick: () => { r.items.splice(i + 1, 0, r.items.splice(i, 1)[0]); draw(); } }, '↓'),
        h('button', { class: 'icon-btn', 'aria-label': 'Remove', onclick: () => { r.items.splice(i, 1); draw(); } }, '✕'))),
    h('div', { class: 'row gap' },
      num('Sets', it.sets, v => (it.sets = v || 1)),
      num('Reps', it.reps, v => (it.reps = v || null)),
      num('Rest (s)', it.rest, v => (it.rest = v || 90), 15)),
    h('label', { class: 'switch small-switch' },
      h('input', { type: 'checkbox', checked: !!uni.get(it.exercise_id), onchange: e => {
        uni.set(it.exercise_id, e.target.checked); setUnilateral(it.exercise_id, e.target.checked);
        toast(e.target.checked ? 'Left & right on for this exercise' : 'Left & right off'); } }),
      h('span', {}, 'Left & right (unilateral)')))),
    !r.items.length && h('p', { class: 'muted center' }, 'No exercises yet.'));
  draw();
  loadUni(r.items.map(i => i.exercise_id)).then(draw);
  mount(root,
    h('a', { class: 'back', href: '#/' }, '‹ Back'),
    h('h1', {}, existing ? 'Edit routine' : 'New routine'),
    h('label', { class: 'field' }, h('span', {}, 'Name'),
      h('input', { value: r.name, placeholder: 'e.g. Push day', oninput: e => (r.name = e.target.value), 'data-noautofocus': '1' })),
    list,
    h('button', { class: 'btn block', onclick: () => pickExercise(async ex => { r.items.push({ exercise_id: ex.id, sets: 3, reps: 10, rest: 90 }); draw(); await loadUni([ex.id]); draw(); }) }, '＋ Add exercise'),
    h('button', { class: 'btn primary block', onclick: () => {
      if (!r.name.trim()) return toast('Give the routine a name', 'err');
      saveRoutine({ id: r.id, name: r.name.trim(), items: r.items }); toast('Routine saved'); location.hash = '#/'; } }, 'Save routine'),
    existing && h('button', { class: 'btn danger ghost block', onclick: async () => {
      if (!(await confirmSheet('Delete routine?', `“${r.name}” will be deleted. Past workouts are kept.`))) return;
      api.remove('routines', 'id=eq.' + r.id); state.routines = state.routines.filter(x => x.id !== r.id);
      toast('Deleted'); location.hash = '#/'; } }, 'Delete routine'));
}
function num(label, value, set, step = 1) {
  return h('label', { class: 'field compact' }, h('span', {}, label),
    h('input', { type: 'number', inputmode: 'numeric', min: 0, step, value: value ?? '', class: 'num', onchange: e => set(Math.round(+e.target.value)) }));
}

// ---------- Exercise history --------------------------------------------
export async function renderExercise(root, id) {
  mount(root, spinner());
  const uid = api.userId();
  const [d, sets] = await Promise.all([
    details(id).catch(() => null),
    api.get(`sets?owner=eq.${uid}&exercise_id=eq.${id}&select=workout_id,set_no,side,reps,weight_kg,created_at&order=created_at.asc&limit=2000`).catch(() => []),
  ]);
  const byWorkout = new Map();
  for (const s of sets) byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) || []), s]);
  const sessions = [...byWorkout.values()].map(ss => ({
    date: new Date(ss[0].created_at),
    best: Math.max(...ss.map(s => e1rm(s.weight_kg, s.reps) || 0)),
    top: ss.reduce((b, s) => (+s.weight_kg > +b.weight_kg ? s : b), ss[0]), sets: ss }));
  const bestSet = sets.reduce((b, s) => (!b || (e1rm(s.weight_kg, s.reps) || 0) > (e1rm(b.weight_kg, b.reps) || 0) ? s : b), null);
  const heaviest = sets.reduce((b, s) => (!b || +s.weight_kg > +b.weight_kg ? s : b), null);
  const summary = detailsSummary(d);
  const ex = state.exById.get(id);
  const mine = ex?.owner === uid;
  const edit = () => sheet('Edit exercise', close => exerciseForm({ id, name: ex.name, category: ex.category, unilateral: !!d?.unilateral }, f => {
    updateExercise(id, { name: f.name, category: f.category });
    if (f.unilateral !== !!d?.unilateral) setUnilateral(id, f.unilateral);
    toast('Saved'); close(); renderExercise(root, id);
  }));
  const remove = async () => {
    const n = sets.length;
    if (!(await confirmSheet(`Delete “${ex.name}”?`, n ? `This also deletes the ${n} set${n > 1 ? 's' : ''} you’ve logged for it. This can’t be undone.` : 'It will be removed from your exercise list and any routines.'))) return;
    try {
      await deleteExercise(id);
      for (const r of state.routines.filter(r => (r.items || []).some(i => i.exercise_id === id)))
        saveRoutine({ ...r, items: r.items.filter(i => i.exercise_id !== id) });
      toast('Exercise deleted'); location.hash = '#/exercises';
    } catch (e) { toast(e.message, 'err'); }
  };
  mount(root,
    h('a', { class: 'back', href: 'javascript:history.back()' }, '‹ Back'),
    h('h1', {}, exName(id)),
    ex && h('p', { class: 'muted small' }, `${ex.category}${mine ? ' · your exercise' : ' · built-in'}`),
    h('section', { class: 'card' },
      h('label', { class: 'switch' },
        h('input', { type: 'checkbox', checked: !!d?.unilateral, onchange: e => { setUnilateral(id, e.target.checked); toast(e.target.checked ? 'Left & right on' : 'Left & right off'); } }),
        h('span', {}, h('strong', {}, 'Unilateral (left & right)'), h('br'), h('span', { class: 'muted small' }, 'Log each side separately, everywhere this exercise is used')))),
    mine && h('div', { class: 'row gap' },
      h('button', { class: 'btn small', onclick: edit }, 'Rename / change area'),
      h('button', { class: 'btn small danger ghost', onclick: remove }, 'Delete exercise')),
    h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, 'My settings'),
        h('button', { class: 'btn small', onclick: () => editDetails(id, () => renderExercise(root, id)) }, 'Edit')),
      h('p', { class: 'muted small' }, summary || 'None saved yet — add seat height, machine brand/model and adjustments.'),
      d?.notes && h('p', { class: 'note small' }, d.notes)),
    h('div', { class: 'stats' },
      stat('Best e1RM', bestSet ? fmtW(e1rm(bestSet.weight_kg, bestSet.reps) || 0) : '—'),
      stat('Heaviest', heaviest ? `${fmtW(heaviest.weight_kg)} × ${heaviest.reps}` : '—'),
      stat('Sessions', sessions.length)),
    h('h2', {}, 'Estimated 1-rep max'),
    lineChart(sessions.filter(s => s.best > 0).map(s => ({ x: s.date, y: toW(s.best) })), { fmt: v => Math.round(v) + ' ' + wUnit(), label: `Estimated 1RM (${wUnit()})`, axis: v => Math.round(v) }),
    h('h2', {}, 'Sessions'),
    sessions.length ? [...sessions].reverse().slice(0, 30).map(s => h('div', { class: 'card row between' },
      h('span', {}, fmtDate(s.date)), h('span', { class: 'muted small right' }, s.sets.map(x => `${x.side || ''}${x.side ? ' ' : ''}${fmtW(x.weight_kg, false)}×${x.reps}`).join('  '))))
      : h('p', { class: 'muted' }, 'You haven’t logged this exercise yet.'));
}
export const stat = (label, value) => h('div', { class: 'stat' }, h('span', { class: 'muted small' }, label), h('strong', {}, value));

// ---------- Exercise library (Me → Exercises) -------------------------------
export function renderExercises(root) {
  const me = api.userId();
  let q = '', cat = '';
  const list = h('div', { class: 'list' });
  const draw = () => {
    const ql = q.trim().toLowerCase();
    const match = x => (x.owner == null || x.owner === me) && (!cat || x.category === cat) && (!ql || x.name.toLowerCase().includes(ql));
    const mine = state.exercises.filter(x => x.owner === me && match(x));
    const built = state.exercises.filter(x => x.owner == null && match(x));
    const row = x => h('a', { class: 'list-item', href: '#/exercise/' + x.id }, h('span', {}, x.name), h('span', { class: 'muted small' }, x.category + ' ›'));
    mount(list,
      h('h2', {}, `Your exercises (${mine.length})`),
      mine.length ? mine.map(row) : h('p', { class: 'muted small' }, ql || cat ? 'None match.' : 'None yet — create one with the button above.'),
      h('h2', {}, `Built-in (${built.length})`),
      built.map(row));
  };
  const chips = h('div', { class: 'chips scroll' }, ['', ...CATEGORIES].map(c =>
    h('button', { class: 'chip' + (c === cat ? ' on' : ''), onclick: e => {
      cat = c; chips.querySelectorAll('.chip').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); draw(); } }, c || 'All')));
  draw();
  mount(root,
    h('a', { class: 'back', href: '#/me' }, '‹ Me'),
    h('div', { class: 'section-head' }, h('h1', {}, 'Exercises'),
      h('button', { class: 'btn primary small', onclick: () => newExerciseSheet(ex => { location.hash = '#/exercise/' + ex.id; }) }, '＋ New')),
    h('p', { class: 'muted small' }, 'Tap an exercise to set left & right, machine settings, or see your history.'),
    h('input', { type: 'search', placeholder: 'Search exercises', 'aria-label': 'Search exercises', oninput: e => { q = e.target.value; draw(); } }),
    chips, list);
}
