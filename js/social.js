// Friends, activity feed, a friend's page (routines to copy, shared body stats), leaderboards.
import * as api from './api.js';
import { state, loadFriends, loadExercises, exName, saveRoutine, METRICS } from './store.js';
import { workoutCard, stat } from './train.js';
import { h, mount, toast, confirmSheet, spinner, fmtW, fmtL, fmtBig, mondayStart, lineChart, toW, wUnit, currentPage } from './ui.js';

// ---------- Feed + friends ----------------------------------------------
export async function renderFeed(root, tab = 'feed') {
  const tabs = h('div', { class: 'tabs', role: 'tablist' },
    h('a', { href: '#/feed', class: tab === 'feed' ? 'on' : '', role: 'tab' }, 'Feed'),
    h('a', { href: '#/friends', class: tab === 'friends' ? 'on' : '', role: 'tab' }, 'Friends'));
  const body = h('div', {}, spinner());
  mount(root, tabs, body);
  try { await loadFriends(); } catch (e) { mount(body, h('p', { class: 'muted' }, e.message)); return; }
  const incoming = state.friendRows.filter(r => r.status === 'pending' && r.addressee === api.userId());
  if (incoming.length) tabs.querySelector('a[href="#/friends"]').append(h('span', { class: 'badge' }, incoming.length));
  return tab === 'feed' ? feed(body) : friends(body, incoming);
}

async function feed(body) {
  if (!state.friends.length) {
    mount(body, h('div', { class: 'empty' }, h('p', {}, 'Add friends to see their workouts here.'), h('a', { class: 'btn primary', href: '#/friends' }, 'Find friends')));
    return;
  }
  try {
    const ids = state.friends.map(f => f.id).join(',');
    const list = await api.get(`workouts?owner=in.(${ids})&ended_at=not.is.null&select=id,name,owner,started_at,ended_at,profiles(username),sets(exercise_id,reps,weight_kg)&order=started_at.desc&limit=40`);
    // friends' custom exercises need names too
    if (list.some(w => w.sets.some(s => !state.exById.has(s.exercise_id)))) await loadExercises();
    mount(body, list.length ? list.map(w => workoutCard(w, '@' + w.profiles?.username)) : h('p', { class: 'muted' }, 'No friend workouts yet.'));
  } catch (e) { mount(body, h('p', { class: 'muted' }, e.message)); }
}

function friends(body, incoming) {
  const uid = api.userId();
  const outgoing = state.friendRows.filter(r => r.status === 'pending' && r.requester === uid);
  let name = '';
  const send = async () => {
    const u = name.trim().replace(/^@/, '');
    if (!u) return;
    try {
      const found = await api.get(`profiles?username=ilike.${encodeURIComponent(u.replace(/[%_]/g, '\\$&'))}&select=id,username`, { cache: false });
      const p = found?.[0];
      if (!p) return toast('No one with that username', 'err');
      if (p.id === uid) return toast('That’s you!', 'err');
      const existing = state.friendRows.find(r => (r.requester === p.id && r.addressee === uid) || (r.addressee === p.id && r.requester === uid));
      if (existing?.status === 'accepted') return toast(`You’re already friends with @${p.username}`);
      if (existing && existing.requester === p.id) { await accept(existing); return; }
      if (existing) return toast('Request already sent');
      await api.insertNow('friendships', { requester: uid, addressee: p.id });
      toast(`Request sent to @${p.username}`);
      renderFeed(currentPage(), 'friends');
    } catch (e) { toast(e.message, 'err'); }
  };
  const accept = async r => {
    try { await api.patch('friendships', `requester=eq.${r.requester}&addressee=eq.${r.addressee}`, { status: 'accepted' });
      toast('Friend added'); await loadExercises(); renderFeed(currentPage(), 'friends'); }
    catch (e) { toast(e.message, 'err'); }
  };
  const drop = async (r, msg) => {
    if (msg && !(await confirmSheet(msg, 'You can always send a new request later.', 'Remove'))) return;
    try { await api.removeNow('friendships', `requester=eq.${r.requester}&addressee=eq.${r.addressee}`);
      renderFeed(currentPage(), 'friends'); }
    catch (e) { toast(e.message, 'err'); }
  };
  mount(body,
    h('form', { class: 'row gap', onsubmit: e => { e.preventDefault(); send(); } },
      h('input', { placeholder: 'Friend’s username', 'aria-label': 'Friend’s username', autocapitalize: 'off', autocomplete: 'off', 'data-noautofocus': '1', oninput: e => (name = e.target.value) }),
      h('button', { class: 'btn primary', type: 'submit' }, 'Add')),
    h('p', { class: 'muted small' }, `Your username is @${state.profile?.username || '…'} — share it with friends.`),
    incoming.length > 0 && [h('h2', {}, 'Requests'), incoming.map(r => h('div', { class: 'card row between' },
      h('strong', {}, '@' + r.req?.username),
      h('div', { class: 'row gap' }, h('button', { class: 'btn small primary', onclick: () => accept(r) }, 'Accept'),
        h('button', { class: 'btn small ghost', onclick: () => drop(r) }, 'Decline'))))],
    h('h2', {}, 'Friends'),
    state.friends.length ? state.friends.map(f => h('a', { class: 'card row between', href: '#/friend/' + f.id },
      h('strong', {}, '@' + f.username), h('span', { class: 'muted' }, '›'))) : h('p', { class: 'muted' }, 'No friends yet.'),
    outgoing.length > 0 && [h('h2', {}, 'Sent'), outgoing.map(r => h('div', { class: 'card row between' },
      h('span', {}, '@' + r.adr?.username, h('span', { class: 'muted small' }, ' · waiting')),
      h('button', { class: 'btn small ghost', onclick: () => drop(r) }, 'Cancel')))]);
}

// ---------- A friend's page -----------------------------------------------
export async function renderFriend(root, id) {
  mount(root, spinner());
  if (!state.friends.length) await loadFriends().catch(() => {});
  const f = state.friends.find(x => x.id === id);
  if (!f) { mount(root, h('p', { class: 'muted' }, 'Not in your friends list.'), h('a', { class: 'btn', href: '#/friends' }, 'Back')); return; }
  const [routines, metrics, recent] = await Promise.all([
    api.get(`routines?owner=eq.${id}&select=*&order=name`).catch(() => []),
    api.get(`body_metrics?owner=eq.${id}&select=metric,value,measured_on&order=measured_on.asc`).catch(() => []),
    api.get(`workouts?owner=eq.${id}&ended_at=not.is.null&select=id,name,started_at,ended_at,sets(exercise_id,reps,weight_kg)&order=started_at.desc&limit=5`).catch(() => []),
  ]);
  if ([...routines.flatMap(r => r.items), ...recent.flatMap(w => w.sets)].some(x => !state.exById.has(x.exercise_id))) await loadExercises().catch(() => {});
  const byMetric = new Map();
  for (const m of metrics) byMetric.set(m.metric, [...(byMetric.get(m.metric) || []), m]);
  const friendRow = state.friendRows.find(r => r.status === 'accepted' && (r.requester === id || r.addressee === id));
  mount(root,
    h('a', { class: 'back', href: '#/friends' }, '‹ Friends'),
    h('h1', {}, '@' + f.username),
    h('h2', {}, 'Routines'),
    routines.length ? routines.map(r => h('div', { class: 'card routine' },
      h('div', { class: 'routine-info' }, h('strong', {}, r.name), h('span', { class: 'muted small' }, r.items.map(i => exName(i.exercise_id)).join(', '))),
      h('button', { class: 'btn small', onclick: () => copyRoutine(r, f.username) }, 'Copy'))) : h('p', { class: 'muted' }, 'No routines shared.'),
    byMetric.size > 0 && [h('h2', {}, 'Body stats they share'),
      h('div', { class: 'stats' }, [...byMetric].map(([k, list]) => {
        const def = METRICS.find(m => m.key === k); const last = list[list.length - 1];
        return stat(def?.label || k, fmtMetric(def, last.value));
      })),
      byMetric.has('bodyweight') && lineChart(byMetric.get('bodyweight').map(m => ({ x: new Date(m.measured_on), y: toW(+m.value) })),
        { fmt: v => (Math.round(v * 10) / 10) + ' ' + wUnit(), label: `Bodyweight (${wUnit()})` })],
    h('h2', {}, 'Recent workouts'),
    recent.length ? recent.map(w => workoutCard(w)) : h('p', { class: 'muted' }, 'Nothing yet.'),
    friendRow && h('button', { class: 'btn danger ghost block', onclick: async () => {
      if (!(await confirmSheet(`Remove @${f.username}?`, 'You’ll stop seeing each other’s workouts.', 'Remove'))) return;
      await api.removeNow('friendships', `requester=eq.${friendRow.requester}&addressee=eq.${friendRow.addressee}`).catch(e => toast(e.message, 'err'));
      location.hash = '#/friends'; } }, 'Remove friend'));
}

export const fmtMetric = (def, v) => (def?.kind === 'w' ? fmtW(v) : def?.kind === 'pct' ? (Math.round(v * 10) / 10) + '%' : fmtL(v));

function copyRoutine(r, from) {
  const me = api.userId();
  // Friends' custom exercises get copied into your own list (so the routine keeps working if you unfriend).
  const items = r.items.map(it => {
    const ex = state.exById.get(it.exercise_id);
    if (!ex || ex.owner == null || ex.owner === me) return { ...it };
    const mine = state.exercises.find(x => (x.owner === me || x.owner == null) && x.name.toLowerCase() === ex.name.toLowerCase());
    if (mine) return { ...it, exercise_id: mine.id };
    const copy = { id: api.uuid(), name: ex.name, category: ex.category, owner: me };
    api.upsert('exercises', copy);
    state.exercises.push(copy); state.exById.set(copy.id, copy);
    return { ...it, exercise_id: copy.id };
  });
  saveRoutine({ id: api.uuid(), name: `${r.name} (from @${from})`.slice(0, 80), items });
  toast('Copied to your routines');
}

// ---------- Leaderboards -------------------------------------------------
const LB_TABS = [['lift', 'Best lift'], ['progress', 'Progress'], ['volume', 'Volume'], ['activity', 'Activity']];

export async function renderRanks(root, tab = 'lift') {
  const exKey = 'ft.lbExercise';
  const me = api.userId();
  let exId = api.LS.get(exKey) || state.exercises.find(x => x.name === 'Bench Press (Barbell)')?.id || state.exercises[0]?.id;
  const board = h('div', {});
  const picker = h('select', { 'aria-label': 'Exercise', onchange: e => { exId = e.target.value; api.LS.set(exKey, exId); load(); } },
    state.exercises.filter(x => x.owner == null || x.owner === me).map(x => h('option', { value: x.id, selected: x.id === exId }, x.name)));
  mount(root,
    h('h1', {}, 'Leaderboards'),
    h('div', { class: 'tabs', role: 'tablist' }, LB_TABS.map(([k, l]) => h('a', { href: '#/ranks/' + k, class: tab === k ? 'on' : '', role: 'tab' }, l))),
    (tab === 'lift' || tab === 'progress') && picker,
    board);

  async function load() {
    mount(board, spinner());
    try {
      let rows;
      if (tab === 'lift') {
        rows = (await api.rpc('lb_best_lift', { p_exercise: exId })).map(r => ({ ...r, main: fmtW(r.best_e1rm), sub: `heaviest ${fmtW(r.best_weight)}` }));
        note(board, 'Ranked by estimated 1-rep max (from sets of 12 reps or fewer).');
      } else if (tab === 'progress') {
        rows = (await api.rpc('lb_progress', { p_exercise: exId })).map(r => ({ ...r,
          main: (r.pct > 0 ? '+' : '') + r.pct + '%', sub: `${fmtW(r.before_e1rm)} → ${fmtW(r.recent_e1rm)}` }));
        note(board, 'Change in best estimated 1RM: last 4 weeks vs the 4 weeks before. You need sessions in both periods to appear.');
      } else if (tab === 'volume') {
        rows = (await api.rpc('lb_volume', { p_since: mondayStart().toISOString() })).map(r => ({ ...r, main: fmtBig(r.volume_kg), sub: `${r.set_count} sets` }));
        note(board, 'Total weight × reps since Monday.');
      } else {
        rows = await activity();
        note(board, 'Workouts this week. Streak = weeks in a row with at least one workout.');
      }
      board.append(rows.length ? h('ol', { class: 'board' }, rows.map((r, i) => h('li', { class: r.user_id === me ? 'me' : '' },
        h('span', { class: 'rank' }, i + 1),
        h('span', { class: 'who' }, '@' + r.username, r.user_id === me && h('span', { class: 'muted small' }, ' (you)')),
        h('span', { class: 'val' }, h('strong', {}, r.main), h('span', { class: 'muted small' }, r.sub)))))
        : h('p', { class: 'muted center' }, state.friends.length || tab !== 'activity' ? 'No data yet — go lift something!' : 'No data yet.'));
    } catch (e) { mount(board, h('p', { class: 'muted' }, e.message)); }
  }
  load();
}
const note = (el, t) => mount(el, h('p', { class: 'muted small' }, t));

async function activity() {
  if (!state.friends.length) await loadFriends().catch(() => {});
  const people = [{ id: api.userId(), username: state.profile?.username || 'me' }, ...state.friends];
  const since = new Date(Date.now() - 366 * 86400000).toISOString();
  const rows = await api.get(`workouts?ended_at=not.is.null&started_at=gte.${since}&select=owner,started_at&order=started_at.desc&limit=5000`);
  const week0 = +mondayStart();
  const WEEK = 7 * 86400000;
  return people.map(p => {
    const mine = rows.filter(r => r.owner === p.id);
    const weeks = new Set(mine.map(r => Math.floor((week0 - +mondayStart(new Date(r.started_at))) / WEEK + 0.5)));
    const thisWeek = mine.filter(r => +new Date(r.started_at) >= week0).length;
    let streak = 0, w = weeks.has(0) ? 0 : 1;
    while (weeks.has(w)) { streak++; w++; }
    const month = mine.filter(r => Date.now() - new Date(r.started_at) < 30 * 86400000).length;
    return { user_id: p.id, username: p.username, thisWeek, streak, month,
      main: `${thisWeek} this week`, sub: `${streak}-week streak · ${month} in 30 days` };
  }).sort((a, b) => b.thisWeek - a.thisWeek || b.streak - a.streak || b.month - a.month);
}
