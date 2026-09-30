// Weekly plan: which sessions you mean to do on which day (no times).
// A usual week (template) repeats automatically; any single week can be changed on its own.
// Stored privately in training_plans (only you can see it). Works offline via the upload queue.
import * as api from './api.js';
import { state } from './store.js';
import { KINDS, logActivity, SPORTS } from './cardio.js';
import { startWorkout, active } from './workout.js';
import { h, mount, sheet, toast, ic, mondayStart, haptic } from './ui.js';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const empty = () => [[], [], [], [], [], [], []];
const PKEY = 'ft.plan';
const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const weekKey = (offset = 0) => { const d = mondayStart(); d.setDate(d.getDate() + 7 * offset); return dayKey(d); };

// ---------- load / save ---------------------------------------------------------
export async function loadPlan() {
  const uid = api.userId();
  let row = null;
  try { row = (await api.get(`training_plans?owner=eq.${uid}&select=*`))?.[0] || null; } catch {}
  const pend = api.LS.get('ft.outbox', []).filter(o => o.op === 'upsert' && o.table === 'training_plans' && o.row?.owner === uid).map(o => o.row).pop();
  const local = api.LS.get(PKEY);
  row = pend || row || (local?.owner === uid ? local : null);
  state.plan = { owner: uid, template: Array.isArray(row?.template) && row.template.length === 7 ? row.template : empty(), weeks: row?.weeks || {} };
  return state.plan;
}
function savePlan() {
  const p = state.plan;
  // keep last week (shown on Home), this week and future changes; older weeks don't matter any more
  const cutoff = weekKey(-1);
  for (const k of Object.keys(p.weeks)) if (k < cutoff) delete p.weeks[k];
  const row = { owner: api.userId(), template: p.template, weeks: p.weeks, updated_at: new Date().toISOString() };
  api.LS.set(PKEY, row);
  api.upsert('training_plans', row, 'owner');
}

/** The sessions planned for a week (its own changes, or the usual week). */
const mine = () => (state.plan?.owner === api.userId() ? state.plan : null);
export const weekPlan = (offset = 0) => mine()?.weeks?.[weekKey(offset)] || mine()?.template || empty();
export const hasOwnChanges = (offset = 0) => !!mine()?.weeks?.[weekKey(offset)];
export const plannedCount = (offset = 0) => weekPlan(offset).reduce((n, d) => n + d.length, 0);

// ---------- items ---------------------------------------------------------------
// { t: 'routine', id, name } | { t: 'run' } | { t: 'swim' } | { t: 'other', sport } | { t: 'label', text }
export const itemName = it => it.t === 'routine' ? (state.routines.find(r => r.id === it.id)?.name || it.name)
  : it.t === 'label' ? it.text : it.t === 'other' ? (it.sport || 'Activity') : KINDS[it.t].label;
const itemIcon = it => it.t === 'routine' || it.t === 'label' ? 'train' : KINDS[it.t]?.icon || 'pulse';

/** Keep only well-formed items (used when restoring a backup). routineMap: old routine id -> new id. */
export function cleanPlanItems(items, routineMap = new Map()) {
  return (Array.isArray(items) ? items : []).slice(0, 10).flatMap(it => {
    if (it?.t === 'routine' && it.id) return [{ t: 'routine', id: routineMap.get(it.id) || it.id, name: String(it.name || 'Workout').slice(0, 80) }];
    if (it?.t === 'run' || it?.t === 'swim') return [{ t: it.t }];
    if (it?.t === 'other') return [{ t: 'other', sport: it.sport ? String(it.sport).slice(0, 40) : null }];
    if (it?.t === 'label' && it.text) return [{ t: 'label', text: String(it.text).slice(0, 40) }];
    return [];
  });
}

/** Match planned items with what was actually done that day. Returns a done flag per item. */
export function matchDay(items, sessions) {
  const left = [...sessions];
  const take = pred => { const i = left.findIndex(pred); if (i < 0) return false; left.splice(i, 1); return true; };
  const done = items.map(() => false);
  // specific matches first, then anything left counts for labels
  items.forEach((it, i) => {
    if (it.t === 'routine') done[i] = take(s => s.type === 'workout' && (s.routine_id === it.id || s.name === itemName(it)));
    else if (it.t === 'run' || it.t === 'swim') done[i] = take(s => s.type === it.t);
    else if (it.t === 'other') done[i] = take(s => s.type === 'other' && (!it.sport || s.sport === it.sport));
  });
  items.forEach((it, i) => { if (it.t === 'label') done[i] = take(() => true); });
  return { done, extra: left.length };
}

/** Start (or log) a planned item. */
export function startItem(it) {
  if (it.t === 'routine') { const r = state.routines.find(x => x.id === it.id); return startWorkout(r || { name: it.name, items: [] }); }
  if (it.t === 'label') return startWorkout({ name: it.text, items: [] });
  logActivity(it.t);
}

// ---------- editing a day ------------------------------------------------------------
export function daySheet(offset, day, onChange) {
  if (state.plan?.owner !== api.userId()) return toast('Your plan is still loading — try again in a moment', 'err');
  sheet(`${DAYS[day]}${offset === 0 ? '' : offset === 1 ? ' (next week)' : offset < 0 ? ' (last week)' : ` (week of ${new Date(weekKey(offset) + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })})`}`, close => {
    const body = h('div', { class: 'plan-sheet' });
    let scope = hasOwnChanges(offset) || offset < 0 ? 'week' : 'usual';   // last week can only be changed on its own
    const redraw = () => {
      const items = (scope === 'usual' ? state.plan.template : weekPlan(offset))[day];
      const edit = fn => {
        if (scope === 'usual') {
          // last week keeps the plan it had, so changing your usual week doesn't rewrite history
          const last = weekKey(-1);
          if (!state.plan.weeks[last]) state.plan.weeks[last] = JSON.parse(JSON.stringify(state.plan.template));
          fn(state.plan.template[day]);
        }
        else {
          const k = weekKey(offset);
          if (!state.plan.weeks[k]) state.plan.weeks[k] = JSON.parse(JSON.stringify(state.plan.template));
          fn(state.plan.weeks[k][day]);
        }
        savePlan(); haptic(8); redraw(); onChange?.();
      };
      const add = it => edit(list => list.push(it));
      const other = h('div', { class: 'chips', hidden: true }, [...SPORTS.map(([n]) => n)].map(n =>
        h('button', { class: 'chip', onclick: () => add({ t: 'other', sport: n }) }, n)),
        h('button', { class: 'chip', onclick: () => add({ t: 'other', sport: null }) }, 'Any'));
      let label = '';
      mount(body,
        offset >= 0 && h('div', { class: 'seg', role: 'group', 'aria-label': 'Which weeks' },
          [['usual', 'Every week'], ['week', offset === 0 ? 'This week only' : offset === 1 ? 'Next week only' : 'That week only']].map(([k, l]) =>
            h('button', { class: scope === k ? 'on' : '', 'aria-pressed': String(scope === k), onclick: () => { scope = k; redraw(); } }, l))),
        scope === 'week' && offset >= 0 && hasOwnChanges(offset) && h('p', { class: 'muted small plan-note' }, 'This week has its own changes. ',
          h('button', { class: 'link-inline', onclick: () => { delete state.plan.weeks[weekKey(offset)]; savePlan(); scope = 'usual'; redraw(); onChange?.(); } }, 'Go back to your usual week')),
        scope === 'usual' && hasOwnChanges(offset) && h('p', { class: 'muted small plan-note' }, 'Changes here apply from next time — this week has its own plan.'),
        h('div', { class: 'plan-items' }, items.length ? items.map((it, i) => h('div', { class: 'plan-item' },
          h('span', { class: 'act-ico' }, ic(itemIcon(it), 18)), h('span', { class: 'grow' }, itemName(it)),
          h('button', { class: 'icon-btn', 'aria-label': 'Remove ' + itemName(it), onclick: () => edit(list => list.splice(i, 1)) }, ic('close', 18))))
          : h('p', { class: 'muted' }, 'Rest day')),
        h('div', { class: 'pick-head' }, 'Add a session'),
        h('div', { class: 'chips' },
          state.routines.map(r => h('button', { class: 'chip', onclick: () => add({ t: 'routine', id: r.id, name: r.name }) }, ic('train', 16), r.name)),
          h('button', { class: 'chip', onclick: () => add({ t: 'run' }) }, ic('run', 16), 'Run'),
          h('button', { class: 'chip', onclick: () => add({ t: 'swim' }) }, ic('swim', 16), 'Swim'),
          h('button', { class: 'chip', onclick: () => { other.hidden = !other.hidden; } }, ic('pulse', 16), 'Other…')),
        other,
        h('form', { class: 'row gap plan-label', novalidate: true, onsubmit: e => { e.preventDefault(); const t = label.trim(); if (!t) return; add({ t: 'label', text: t.slice(0, 40) }); } },
          h('input', { placeholder: 'Or type one, e.g. Upper body', maxlength: 40, 'aria-label': 'Custom session', 'data-noautofocus': '1', oninput: e => (label = e.target.value) }),
          h('button', { class: 'btn', type: 'submit' }, 'Add')),
        !state.routines.length && h('p', { class: 'muted small' }, 'Tip: save routines on the Train tab to plan them here and start them in one tap.'),
        h('button', { class: 'btn primary block', onclick: close }, 'Done'));
    };
    redraw();
    return body;
  });
}

// ---------- Home: the week at a glance ----------------------------------------------------
/** Home card. onChange runs after the plan is edited.
 *  sessions: [{ type: 'workout'|'run'|'swim'|'other', routine_id, name, sport, started_at }] (yours, recent). */
export function planCard(sessions, onChange) {
  let offset = 0;
  const box = h('section', { class: 'card plan-card' });
  const draw = () => {
    const wk = new Date(mondayStart()); wk.setDate(wk.getDate() + 7 * offset);
    const plan = weekPlan(offset);
    const today = dayKey(new Date());
    const total = plannedCount(offset);
    let doneCount = 0;
    const rows = DAYS.map((name, d) => {
      const date = new Date(wk); date.setDate(date.getDate() + d);
      const k = dayKey(date), items = plan[d];
      const daySessions = sessions.filter(s => dayKey(s.started_at) === k);
      const { done, extra } = matchDay(items, daySessions);
      doneCount += done.filter(Boolean).length;
      const past = k < today, isToday = k === today;
      const next = isToday && !active() && items.find((it, i) => !done[i]);
      return h('div', { class: 'plan-day' + (isToday ? ' today' : '') + (past ? ' past' : '') },
        h('button', { class: 'plan-day-main', onclick: () => daySheet(offset, d, changed), 'aria-label': `${name}: ${items.length ? items.map(itemName).join(', ') : 'rest'}. Tap to change.` },
          h('span', { class: 'plan-dow' }, h('b', {}, name.slice(0, 3)), h('small', {}, date.getDate())),
          h('span', { class: 'plan-chips' },
            items.length ? items.map((it, i) => h('span', { class: 'plan-chip' + (done[i] ? ' done' : past ? ' missed' : '') },
              done[i] ? ic('check', 14) : ic(itemIcon(it), 14), itemName(it)))
              : h('span', { class: 'plan-rest' }, 'Rest'),
            extra > 0 && h('span', { class: 'plan-chip done extra' }, ic('check', 14), `+${extra} more`)),
          !next && h('span', { class: 'chev', 'aria-hidden': 'true' }, ic('chevron', 16))),
        next && h('button', { class: 'btn dark small plan-go', 'aria-label': 'Start ' + itemName(next), onclick: () => startItem(next) },
          ic('play', 14), next.t === 'routine' || next.t === 'label' ? 'Start' : 'Log'));
    });
    mount(box,
      h('div', { class: 'row between plan-head' },
        h('div', {}, h('strong', {}, offset === 0 ? 'This week’s plan' : offset === 1 ? 'Next week’s plan' : offset < 0 ? 'Last week' : `Week of ${wk.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`),
          h('div', { class: 'muted small' }, total ? `${doneCount} of ${total} done${hasOwnChanges(offset) ? ' · changed for this week' : ''}` : 'Tap a day to plan your sessions')),
        h('div', { class: 'row' },
          h('button', { class: 'icon-btn', 'aria-label': 'Previous week', disabled: offset <= -1, onclick: () => { offset--; draw(); } }, ic('back', 18)),
          h('button', { class: 'icon-btn', 'aria-label': 'Next week', disabled: offset >= 3, onclick: () => { offset++; draw(); } }, ic('chevron', 18)))),
      rows);
  };
  // after an edit: redraw this card, and let the page refresh anything that depends on this week's plan (the rings)
  const changed = () => { draw(); onChange?.(); };
  draw();
  return box;
}

/** Train tab: today's planned sessions with Start / Log (ticked once done). sessions: today's, as for planCard. */
export function todayCard(onChange, sessions = []) {
  const d = (new Date().getDay() + 6) % 7;
  const items = weekPlan(0)[d];
  if (!plannedCount(0)) return null;   // no plan this week: nothing to show
  const today = dayKey(new Date());
  const { done } = matchDay(items, sessions.filter(s => dayKey(s.started_at) === today));
  return h('section', { class: 'card today-card' },
    h('div', { class: 'row between' }, h('strong', {}, 'Today’s plan'), h('button', { class: 'btn ghost small', onclick: () => daySheet(0, d, onChange) }, 'Change')),
    !items.length && h('p', { class: 'muted small' }, 'Rest day — nothing planned.'),
    items.map((it, i) => h('div', { class: 'plan-item' + (done[i] ? ' done' : '') },
      h('span', { class: 'act-ico' }, ic(done[i] ? 'check' : itemIcon(it), 18)), h('span', { class: 'grow' }, itemName(it)),
      done[i] ? h('span', { class: 'muted small' }, 'Done')
        : !active() && h('button', { class: 'btn dark small', onclick: () => startItem(it) }, ic('play', 14), it.t === 'routine' || it.t === 'label' ? 'Start' : 'Log'))));
}

/** Your sessions since a date, in the shape planCard / todayCard use. */
export async function sessionsSince(since) {
  const uid = api.userId(), iso = since.toISOString();
  const [ws, as] = await Promise.all([
    api.get(`workouts?owner=eq.${uid}&ended_at=not.is.null&started_at=gte.${iso}&select=id,name,routine_id,started_at`, { cache: false }).catch(() => []),
    api.get(`activities?owner=eq.${uid}&started_at=gte.${iso}&select=id,kind,sport,started_at`, { cache: false }).catch(() => [])]);
  return toSessions(ws, as);
}
export const toSessions = (workouts, activities) => [
  ...workouts.filter(w => w.ended_at !== null).map(w => ({ type: 'workout', routine_id: w.routine_id, name: w.name, started_at: w.started_at })),
  ...activities.map(a => ({ type: a.kind, sport: a.sport, started_at: a.started_at }))];
