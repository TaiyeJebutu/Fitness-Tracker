// Home dashboard: activity grid, this week, trends, PRs, badges and bodyweight.
import * as api from './api.js';
import { state, exName, METRICS } from './store.js';
import { active } from './workout.js';
import { avatar } from './avatar.js';
import { earnedBy, badgeStrip } from './badges.js';
import { fmtMetric } from './social.js';
import { h, svg, mount, spinner, toast, fmtW, fmtBig, fmtDay, fmtDate, mondayStart, e1rm, toW, wUnit, ago, ic } from './ui.js';

const DAY = 86400000;
export const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const shortDate = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// ---------- data -----------------------------------------------------------
/** Everything the dashboard needs for one person. Cached so it still works offline. */
export async function activityData(uid, { withSets = true } = {}) {
  const key = 'ft.dash.' + uid;
  try {
    const [workouts, sets] = await Promise.all([
      api.getAll(`workouts?owner=eq.${uid}&ended_at=not.is.null&select=id,name,started_at,ended_at&order=started_at.asc`),
      withSets ? api.getAll(`sets?owner=eq.${uid}&select=workout_id,exercise_id,reps,weight_kg,created_at&order=created_at.asc`) : []]);
    const data = { workouts, sets };
    if (uid === api.userId()) api.LS.set(key, data);
    return data;
  } catch (e) {
    const c = api.LS.get(key);
    if (c) return c;
    throw e;
  }
}

/** Per-day totals: day key -> { sets, workouts: [{id, name}] } */
export function perDay({ workouts, sets }) {
  const days = new Map();
  const get = k => days.get(k) || days.set(k, { sets: 0, workouts: [] }).get(k);
  for (const w of workouts) get(dayKey(w.started_at)).workouts.push({ id: w.id, name: w.name });
  const byWorkout = new Map(workouts.map(w => [w.id, w]));
  for (const s of sets) {
    const w = byWorkout.get(s.workout_id);
    if (w) get(dayKey(w.started_at)).sets++;       // count the set on the day the workout happened
  }
  return days;
}

// ---------- activity grid (GitHub-style) ---------------------------------------
/** Shade levels 1–4 from this person's own quartiles, so it adapts to how much they train. */
function levels(days) {
  const counts = [...days.values()].map(d => d.sets || (d.workouts.length ? 1 : 0)).filter(Boolean).sort((a, b) => a - b);
  if (!counts.length) return () => 0;
  const q = p => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))];
  const [q1, q2, q3] = counts.length >= 4 ? [q(0.25), q(0.5), q(0.75)] : [counts[0], counts[0], counts[counts.length - 1]];
  return n => (!n ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4);
}

export function activityGrid(days, { weeks = 53, linkWorkouts = true } = {}) {
  const C = 12, G = 3, S = C + G, top = 16;
  const lvl = levels(days);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = addDays(mondayStart(today), -7 * (weeks - 1));
  const W = weeks * S, H = top + 7 * S;
  const info = h('div', { class: 'hm-info muted small', 'aria-live': 'polite' }, 'Tap a square to see that day.');
  const grid = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'hm', role: 'img' });
  let workoutsInRange = 0, activeDays = 0, lastMonth = -1, selected = null;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      if (date > today) continue;
      if (d === 0 && date.getMonth() !== lastMonth && w < weeks - 1) {
        lastMonth = date.getMonth();
        if (w > 0 || date.getDate() <= 7) grid.append(svg('text', { x: w * S, y: 11, class: 'hm-month' }, date.toLocaleDateString(undefined, { month: 'short' })));
      }
      const k = dayKey(date), v = days.get(k);
      const n = v ? v.sets || (v.workouts.length ? 1 : 0) : 0;
      if (v?.workouts.length) { workoutsInRange += v.workouts.length; activeDays++; }
      const rect = svg('rect', { x: w * S, y: top + d * S, width: C, height: C, rx: 2.5, class: 'hm' + lvl(n) + (k === dayKey(today) ? ' today' : '') });
      rect.addEventListener('click', () => {
        selected?.classList.remove('sel'); rect.classList.add('sel'); selected = rect;
        const label = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        if (!v?.workouts.length) { mount(info, h('strong', {}, label), ' · rest day'); return; }
        mount(info, h('strong', {}, label), ` · ${v.workouts.length} workout${v.workouts.length > 1 ? 's' : ''} · ${v.sets} sets`,
          h('span', { class: 'hm-links' }, v.workouts.map(x => linkWorkouts ? h('a', { href: '#/history/' + x.id }, x.name + ' ›') : h('span', {}, x.name))));
      });
      grid.append(rect);
    }
  }
  grid.setAttribute('aria-label', `Activity over the last ${weeks} weeks: ${workoutsInRange} workouts on ${activeDays} days`);
  const scroller = h('div', { class: 'hm-scroll' }, grid);
  requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });
  const legend = h('div', { class: 'hm-legend muted small' }, 'Less', [0, 1, 2, 3, 4].map(i => h('span', { class: 'hm-key hm' + i })), 'More');
  return h('div', { class: 'hm-wrap' },
    h('div', { class: 'hm-body' },
      h('div', { class: 'hm-days muted', 'aria-hidden': 'true', style: { paddingTop: top + 'px' } },
        ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map(t => h('span', { style: { height: S + 'px' } }, t))),
      scroller),
    h('div', { class: 'row between hm-foot' }, h('span', { class: 'small' }, h('strong', {}, workoutsInRange), ` workouts in the last ${weeks === 53 ? 'year' : weeks + ' weeks'}`), legend),
    info);
}

// ---------- small charts --------------------------------------------------------
function columnChart(values, labels, fmt, title) {
  const W = 320, H = 150, P = { l: 6, r: 6, t: 22, b: 20 };
  const max = Math.max(...values, 0) || 1;
  const band = (W - P.l - P.r) / values.length, bw = Math.min(18, band - 6);
  const Y = v => P.t + (1 - v / max) * (H - P.t - P.b);
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });
  s.append(svg('line', { x1: P.l, x2: W - P.r, y1: H - P.b, y2: H - P.b, class: 'grid' }));
  const tip = h('div', { class: 'tip', hidden: true });
  values.forEach((v, i) => {
    const x = P.l + i * band + (band - bw) / 2, y = Y(v), hgt = H - P.b - y;
    const r = Math.min(4, hgt);
    const d = hgt > 0 ? `M${x} ${H - P.b} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${H - P.b} Z` : '';
    if (d) s.append(svg('path', { d, class: 'col' + (i === values.length - 1 ? ' now' : '') }));
    const hit = svg('rect', { x: P.l + i * band, y: P.t - 10, width: band, height: H - P.t - P.b + 10, fill: 'transparent' });
    hit.addEventListener('pointerdown', () => { tip.hidden = false; tip.textContent = `${labels[i]} · ${fmt(v)}`; tip.style.left = ((x + bw / 2) / W) * 100 + '%';
      const f = (x + bw / 2) / W; tip.style.transform = f > 0.66 ? 'translateX(-100%)' : f < 0.33 ? 'none' : 'translateX(-50%)'; });
    s.append(hit);
    if (i === 0 || i === values.length - 1) s.append(svg('text', { x: x + bw / 2, y: H - 5, 'text-anchor': i ? 'end' : 'start', class: 'axis' }, labels[i]));
  });
  s.addEventListener('pointerleave', () => (tip.hidden = true));
  return h('div', { class: 'chart' }, h('div', { class: 'chart-title rel small' }, h('span', { class: 'muted' }, title), ' · ', h('strong', {}, 'this week ' + fmt(values[values.length - 1]))), tip, s);
}

function barList(rows, fmt) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return h('div', { class: 'bars' }, rows.map(r => h('div', { class: 'bar-row' },
    h('span', { class: 'bar-label small' }, r.label),
    h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: { width: Math.max(3, (r.value / max) * 100) + '%' } })),
    h('span', { class: 'bar-val small' }, fmt(r.value)))));
}

function sparkline(points) {
  if (points.length < 2) return null;
  const W = 120, H = 36, ys = points.map(p => p.y), x0 = +points[0].x, x1 = +points[points.length - 1].x;
  let lo = Math.min(...ys), hi = Math.max(...ys); if (hi - lo < 0.5) { lo -= 0.5; hi += 0.5; }
  const X = x => 3 + ((x - x0) / (x1 - x0 || 1)) * (W - 6), Y = y => 4 + (1 - (y - lo) / (hi - lo)) * (H - 8);
  const last = points[points.length - 1];
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'spark', 'aria-hidden': 'true' },
    svg('polyline', { points: points.map(p => `${X(+p.x)},${Y(p.y)}`).join(' '), class: 'line' }),
    svg('circle', { cx: X(+last.x), cy: Y(last.y), r: 4, class: 'dot' }));
}

const tile = (label, value, delta, goodUp = true) => h('div', { class: 'stat tile' },
  h('span', { class: 'muted small' }, label), h('strong', {}, value),
  delta != null && h('span', { class: 'delta small ' + (delta === 0 ? '' : (delta > 0) === goodUp ? 'up' : 'down') },
    delta === 0 ? '= same' : `${delta > 0 ? '▲' : '▼'} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}`));

function streakCard(streak, done, target, thisWeek) {
  const R = 36, C = 2 * Math.PI * R, frac = Math.min(1, done / target);
  const prog = svg('circle', { cx: 43, cy: 43, r: R, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round', class: 'prog', 'stroke-dasharray': C, 'stroke-dashoffset': C });
  requestAnimationFrame(() => requestAnimationFrame(() => prog.setAttribute('stroke-dashoffset', C * (1 - frac))));
  return h('section', { class: 'card streak-card' },
    h('div', { class: 'ring', role: 'img', 'aria-label': `${done} of ${target} sessions this week` },
      svg('svg', { width: 86, height: 86, viewBox: '0 0 86 86' },
        svg('circle', { cx: 43, cy: 43, r: R, fill: 'none', 'stroke-width': 8, class: 'track' }), prog),
      h('b', {}, streak)),
    h('div', {},
      h('div', { class: 'title' }, streak ? `${streak}-week streak` : 'No streak yet'),
      h('div', { class: 'muted small' }, `${done} of ${target} sessions this week`),
      h('div', { class: 'small streak-note' }, streak ? (thisWeek ? (done >= target ? 'Weekly goal reached. Lovely work.' : 'You’ve trained this week. Keep it going.') : 'Train this week to keep your streak.') : 'Train this week to start one.')));
}

// ---------- the dashboard -------------------------------------------------------
export async function renderHome(root) {
  const me = state.profile || {};
  const a = active();
  const body = h('div', {}, spinner());
  const hr = new Date().getHours();
  const greet = hr < 5 ? 'Good evening' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  mount(root,
    h('div', { class: 'home-head' },
      h('div', {}, h('span', { class: 'cap' }, new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })),
        h('h1', {}, greet + (me.username ? ', ' + me.username : ''))),
      h('a', { href: '#/me', 'aria-label': 'Me' }, avatar(me, 44))),
    a && h('a', { class: 'card resume', href: '#/workout' }, h('strong', {}, 'Workout in progress'),
        h('span', { class: 'muted small' }, `${a.name} · started ${ago(a.started_at)}`), h('span', { class: 'btn primary small' }, 'Resume')),
    !a && h('a', { class: 'fab', href: '#/train' }, ic('plus', 20), 'Start workout'),
    body);

  let data;
  try { data = await activityData(api.userId()); }
  catch (e) { mount(body, h('p', { class: 'muted' }, e.message)); return; }
  const { workouts, sets } = data;
  const days = perDay(data);
  const byWorkout = new Map(workouts.map(w => [w.id, w]));

  // ---- this week vs same point last week
  const now = new Date(), wk0 = mondayStart(now), elapsed = now - wk0;
  const lwk0 = addDays(wk0, -7), lwkEnd = new Date(+lwk0 + elapsed);
  const inRange = (d, a, b) => { const t = new Date(d); return t >= a && t < b; };
  const sum = (a, b) => {
    const ws = workouts.filter(w => inRange(w.started_at, a, b));
    const ids = new Set(ws.map(w => w.id));
    const ss = sets.filter(s => ids.has(s.workout_id));
    return { w: ws.length, s: ss.length, vol: ss.reduce((t, s) => t + s.weight_kg * s.reps, 0),
      mins: Math.round(ws.reduce((t, w) => t + (new Date(w.ended_at) - new Date(w.started_at)), 0) / 60000) };
  };
  const cur = sum(wk0, now), prev = sum(lwk0, lwkEnd);
  const hm = m => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

  // ---- weekly streak (weeks in a row with a workout)
  const weeksWith = new Set(workouts.map(w => Math.round((+mondayStart(new Date(w.started_at)) - +wk0) / (7 * DAY))));
  let streak = 0, k = weeksWith.has(0) ? 0 : -1;
  while (weeksWith.has(k)) { streak++; k--; }
  // weekly target: your usual number of sessions (average of the last 8 full weeks, at least 2)
  const last8 = workouts.filter(w => inRange(w.started_at, addDays(wk0, -56), wk0)).length;
  const target = Math.max(2, Math.round(last8 / 8));

  // ---- weekly volume, last 12 weeks
  const volWeeks = Array.from({ length: 12 }, (_, i) => addDays(wk0, -7 * (11 - i)));
  const vol = volWeeks.map(ws => sets.filter(s => { const w = byWorkout.get(s.workout_id); return w && inRange(w.started_at, ws, addDays(ws, 7)); })
    .reduce((t, s) => t + s.weight_kg * s.reps, 0));

  // ---- body areas, last 30 days (sets per area)
  const since30 = new Date(Date.now() - 30 * DAY), areas = new Map();
  for (const s of sets) {
    const w = byWorkout.get(s.workout_id);
    if (!w || new Date(w.started_at) < since30) continue;
    const cat = state.exById.get(s.exercise_id)?.category || 'Other';
    areas.set(cat, (areas.get(cat) || 0) + 1);
  }
  const areaRows = [...areas].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  // ---- recent personal records (a set beating your previous best e1RM on that exercise)
  const best = new Map(), prs = [];
  for (const s of sets) {
    const v = e1rm(s.weight_kg, s.reps); if (!v) continue;
    const b = best.get(s.exercise_id);
    if (b != null && v > b + 1e-9) prs.push({ ...s, v, prev: b });
    if (b == null || v > b) best.set(s.exercise_id, v);
  }
  // one entry per exercise per workout (its best set), newest first
  const perSession = new Map();
  for (const p of prs) { const k = p.workout_id + '|' + p.exercise_id, cur = perSession.get(k); if (!cur || p.v > cur.v) perSession.set(k, { ...p, prev: cur ? Math.min(cur.prev, p.prev) : p.prev }); }
  const recentPRs = [...perSession.values()].slice(-5).reverse();

  // ---- badges + next milestone, bodyweight
  const [earned, bw] = await Promise.all([
    earnedBy(api.userId()),
    api.get(`body_metrics?owner=eq.${api.userId()}&metric=eq.bodyweight&select=value,measured_on&order=measured_on.asc`).catch(() => api.cached(`body_metrics?owner=eq.${api.userId()}&metric=eq.bodyweight&select=value,measured_on&order=measured_on.asc`) || [])]);
  const total = workouts.length;
  const next = [1, 10, 25, 50, 100, 250, 500].find(m => m > total);
  const bwPts = bw.map(r => ({ x: new Date(r.measured_on + 'T12:00'), y: toW(+r.value) }));
  const bwLatest = bw[bw.length - 1];
  const bw30 = [...bw].reverse().find(r => new Date(r.measured_on) <= new Date(Date.now() - 28 * DAY));
  const bwDelta = bwLatest && bw30 ? toW(bwLatest.value - bw30.value) : null;
  const bwDef = METRICS.find(m => m.key === 'bodyweight');

  mount(body,
    streakCard(streak, cur.w, target, weeksWith.has(0)),

    h('h2', {}, 'Activity'),
    h('section', { class: 'card' }, activityGrid(days)),

    h('div', { class: 'section-head' }, h('h2', {}, 'This week'), h('span', { class: 'muted small' }, 'vs this time last week')),
    h('div', { class: 'tiles' },
      tile('Workouts', cur.w, cur.w - prev.w), tile('Sets', cur.s, cur.s - prev.s),
      tile('Volume', fmtBig(cur.vol), null), tile('Time', hm(cur.mins), null)),

    h('h2', {}, 'Trends'),
    columnChart(vol, volWeeks.map(d => 'w/c ' + shortDate(d)), fmtBig, 'Weekly volume, last 12 weeks'),
    h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, 'Body areas trained'), h('span', { class: 'muted small' }, 'sets, last 30 days')),
      areaRows.length ? barList(areaRows, v => v) : h('p', { class: 'muted small' }, 'Log a workout to see which areas you’re training.')),

    h('h2', {}, 'Recent personal records'),
    h('section', { class: 'card' },
      recentPRs.length ? h('ul', { class: 'pr-list' }, recentPRs.map(p => h('li', {},
        h('span', {}, h('strong', {}, exName(p.exercise_id)), h('br'), h('span', { class: 'muted small' }, `${fmtW(p.weight_kg)} × ${p.reps} · ${fmtDate(byWorkout.get(p.workout_id)?.started_at || p.created_at)}`)),
        h('span', { class: 'pr-gain small' }, `+${fmtW(p.v - p.prev)}`, h('br'), h('span', { class: 'muted' }, 'e1RM')))))
        : h('p', { class: 'muted small' }, 'Beat your best on any exercise and it’ll show up here.')),

    h('div', { class: 'section-head' }, h('h2', {}, 'Badges'), h('a', { class: 'btn small ghost', href: '#/badges' }, 'See all')),
    h('section', { class: 'card' },
      badgeStrip(earned, 6),
      next && h('div', { class: 'meter-row' },
        h('div', { class: 'row between small' }, h('span', {}, `Next: ${next} workouts`), h('span', { class: 'muted' }, `${total} / ${next}`)),
        h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': next, 'aria-valuenow': total },
          h('span', { style: { width: Math.min(100, (total / next) * 100) + '%' } })))),

    h('div', { class: 'section-head' }, h('h2', {}, 'Body'), h('a', { class: 'btn small ghost', href: '#/body' }, 'All body stats', ic('chevron', 16))),
    h('a', { class: 'card row between bw-card', href: '#/body/bodyweight' },
      h('span', {}, h('span', { class: 'muted small' }, 'Bodyweight'), h('br'),
        h('strong', { class: 'big-num' }, bwLatest ? fmtMetric(bwDef, bwLatest.value) : '—'), h('br'),
        h('span', { class: 'muted small' }, bwLatest ? (bwDelta != null ? `${bwDelta > 0 ? '+' : bwDelta < 0 ? '−' : '±'}${Math.abs(Math.round(bwDelta * 10) / 10)} ${wUnit()} in 4 weeks` : 'Latest ' + fmtDay(bwLatest.measured_on + 'T12:00')) : 'Tap to log your bodyweight')),
      sparkline(bwPts.slice(-20))));
}

/** Toggle "friends can see my activity grid" (stored on the profile). */
export async function setShareActivity(on) {
  try {
    await api.patch('profiles', 'id=eq.' + api.userId(), { share_activity: on });
    state.profile.share_activity = on;
    toast(on ? 'Friends can see your activity' : 'Your activity grid is now private');
  } catch (e) { toast(e.message, 'err'); }
}
