// Export and import of a person's own data ("Export my data" files).
import * as api from './api.js';
import { state, loadExercises, loadRoutines } from './store.js';
import { h, mount, toast, sheet, confirmSheet, fmtDay } from './ui.js';

// ---------- export ---------------------------------------------------------
export async function exportData() {
  const uid = api.userId();
  try {
    const [profile, workouts, sets, routines, body, details, exercises] = await Promise.all([
      api.get(`profiles?id=eq.${uid}&select=username,units,shared_metrics`, { cache: false }),
      api.getAll(`workouts?owner=eq.${uid}&select=*&order=started_at.asc`),
      api.getAll(`sets?owner=eq.${uid}&select=*&order=created_at.asc`),
      api.getAll(`routines?owner=eq.${uid}&select=*&order=name`),
      api.getAll(`body_metrics?owner=eq.${uid}&select=*&order=measured_on.asc`),
      api.getAll(`exercise_details?user_id=eq.${uid}&select=*`),
      api.getAll(`exercises?owner=eq.${uid}&select=*`),
    ]);
    const byWorkout = new Map();
    for (const s of sets) byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) || []), s]);
    const names = Object.fromEntries(state.exercises.map(x => [x.id, x.name]));
    const data = { app: 'fitness-tracker', version: 1, exported_at: new Date().toISOString(),
      note: 'Weights in kg, lengths in cm.', profile: profile[0], exercise_names: names,
      custom_exercises: exercises, routines, workouts: workouts.map(w => ({ ...w, sets: byWorkout.get(w.id) || [] })),
      body_metrics: body, exercise_details: details };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: `fitness-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { toast(e.message, 'err'); }
}

// ---------- import: reading and checking the file ---------------------------
function parseBackup(text) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('That file isn’t a backup from this app (it isn’t valid JSON).'); }
  if (!d || typeof d !== 'object' || !Array.isArray(d.workouts) || !d.exported_at)
    throw new Error('That file isn’t a backup from this app.');
  const arr = x => (Array.isArray(x) ? x : []);
  return { ...d, routines: arr(d.routines), body_metrics: arr(d.body_metrics), exercise_details: arr(d.exercise_details),
    custom_exercises: arr(d.custom_exercises), exercise_names: d.exercise_names || {},
    workouts: d.workouts.map(w => ({ ...w, sets: arr(w.sets) })) };
}

/** Same input -> same id, so importing a file twice never creates copies. */
async function deriveId(oldId, uid) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${oldId}:${uid}`));
  const x = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-5${x.slice(13, 16)}-${'89ab'[parseInt(x[16], 16) % 4]}${x.slice(17, 20)}-${x.slice(20, 32)}`;
}

// ---------- import: writing -------------------------------------------------
async function runImport(d, mode, progress) {
  const uid = api.userId();
  const ow = mode === 'skip' ? 'skip' : 'overwrite';
  const now = new Date().toISOString();  // every row must have the same fields for a batch write
  progress('Checking what you already have…');
  const [myW, myR, myB] = await Promise.all([
    api.getAll(`workouts?owner=eq.${uid}&select=id`), api.getAll(`routines?owner=eq.${uid}&select=id`),
    api.getAll(`body_metrics?owner=eq.${uid}&select=id`)]);
  const mine = { w: new Set(myW.map(r => r.id)), r: new Set(myR.map(r => r.id)), b: new Set(myB.map(r => r.id)) };
  // keep the id if the row is already yours; otherwise (e.g. another account's backup) use a derived one
  const idFor = async (set, id) => (set.has(id) ? id : deriveId(id, uid));

  // Exercises: match by id, then by name; create any custom ones that are missing.
  progress('Matching exercises…');
  await loadExercises();
  const exMap = new Map();
  const byName = new Map(state.exercises.filter(x => x.owner == null || x.owner === uid).map(x => [x.name.toLowerCase(), x.id]));
  const customInfo = new Map(d.custom_exercises.map(x => [x.id, x]));
  const newExercises = [];
  const mapExercise = async id => {
    if (exMap.has(id)) return exMap.get(id);
    let out;
    const known = state.exById.get(id);
    if (known && (known.owner == null || known.owner === uid)) out = id;
    else {
      const name = (customInfo.get(id)?.name || d.exercise_names[id] || known?.name || 'Imported exercise').slice(0, 80);
      out = byName.get(name.toLowerCase());
      if (!out) {
        out = await deriveId(id, uid);
        newExercises.push({ id: out, owner: uid, name, category: customInfo.get(id)?.category || known?.category || 'Other' });
        byName.set(name.toLowerCase(), out);
      }
    }
    exMap.set(id, out);
    return out;
  };
  const referenced = new Set([...d.workouts.flatMap(w => w.sets.map(s => s.exercise_id)),
    ...d.routines.flatMap(r => (r.items || []).map(i => i.exercise_id)), ...d.exercise_details.map(x => x.exercise_id)]);
  for (const id of referenced) if (id) await mapExercise(id);

  const routineMap = new Map();
  const routines = [];
  for (const r of d.routines) {
    const id = await idFor(mine.r, r.id); routineMap.set(r.id, id);
    routines.push({ id, owner: uid, name: String(r.name || 'Routine').slice(0, 80), created_at: r.created_at || now, updated_at: r.updated_at || now,
      copied_from: r.copied_from ?? null, items: (r.items || []).filter(i => exMap.get(i.exercise_id)).map(i => ({ ...i, exercise_id: exMap.get(i.exercise_id) })) });
  }
  const workouts = [], sets = [];
  for (const w of d.workouts) {
    const id = await idFor(mine.w, w.id);
    const start = w.started_at || now;
    workouts.push({ id, owner: uid, name: w.name || 'Workout', notes: w.notes ?? null, started_at: start,
      ended_at: w.ended_at ?? start, routine_id: w.routine_id ? routineMap.get(w.routine_id) ?? null : null });
    for (const s of w.sets) {
      if (!exMap.get(s.exercise_id)) continue;
      sets.push({ id: id === w.id ? s.id : await deriveId(s.id, uid), workout_id: id, owner: uid, exercise_id: exMap.get(s.exercise_id),
        position: s.position ?? 0, set_no: s.set_no ?? 1, reps: s.reps ?? 0, weight_kg: s.weight_kg ?? 0, side: s.side === 'L' || s.side === 'R' ? s.side : null, created_at: s.created_at || start });
    }
  }
  const body = [];
  for (const b of d.body_metrics)
    body.push({ id: await idFor(mine.b, b.id), owner: uid, metric: b.metric, value: b.value, measured_on: b.measured_on || now.slice(0, 10), created_at: b.created_at || now });
  const details = d.exercise_details.filter(x => exMap.get(x.exercise_id)).map(x => ({
    user_id: uid, exercise_id: exMap.get(x.exercise_id), machine_brand: x.machine_brand ?? null, machine_model: x.machine_model ?? null,
    seat_height: x.seat_height ?? null, adjustments: x.adjustments || [], notes: x.notes ?? null, unilateral: !!x.unilateral, updated_at: x.updated_at || now }));

  if (mode === 'replace') {
    progress('Clearing your current data…');
    await Promise.all([
      api.removeNow('workouts', `owner=eq.${uid}`), api.removeNow('routines', `owner=eq.${uid}`),
      api.removeNow('body_metrics', `owner=eq.${uid}`), api.removeNow('exercise_details', `user_id=eq.${uid}`)]);
  }
  progress('Adding exercises…');   await api.bulkUpsert('exercises', newExercises, 'skip');
  progress('Adding routines…');    await api.bulkUpsert('routines', routines, ow);
  progress('Adding workouts…');    await api.bulkUpsert('workouts', workouts, ow);
  progress(`Adding ${sets.length} sets…`); await api.bulkUpsert('sets', sets, ow);
  progress('Adding body stats…');  await api.bulkUpsert('body_metrics', body, ow);
  progress('Adding exercise settings…'); await api.bulkUpsert('exercise_details', details, ow, 'user_id,exercise_id');
  Object.keys(localStorage).filter(k => k.startsWith('ft.cache.') || k.startsWith('ft.details.')).forEach(k => api.LS.del(k));
  await Promise.all([loadExercises(), loadRoutines()]).catch(() => {});
  return { workouts: workouts.length, sets: sets.length, routines: routines.length, body: body.length, details: details.length, newExercises: newExercises.length };
}

// ---------- import: screen --------------------------------------------------
const MODES = [
  ['skip', 'Keep what I have', 'Adds anything missing and leaves your existing items alone. Safe to run the same file twice.'],
  ['overwrite', 'Backup wins', 'Adds anything missing, and items in the backup replace your current versions of them.'],
  ['replace', 'Replace everything', 'Deletes all your current workouts, routines, body stats and exercise settings, then restores the backup.'],
];

export function importData() {
  if (api.pendingCount()) return toast('Wait until your unsynced changes have uploaded, then try again.', 'err');
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
    const file = input.files[0]; input.remove();
    if (!file) return;
    let d;
    try { d = parseBackup(await file.text()); } catch (e) { return toast(e.message, 'err'); }
    showImportSheet(d, file.name);
  } });
  document.body.append(input);
  input.click();
}

function showImportSheet(d, fileName) {
  const setCount = d.workouts.reduce((n, w) => n + w.sets.length, 0);
  const dates = d.workouts.map(w => w.started_at).filter(Boolean).sort();
  let mode = 'skip';
  sheet('Import backup', close => {
    const status = h('p', { class: 'muted small', role: 'status' });
    let finished = false;
    const go = h('button', { class: 'btn primary block', onclick: async () => {
      if (finished) { close(); location.hash = '#/'; return; }
      if (mode === 'replace' && !(await confirmSheet('Replace everything?',
        'All your current workouts, routines, body stats and exercise settings will be deleted and replaced with this backup. This can’t be undone — consider exporting first.', 'Replace')))
        return;
      go.disabled = true; radios.querySelectorAll('input').forEach(i => (i.disabled = true));
      try {
        const r = await runImport(d, mode, t => (status.textContent = t));
        mount(status, h('strong', {}, 'Import complete. '),
          `${r.workouts} workouts (${r.sets} sets), ${r.routines} routines, ${r.body} body entries, ${r.details} exercise settings` +
          (r.newExercises ? `, ${r.newExercises} custom exercises added.` : '.'));
        finished = true; go.textContent = 'Done'; go.disabled = false;
        toast('Import complete');
      } catch (e) {
        status.textContent = 'Import stopped: ' + e.message + ' Nothing after this step was added; you can safely try again.';
        go.disabled = false; radios.querySelectorAll('input').forEach(i => (i.disabled = false));
      }
    } }, 'Import');
    const radios = h('div', { class: 'stack', role: 'radiogroup', 'aria-label': 'If something already exists' },
      MODES.map(([k, label, desc]) => h('label', { class: 'choice' + (k === 'replace' ? ' danger' : '') },
        h('input', { type: 'radio', name: 'mode', value: k, checked: k === mode, onchange: () => (mode = k) }),
        h('span', {}, h('strong', {}, label), h('span', { class: 'muted small' }, desc)))));
    return h('div', {},
      h('p', { class: 'small' }, h('strong', {}, fileName), h('br'),
        h('span', { class: 'muted' }, `Exported ${fmtDay(d.exported_at)}${d.profile?.username ? ' from @' + d.profile.username : ''}`)),
      h('ul', { class: 'import-summary small' },
        h('li', {}, `${d.workouts.length} workouts (${setCount} sets)${dates.length ? `, ${fmtDay(dates[0])} – ${fmtDay(dates[dates.length - 1])}` : ''}`),
        h('li', {}, `${d.routines.length} routines`),
        h('li', {}, `${d.body_metrics.length} body stat entries`),
        h('li', {}, `${d.exercise_details.length} exercise settings`)),
      h('h2', {}, 'If something already exists'),
      radios, status, go);
  });
}
