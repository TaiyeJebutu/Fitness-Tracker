// Shared app data: my profile, the exercise list, friends, routines.
import * as api from './api.js';
import { setUnits } from './ui.js';

export const state = {
  profile: null,
  exercises: [],        // built-in + mine + friends' custom
  exById: new Map(),
  friends: [],          // [{id, username}]
  friendRows: [],       // raw friendship rows
  routines: [],
};

const MY_EX = 'ft.myExercises';   // custom exercises created offline, kept until synced

export async function loadProfile() {
  const uid = api.userId();
  const rows = await api.get(`profiles?id=eq.${uid}&select=*`);
  state.profile = rows?.[0] || state.profile;
  setUnits(state.profile?.units);
  return state.profile;
}

export async function loadExercises() {
  let list = [];
  try { list = await api.get('exercises?select=id,name,category,owner&order=name'); }
  catch (e) { list = api.cached('exercises?select=id,name,category,owner&order=name') || []; }
  // include my locally-created exercises that haven't reached the server yet
  const local = api.LS.get(MY_EX, []).filter(x => !list.some(y => y.id === x.id));
  state.exercises = [...list, ...local].sort((a, b) => a.name.localeCompare(b.name));
  state.exById = new Map(state.exercises.map(x => [x.id, x]));
  if (!local.length) api.LS.del(MY_EX);
  else api.LS.set(MY_EX, local);
  return state.exercises;
}

export function addExercise(name, category) {
  const ex = { id: api.uuid(), name: name.trim(), category, owner: api.userId() };
  api.upsert('exercises', ex);
  api.LS.set(MY_EX, [...api.LS.get(MY_EX, []), ex]);
  state.exercises.push(ex);
  state.exercises.sort((a, b) => a.name.localeCompare(b.name));
  state.exById.set(ex.id, ex);
  return ex;
}

export const exName = id => state.exById.get(id)?.name || 'Unknown exercise';

export async function loadFriends() {
  const uid = api.userId();
  const rows = await api.get('friendships?select=requester,addressee,status,created_at,' +
    'req:profiles!friendships_requester_fkey(id,username),adr:profiles!friendships_addressee_fkey(id,username)');
  state.friendRows = rows || [];
  state.friends = state.friendRows.filter(r => r.status === 'accepted')
    .map(r => (r.requester === uid ? r.adr : r.req)).filter(Boolean)
    .sort((a, b) => a.username.localeCompare(b.username));
  return state.friends;
}

export async function loadRoutines() {
  const uid = api.userId();
  state.routines = (await api.get(`routines?owner=eq.${uid}&select=*&order=name`)) || [];
  // merge routines saved offline that haven't synced yet
  const pending = api.LS.get('ft.outbox', []).filter(o => o.op === 'upsert' && o.table === 'routines').map(o => o.row);
  for (const r of pending) {
    const i = state.routines.findIndex(x => x.id === r.id);
    if (i >= 0) state.routines[i] = { ...state.routines[i], ...r }; else state.routines.push(r);
  }
  const deleted = api.LS.get('ft.outbox', []).filter(o => o.op === 'delete' && o.table === 'routines').map(o => o.filter.slice(6));
  state.routines = state.routines.filter(r => !deleted.includes(r.id));
  return state.routines;
}

export function saveRoutine(r) {
  const row = { ...r, owner: api.userId(), updated_at: new Date().toISOString() };
  api.upsert('routines', row);
  const i = state.routines.findIndex(x => x.id === r.id);
  if (i >= 0) state.routines[i] = row; else state.routines.push(row);
}

/** My most recent sets for an exercise from a previous workout (for "last time" hints). */
export async function lastSets(exerciseId, excludeWorkout) {
  const uid = api.userId();
  const path = `sets?owner=eq.${uid}&exercise_id=eq.${exerciseId}&select=workout_id,set_no,reps,weight_kg,created_at&order=created_at.desc&limit=40`;
  let rows = [];
  try { rows = await api.get(path); } catch { rows = api.cached(path) || []; }
  rows = rows.filter(r => r.workout_id !== excludeWorkout);
  if (!rows.length) return [];
  const wid = rows[0].workout_id;
  return rows.filter(r => r.workout_id === wid).sort((a, b) => a.set_no - b.set_no);
}

export async function details(exerciseId) {
  const uid = api.userId();
  const path = `exercise_details?user_id=eq.${uid}&exercise_id=eq.${exerciseId}&select=*`;
  const local = api.LS.get('ft.details.' + exerciseId);
  try { const r = await api.get(path); return r?.[0] || local || null; }
  catch { return local || api.cached(path)?.[0] || null; }
}

export function saveDetails(exerciseId, d) {
  const row = { user_id: api.userId(), exercise_id: exerciseId, ...d, updated_at: new Date().toISOString() };
  api.LS.set('ft.details.' + exerciseId, row);
  api.upsert('exercise_details', row, 'user_id,exercise_id');
}

export const CATEGORIES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full body', 'Cardio', 'Other'];

export const METRICS = [
  { key: 'bodyweight', label: 'Bodyweight', kind: 'w' },
  { key: 'body_fat', label: 'Body fat', kind: 'pct' },
  { key: 'chest', label: 'Chest', kind: 'l' },
  { key: 'waist', label: 'Waist', kind: 'l' },
  { key: 'hips', label: 'Hips', kind: 'l' },
  { key: 'neck', label: 'Neck', kind: 'l' },
  { key: 'shoulders', label: 'Shoulders', kind: 'l' },
  { key: 'arms', label: 'Arms', kind: 'l' },
  { key: 'forearms', label: 'Forearms', kind: 'l' },
  { key: 'thighs', label: 'Thighs', kind: 'l' },
  { key: 'calves', label: 'Calves', kind: 'l' },
];
