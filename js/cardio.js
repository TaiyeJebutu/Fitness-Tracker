// Runs, swims and other activities: logging (entered afterwards, no GPS), detail page,
// per-sport stats with personal bests, and the cards used in history and the friends feed.
import * as api from './api.js';
import { state } from './store.js';
import { avatar } from './avatar.js';
import { checkBadges } from './badges.js';
import { columnChart } from './home.js';
import { h, mount, toast, sheet, confirmSheet, spinner, getUnits, fmtDay, fmtDate, ago, todayISO, mondayStart, ic, chev, haptic } from './ui.js';

// ---------- what can be logged ------------------------------------------------
export const KINDS = {
  run: { label: 'Run', plural: 'Running', icon: 'run', log: 'Log a run' },
  swim: { label: 'Swim', plural: 'Swimming', icon: 'swim', log: 'Log a swim' },
  other: { label: 'Activity', plural: 'Other activities', icon: 'pulse', log: 'Log an activity' },
};
// Other sports: [name, has a distance?]
export const SPORTS = [['Cycling', true], ['Walking', true], ['Hiking', true], ['Rowing', true], ['Football', false], ['Tennis', false], ['Yoga', false]];
const FEEL = ['Very easy', 'Easy', 'OK', 'Hard', 'Very hard'];
const POOLS = [['25m', '25 m pool'], ['50m', '50 m pool'], ['25yd', '25 yd pool'], ['open', 'Open water']];
const STROKES = [['freestyle', 'Freestyle'], ['breaststroke', 'Breaststroke'], ['backstroke', 'Backstroke'], ['butterfly', 'Butterfly'], ['mixed', 'Mixed']];
// Realistic limits (the database checks the same): metres, and fastest allowed speed in m/s.
const LIMITS = { run: { min: 100, max: 300000, fastest: 12 }, swim: { min: 25, max: 30000, fastest: 3 }, other: { min: 0, max: 1000000, fastest: Infinity } };

/** Would the database accept this activity? (Used to skip bad rows when importing a backup.) */
export function activityOk(a) {
  const L = LIMITS[a?.kind]; if (!L) return false;
  const t = +a.duration_s, m = a.distance_m == null ? null : +a.distance_m;
  if (!(t >= 30 && t <= 172800)) return false;
  if (a.kind === 'other') return !!String(a.sport || '').trim() && (m == null || (m > 0 && m <= L.max));
  return !a.sport && m >= L.min && m <= L.max && m <= t * L.fastest;
}

// ---------- units -------------------------------------------------------------
const MI = 1609.344, YD = 0.9144;
const imperial = () => getUnits() === 'imperial';
/** Distance unit for a kind in the viewer's units: runs/other in km or mi, swims in m or yd. */
export const distUnit = kind => (kind === 'swim' ? (imperial() ? 'yd' : 'm') : imperial() ? 'mi' : 'km');
const unitM = kind => (kind === 'swim' ? (imperial() ? YD : 1) : imperial() ? MI : 1000);
export const toDist = (kind, m) => m / unitM(kind);
const fromDist = (kind, v) => v * unitM(kind);
export function fmtDist(kind, m, unit = true) {
  if (m == null) return '—';
  const v = toDist(kind, +m);
  const txt = kind === 'swim' ? Math.round(v).toLocaleString() : v >= 100 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, '') || '0';
  return txt + (unit ? ' ' + distUnit(kind) : '');
}
/** 3725 -> "1:02:05", 1510 -> "25:10" */
export function hms(sec) {
  sec = Math.round(sec);
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
}
/** 3725 -> "1h 2m", 1510 -> "25m" */
export const hmShort = sec => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
/** Pace for runs (per km/mi), swims (per 100 m/yd); speed for other sports. */
export function paceText(kind, m, sec) {
  if (!m || !sec) return null;
  if (kind === 'run') return `${hms(sec / toDist('run', m))} /${distUnit('run')}`;
  if (kind === 'swim') return `${hms(sec / (toDist('swim', m) / 100))} /100${distUnit('swim')}`;
  return `${(toDist('other', m) / (sec / 3600)).toFixed(1)} ${imperial() ? 'mph' : 'km/h'}`;
}
const paceLabel = kind => (kind === 'other' ? 'Speed' : 'Pace');
const hasDistance = a => a.kind !== 'other' || (a.distance_m != null && +a.distance_m > 0);

// ---------- names -------------------------------------------------------------
function partOfDay(d) {
  const hr = new Date(d).getHours();
  return hr < 5 ? 'Night' : hr < 12 ? 'Morning' : hr < 14 ? 'Lunchtime' : hr < 17 ? 'Afternoon' : hr < 21 ? 'Evening' : 'Night';
}
export const activityName = a => a.title || (a.kind === 'other' ? a.sport || 'Activity' : `${partOfDay(a.started_at)} ${a.kind}`);
const kindIcon = (a, size = 20) => h('span', { class: 'act-ico', 'aria-hidden': 'true' }, ic(KINDS[a.kind]?.icon || 'pulse', size));

// ---------- data --------------------------------------------------------------
const pendingActs = () => api.LS.get('ft.outbox', []).filter(o => o.op === 'upsert' && o.table === 'activities').map(o => o.row);
const pendingDeletes = () => api.LS.get('ft.outbox', []).filter(o => o.op === 'delete' && o.table === 'activities').map(o => o.filter.replace('id=eq.', ''));
/** Someone's activities (newest first), including ones still waiting to upload from this phone. */
export async function loadActivities(uid = api.userId(), { limit = 2000, since } = {}) {
  let rows;
  try { rows = await api.get(`activities?owner=eq.${uid}&select=*${since ? '&started_at=gte.' + since : ''}&order=started_at.desc&limit=${limit}`); }
  catch { rows = []; }
  if (uid !== api.userId()) return rows;
  const pend = pendingActs().filter(r => r.owner === uid), del = new Set(pendingDeletes());
  return [...rows.filter(r => !pend.some(p => p.id === r.id)), ...pend].filter(r => !del.has(r.id))
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
}

// ---------- choose what to do (Home's floating button) --------------------------
export function chooseActivity() {
  sheet('What are you doing?', close => h('div', { class: 'card list-card flat' },
    h('a', { class: 'row gap', href: '#/train', onclick: close }, h('span', { class: 'list-ico' }, ic('train', 18)), h('span', { class: 'grow' }, 'Gym workout'), chev()),
    ['run', 'swim', 'other'].map(k => h('a', { class: 'row gap', href: 'javascript:void 0', onclick: () => { close(); logActivity(k); } },
      h('span', { class: 'list-ico' }, ic(KINDS[k].icon, 18)), h('span', { class: 'grow' }, KINDS[k].log), chev()))));
}

// ---------- log / edit ------------------------------------------------------------
/** preset (new entries only): { date: 'YYYY-MM-DD', sport } — e.g. logging a planned session afterwards. */
export function logActivity(kind, existing = null, preset = {}) {
  const a = existing;
  const local = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString(); };
  const start = a ? local(a.started_at) : local(new Date());
  const dur = a ? a.duration_s : 0;
  const f = {
    sport: a?.sport || preset.sport || '', title: a?.title || '', date: (!a && preset.date) || start.slice(0, 10),
    time: !a && preset.date && preset.date !== start.slice(0, 10) ? '18:00' : start.slice(11, 16),
    dist: a?.distance_m != null ? String(+toDist(kind, +a.distance_m).toFixed(kind === 'swim' ? 0 : 2)) : '',
    h: dur ? String(Math.floor(dur / 3600)) : '', m: dur ? String(Math.floor((dur % 3600) / 60)) : '', s: dur ? String(dur % 60) : '',
    feel: a?.feel || null, pool: a?.pool || (kind === 'swim' ? (imperial() ? '25yd' : '25m') : null), stroke: a?.stroke || (kind === 'swim' ? 'freestyle' : null),
    notes: a?.notes || '',
  };
  const knownSport = s => SPORTS.some(([n]) => n === s);
  let customSport = kind === 'other' && f.sport && !knownSport(f.sport);
  sheet(a ? `Edit ${KINDS[kind].label.toLowerCase()}` : KINDS[kind].log, close => {
    const err = h('p', { class: 'error', role: 'alert' });
    const pace = h('p', { class: 'muted small pace-preview', 'aria-live': 'polite' });
    const secs = () => (+f.h || 0) * 3600 + (+f.m || 0) * 60 + (+f.s || 0);
    const metres = () => { const n = parseFloat(String(f.dist).replace(',', '.')); return Number.isFinite(n) && n > 0 ? fromDist(kind, n) : null; };
    const showPace = () => { const p = paceText(kind, metres(), secs()); pace.textContent = p ? `${paceLabel(kind)}: ${p}` : ''; };
    const num = (key, label, max, extra = {}) => h('label', { class: 'field compact' }, h('span', {}, label),
      h('input', { type: 'number', inputmode: 'numeric', min: 0, max, step: 1, value: f[key], placeholder: '0', 'data-noautofocus': '1',
        oninput: e => { f[key] = e.target.value; showPace(); }, ...extra }));

    // other: which sport
    const sportChips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Sport' });
    const sportInput = h('input', { value: customSport ? f.sport : '', maxlength: 40, placeholder: 'e.g. Climbing, Boxing', 'aria-label': 'Sport name', 'data-noautofocus': '1',
      hidden: !customSport, oninput: e => { f.sport = e.target.value; } });
    const distWrap = h('div', {});
    const paintSports = () => {
      mount(sportChips, [...SPORTS.map(([n]) => n), 'Other'].map(n => {
        const on = n === 'Other' ? customSport : !customSport && f.sport === n;
        return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on), onclick: () => {
          customSport = n === 'Other'; f.sport = customSport ? sportInput.value : n; sportInput.hidden = !customSport; paintSports();
          if (customSport) sportInput.focus(); } }, n);
      }));
      const withDist = customSport || SPORTS.find(([n]) => n === f.sport)?.[1] !== false;
      distWrap.hidden = !withDist;
    };
    const chipsFor = (key, list) => {
      const box = h('div', { class: 'chips', role: 'radiogroup' });
      const paint = () => mount(box, list.map(([v, l]) => h('button', { type: 'button', class: 'chip' + (f[key] === v ? ' on' : ''), role: 'radio', 'aria-checked': String(f[key] === v),
        onclick: () => { f[key] = f[key] === v && key === 'feel' ? null : v; paint(); } }, l)));
      paint();
      return box;
    };
    if (kind === 'other') paintSports();

    const btn = h('button', { class: 'btn primary block', type: 'submit' }, a ? 'Save' : 'Save ' + KINDS[kind].label.toLowerCase());
    const submit = e => {
      e.preventDefault(); err.textContent = '';
      const sport = kind === 'other' ? f.sport.trim() : null;
      if (kind === 'other' && !sport) return (err.textContent = 'Pick a sport (or type one in)');
      const t = secs();
      if (t < 30) return (err.textContent = 'Enter how long it took');
      if (t > 172800) return (err.textContent = 'That’s longer than 48 hours — check the time');
      const withDist = kind !== 'other' || !distWrap.hidden;
      const m = withDist ? metres() : null;
      const L = LIMITS[kind];
      if (kind !== 'other' && !m) return (err.textContent = 'Enter the distance');
      if (m != null && (m < L.min || m > L.max))
        return (err.textContent = `Distance must be between ${fmtDist(kind, L.min)} and ${fmtDist(kind, L.max)}`);
      if (m != null && m / t > L.fastest) return (err.textContent = 'That’s faster than the world record — check the distance and time');
      const when = new Date(`${f.date || todayISO()}T${f.time || '12:00'}`);
      if (isNaN(when) || when > new Date(Date.now() + 60000)) return (err.textContent = 'The date can’t be in the future');
      const row = { id: a?.id || api.uuid(), owner: api.userId(), kind, sport, title: f.title.trim() || null, started_at: when.toISOString(),
        duration_s: Math.round(t), distance_m: m != null ? Math.round(m * 10) / 10 : null,
        feel: kind === 'run' ? f.feel : null, pool: kind === 'swim' ? f.pool : null, stroke: kind === 'swim' ? f.stroke : null,
        notes: f.notes.trim() || null };
      api.upsert('activities', row);
      haptic();
      toast(a ? 'Saved' : `${KINDS[kind].label} saved`);
      close();
      setTimeout(checkBadges, 300);
      if (location.hash === '#/activity/' + row.id) window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.hash = '#/activity/' + row.id;
    };
    const u = distUnit(kind);
    mount(distWrap, h('label', { class: 'field' }, h('span', {}, `Distance (${u})${kind === 'other' ? ' — optional' : ''}`),
      h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: 0, value: f.dist, placeholder: kind === 'swim' ? (imperial() ? 'e.g. 1650' : 'e.g. 1500') : imperial() ? 'e.g. 3.1' : 'e.g. 5',
        'aria-label': `Distance in ${u}`, 'data-noautofocus': '1', oninput: e => { f.dist = e.target.value; showPace(); } })));
    showPace();
    return h('form', { novalidate: true, onsubmit: submit, class: 'act-form' },
      kind === 'other' && [h('div', { class: 'pick-head' }, 'Sport'), sportChips, sportInput],
      distWrap,
      h('div', { class: 'field' }, h('span', {}, 'Time'),
        h('div', { class: 'row gap dur' }, num('h', 'Hours', 48, { 'aria-label': 'Hours' }), num('m', 'Minutes', 59, { 'aria-label': 'Minutes' }), num('s', 'Seconds', 59, { 'aria-label': 'Seconds' }))),
      pace,
      kind === 'run' && [h('div', { class: 'pick-head' }, 'How did it feel?'), chipsFor('feel', FEEL.map((l, i) => [i + 1, `${i + 1} · ${l}`]))],
      kind === 'swim' && [h('div', { class: 'pick-head' }, 'Where'), chipsFor('pool', POOLS), h('div', { class: 'pick-head' }, 'Stroke'), chipsFor('stroke', STROKES)],
      h('div', { class: 'row gap' },
        h('label', { class: 'field' }, h('span', {}, 'Date'), h('input', { type: 'date', value: f.date, max: todayISO(), 'data-noautofocus': '1', onchange: e => (f.date = e.target.value) })),
        h('label', { class: 'field' }, h('span', {}, 'Start time'), h('input', { type: 'time', value: f.time, 'data-noautofocus': '1', onchange: e => (f.time = e.target.value) }))),
      h('label', { class: 'field' }, h('span', {}, 'Title — optional'),
        h('input', { value: f.title, maxlength: 80, placeholder: kind === 'run' ? 'e.g. Parkrun' : kind === 'swim' ? 'e.g. Lunch swim' : 'e.g. Sunday ride', 'data-noautofocus': '1', oninput: e => (f.title = e.target.value) })),
      h('label', { class: 'field' }, h('span', {}, 'Notes — optional'),
        h('textarea', { rows: 2, maxlength: 1000, placeholder: 'Route, weather, how it went…', oninput: e => (f.notes = e.target.value) }, f.notes)),
      err, btn);
  });
}

// ---------- cards (history, feed, friend page) ---------------------------------------
export function activityCard(a, who, prof) {
  const pace = paceText(a.kind, a.distance_m, a.duration_s);
  return h('a', { class: 'card wk-card act-card', href: '#/activity/' + a.id },
    who ? h('div', { class: 'feed-head' }, avatar(prof || {}, 38), h('span', { class: 'who' }, who, h('span', { class: 'muted small' }, ago(a.started_at))))
      : h('div', { class: 'row between' }, h('span', { class: 'cap' }, fmtDate(a.started_at)), chev()),
    h('div', { class: 'act-head' }, kindIcon(a), h('div', { class: 'wk-title' }, activityName(a))),
    h('div', { class: 'wk-mini' },
      hasDistance(a) && h('span', {}, 'Distance', h('b', {}, fmtDist(a.kind, a.distance_m))),
      h('span', {}, 'Time', h('b', {}, hms(a.duration_s))),
      pace ? h('span', {}, paceLabel(a.kind), h('b', {}, pace)) : a.kind === 'other' && a.title && h('span', {}, 'Sport', h('b', {}, a.sport))));
}

// ---------- detail page: #/activity/:id -------------------------------------------
export async function renderActivity(root, id) {
  mount(root, spinner());
  let a = null;
  const pendBefore = pendingActs().find(r => r.id === id);   // read first: it may finish uploading while we fetch
  try { a = (await api.get(`activities?id=eq.${id}&select=*,profiles(username,avatar_icon,avatar_color)`))?.[0] || null; } catch {}
  const pend = pendingActs().find(r => r.id === id) || pendBefore;   // this phone's copy is the newest
  const stillWaiting = pendingActs().some(r => r.id === id);
  if (pend) a = { ...(a || {}), ...pend, profiles: a?.profiles || state.profile };
  if (!a) {
    mount(root, h('a', { class: 'back', href: '#/history' }, ic('back', 18), 'History'), h('p', { class: 'muted' }, 'Activity not found.'));
    return;
  }
  const mine = a.owner === api.userId();
  const pace = paceText(a.kind, a.distance_m, a.duration_s);
  const big = (label, value) => h('div', { class: 'stat tile' }, h('span', { class: 'muted small' }, label), h('strong', {}, value));
  mount(root,
    h('a', { class: 'back', href: mine ? '#/history' : 'javascript:history.back()' }, ic('back', 18), 'Back'),
    h('div', { class: 'act-hero' }, kindIcon(a, 26),
      h('div', {}, h('h1', {}, activityName(a)),
        h('p', { class: 'muted small' }, !mine && h('span', {}, '@' + (a.profiles?.username || 'friend') + ' · '),
          new Date(a.started_at).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })))),
    stillWaiting && api.pendingCount() && !navigator.onLine && h('p', { class: 'muted small' }, 'Saved on this phone — it will upload when you’re online.'),
    h('div', { class: 'tiles' },
      hasDistance(a) && big('Distance', fmtDist(a.kind, a.distance_m)),
      big('Time', hms(a.duration_s)),
      pace && big(paceLabel(a.kind), pace),
      a.kind === 'other' && a.title && big('Sport', a.sport),
      a.kind === 'run' && a.feel && big('Felt', `${a.feel}/5 · ${FEEL[a.feel - 1]}`),
      a.kind === 'swim' && a.pool && big('Where', POOLS.find(([v]) => v === a.pool)?.[1] || a.pool),
      a.kind === 'swim' && a.stroke && big('Stroke', STROKES.find(([v]) => v === a.stroke)?.[1] || a.stroke)),
    a.notes && h('div', { class: 'card fb-body' }, a.notes),
    h('a', { class: 'card row gap list-link', href: '#/sport/' + a.kind }, h('span', { class: 'list-ico' }, ic('chart', 18)),
      h('span', { class: 'grow' }, mine ? `Your ${KINDS[a.kind].plural.toLowerCase()} stats` : `${KINDS[a.kind].plural} stats`), chev()),
    mine && h('div', { class: 'row gap' },
      h('button', { class: 'btn', onclick: () => logActivity(a.kind, a) }, ic('edit', 16), 'Edit'),
      h('button', { class: 'btn danger ghost', onclick: async () => {
        if (!(await confirmSheet(`Delete this ${KINDS[a.kind].label.toLowerCase()}?`, 'It will be removed from your history, stats and friends’ feeds.'))) return;
        api.remove('activities', 'id=eq.' + a.id); toast('Deleted'); location.hash = '#/history';
      } }, 'Delete')));
}

// ---------- personal bests ---------------------------------------------------------
export const RUN_PB = [['1 mile', MI], ['5k', 5000], ['10k', 10000], ['Half marathon', 21097.5], ['Marathon', 42195]];
const SWIM_PB = [['400 m', 400], ['1500 m', 1500]];
/** Fastest time at a standard distance, from activities of about that distance (−1% to +5%), scaled to the exact distance. */
export function bestAt(list, d) {
  let best = null;
  for (const a of list) {
    const m = +a.distance_m;
    if (!m || m < d * 0.99 || m > d * 1.05) continue;
    const t = a.duration_s * (d / m);
    if (!best || t < best.t) best = { t, a };
  }
  return best;
}
function pbRows(kind, list) {
  const rows = [];
  const withDist = list.filter(a => +a.distance_m > 0);
  if (!withDist.length) return rows;
  if (kind === 'run') for (const [label, d] of RUN_PB) { const b = bestAt(withDist, d); rows.push([label, b ? hms(b.t) : '—', b?.a]); }
  if (kind === 'swim') for (const [label, d] of SWIM_PB) { const b = bestAt(withDist, d); rows.push([label, b ? hms(b.t) : '—', b?.a]); }
  const longest = withDist.reduce((x, a) => (+a.distance_m > +x.distance_m ? a : x));
  rows.push([kind === 'run' ? 'Longest run' : 'Longest swim', fmtDist(kind, longest.distance_m), longest]);
  const minD = kind === 'run' ? 1000 : 400;
  const paced = withDist.filter(a => +a.distance_m >= minD);
  if (paced.length) {
    const fast = paced.reduce((x, a) => (a.duration_s / a.distance_m < x.duration_s / x.distance_m ? a : x));
    rows.push([`Fastest pace (${kind === 'run' ? '1 km' : '400 m'}+)`, paceText(kind, fast.distance_m, fast.duration_s), fast]);
  }
  return rows;
}

// ---------- stats page: #/sport/run | swim | other --------------------------------------
export async function renderSport(root, kind = 'run') {
  if (!KINDS[kind]) kind = 'run';
  const K = KINDS[kind];
  mount(root, h('a', { class: 'back', href: '#/train' }, ic('back', 18), 'Train'), h('h1', {}, K.plural), spinner());
  const list = (await loadActivities()).filter(a => a.kind === kind);
  const wk0 = mondayStart(), now = new Date();
  const month0 = new Date(now.getFullYear(), now.getMonth(), 1), year0 = new Date(now.getFullYear(), 0, 1);
  const since = d => list.filter(a => new Date(a.started_at) >= d);
  const sumD = xs => xs.reduce((t, a) => t + (+a.distance_m || 0), 0);
  const sumT = xs => xs.reduce((t, a) => t + a.duration_s, 0);
  const tile = (label, xs) => h('div', { class: 'stat tile' }, h('span', { class: 'muted small' }, label),
    h('strong', {}, kind === 'other' ? hmShort(sumT(xs)) : fmtDist(kind, sumD(xs))),
    h('span', { class: 'muted small' }, `${xs.length} ${xs.length === 1 ? 'session' : 'sessions'}`));
  const weeks = Array.from({ length: 12 }, (_, i) => { const d = new Date(wk0); d.setDate(d.getDate() - 7 * (11 - i)); return d; });
  const weekVals = weeks.map((d, i) => { const e = weeks[i + 1] || new Date(8.64e15); const xs = list.filter(a => { const t = new Date(a.started_at); return t >= d && t < e; });
    return kind === 'other' ? Math.round(sumT(xs) / 60) : toDist(kind, sumD(xs)); });
  const fmtWeek = v => (kind === 'other' ? hmShort(v * 60) : `${kind === 'swim' ? Math.round(v).toLocaleString() : Math.round(v * 10) / 10} ${distUnit(kind)}`);
  const bySport = new Map();
  if (kind === 'other') for (const a of since(month0)) bySport.set(a.sport, [...(bySport.get(a.sport) || []), a]);
  const pbs = kind === 'other' ? [] : pbRows(kind, list);
  mount(root,
    h('a', { class: 'back', href: '#/train' }, ic('back', 18), 'Train'),
    h('div', { class: 'section-head' }, h('h1', {}, K.plural), h('button', { class: 'btn primary small', onclick: () => logActivity(kind) }, ic('plus', 16), 'Log')),
    !list.length ? h('div', { class: 'empty' }, h('p', {}, `No ${K.plural.toLowerCase()} logged yet.`),
        h('button', { class: 'btn primary', onclick: () => logActivity(kind) }, K.log))
      : [
        h('div', { class: 'tiles' }, tile('This week', since(wk0)), tile('This month', since(month0)), tile('This year', since(year0)), tile('All time', list)),
        columnChart(weekVals, weeks.map(d => 'w/c ' + d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })), fmtWeek,
          kind === 'other' ? 'Time per week, last 12 weeks' : 'Distance per week, last 12 weeks'),
        kind === 'other' && bySport.size > 0 && [h('h2', {}, 'This month by sport'), h('section', { class: 'card' }, h('ul', { class: 'pr-list' },
          [...bySport].sort((x, y) => sumT(y[1]) - sumT(x[1])).map(([s, xs]) => h('li', {}, h('strong', {}, s),
            h('span', { class: 'muted small' }, `${xs.length}× · ${hmShort(sumT(xs))}${sumD(xs) ? ' · ' + fmtDist('other', sumD(xs)) : ''}`)))))],
        pbs.length > 0 && [h('h2', {}, 'Personal bests'), h('section', { class: 'card' }, h('ul', { class: 'pr-list pb-list' },
          pbs.map(([label, val, a]) => h('li', {}, h('span', {}, h('strong', {}, label), a && [h('br'), h('span', { class: 'muted small' }, fmtDay(a.started_at))]),
            a ? h('a', { class: 'pb-val', href: '#/activity/' + a.id }, val) : h('span', { class: 'muted' }, val))))),
          kind === 'run' && h('p', { class: 'muted small' }, 'Distance bests come from runs of about that distance (up to 5% longer), scaled to the exact distance.')],
        h('h2', {}, 'Recent'),
        list.slice(0, 10).map(a => activityCard(a))]);
}
