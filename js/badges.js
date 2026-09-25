// Achievement badges. The database decides who has earned what (see check_achievements in the SQL);
// this file holds the names/icons and the screens that show them.
import * as api from './api.js';
import { state, loadFriends } from './store.js';
import { avatar, profileById } from './avatar.js';
import { h, mount, toast, spinner, fmtDay } from './ui.js';

export const BADGES = [
  ['Workouts', [
    ['w1', '🎉', 'First workout', 'Finish your first workout'],
    ['w10', '🔟', '10 workouts', 'Finish 10 workouts'],
    ['w25', '🥉', '25 workouts', 'Finish 25 workouts'],
    ['w50', '🥈', '50 workouts', 'Finish 50 workouts'],
    ['w100', '🥇', '100 workouts', 'Finish 100 workouts'],
    ['w250', '🏅', '250 workouts', 'Finish 250 workouts'],
    ['w500', '👑', '500 workouts', 'Finish 500 workouts'],
  ]],
  ['Streaks', [
    ['streak4', '🔥', '4-week streak', 'Train at least once a week, 4 weeks in a row'],
    ['streak12', '🔥', '12-week streak', '12 weeks in a row'],
    ['streak26', '☄️', '26-week streak', 'Half a year without missing a week'],
    ['streak52', '🌟', '52-week streak', 'A whole year without missing a week'],
  ]],
  ['Personal records', [
    ['pr1', '📈', 'First PR', 'Beat your best estimated 1-rep max on any exercise'],
    ['pr10', '🚀', '10 PRs', 'Set 10 personal records'],
    ['pr50', '🏆', '50 PRs', 'Set 50 personal records'],
    ['bw_bench', '💪', 'Bodyweight bench', 'Bench press (barbell) your bodyweight'],
    ['bw_squat', '🦵', '1.5× bodyweight squat', 'Back squat 1.5× your bodyweight'],
    ['bw_deadlift', '🏋️', '2× bodyweight deadlift', 'Deadlift twice your bodyweight'],
    ['club100', '💯', '100 kg bench club', 'Bench press (barbell) 100 kg'],
  ]],
  ['Volume', [
    ['vol10t', '🧱', '10 tonnes', 'Lift 10,000 kg in total (weight × reps)'],
    ['vol100t', '🏗️', '100 tonnes', 'Lift 100,000 kg in total'],
    ['vol1000t', '🌋', '1,000 tonnes', 'Lift 1,000,000 kg in total'],
  ]],
  ['Social & body', [
    ['friend1', '🤝', 'First friend', 'Add your first friend'],
    ['copy1', '📋', 'Borrowed a plan', 'Copy a friend’s routine'],
    ['body4', '📏', '4-week check-in', 'Log a body stat 4 weeks in a row'],
    ['body12', '📐', '12-week check-in', 'Log a body stat 12 weeks in a row'],
  ]],
];
export const BADGE = Object.fromEntries(BADGES.flatMap(([, list]) => list.map(([k, icon, name, desc]) => [k, { key: k, icon, name, desc }])));
export const TOTAL = Object.keys(BADGE).length;

/** Ask the database to award anything newly earned. Safe to call often; silent if offline. */
let checking = null;
export function checkBadges() {
  if (checking) return checking;
  checking = (async () => {
    try {
      await api.flush();
      if (api.pendingCount()) return [];
      const fresh = (await api.rpc('check_achievements', {}, { cache: false })) || [];
      const known = fresh.filter(k => BADGE[k]);
      if (known.length === 1) toast(`${BADGE[known[0]].icon} New badge: ${BADGE[known[0]].name}`);
      else if (known.length > 1) toast(`🏅 ${known.length} new badges! See them under Me → Badges`);
      return known;
    } catch { return []; }
    finally { setTimeout(() => (checking = null), 0); }
  })();
  return checking;
}

export async function earnedBy(userId) {
  const rows = await api.get(`achievements?user_id=eq.${userId}&select=badge,earned_at&order=earned_at.desc`).catch(() => []);
  return rows.filter(r => BADGE[r.badge]);
}

/** Row of earned badge icons (friend page / Me summary). */
export function badgeStrip(rows, max = 12) {
  if (!rows.length) return h('p', { class: 'muted small' }, 'No badges yet.');
  return h('div', { class: 'badge-strip' },
    rows.slice(0, max).map(r => h('span', { class: 'badge-chip', title: BADGE[r.badge].name }, BADGE[r.badge].icon,
      h('span', { class: 'small' }, BADGE[r.badge].name))),
    rows.length > max && h('span', { class: 'muted small' }, `+${rows.length - max} more`));
}

/** Full badges screen: #/badges (mine) or #/badges/<friend id>. */
export async function renderBadges(root, userId) {
  const me = api.userId();
  const id = userId || me;
  mount(root, spinner());
  if (id !== me && !state.friends.length) await loadFriends().catch(() => {});
  const who = profileById(id);
  if (id !== me && !who) { mount(root, h('p', { class: 'muted' }, 'Not in your friends list.')); return; }
  if (id === me) await checkBadges();
  const rows = await earnedBy(id);
  const got = new Map(rows.map(r => [r.badge, r.earned_at]));
  mount(root,
    h('a', { class: 'back', href: id === me ? '#/me' : '#/friend/' + id }, '‹ Back'),
    h('div', { class: 'row gap' }, avatar(who, 44), h('h1', {}, id === me ? 'My badges' : '@' + who.username)),
    h('p', { class: 'muted' }, `${got.size} of ${TOTAL} earned`),
    BADGES.map(([group, list]) => [
      h('h2', {}, group),
      h('div', { class: 'badge-grid' }, list.map(([k, icon, name, desc]) => h('div', { class: 'badge-card' + (got.has(k) ? ' got' : '') },
        h('span', { class: 'badge-icon', 'aria-hidden': 'true' }, icon),
        h('strong', {}, name),
        h('span', { class: 'muted small' }, got.has(k) ? 'Earned ' + fmtDay(got.get(k)) : desc),
        !got.has(k) && h('span', { class: 'sr-only' }, 'Not earned yet'))))]));
}

/** Feed cards: a friend's badges grouped per person per day. */
export function badgeFeedItems(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (!BADGE[r.badge]) continue;
    const key = r.user_id + '|' + r.earned_at.slice(0, 10);
    if (!groups.has(key)) groups.set(key, { user_id: r.user_id, at: r.earned_at, badges: [] });
    groups.get(key).badges.push(r.badge);
  }
  return [...groups.values()].map(g => {
    const p = profileById(g.user_id);
    return { at: g.at, el: h('a', { class: 'card badge-feed', href: '#/badges/' + g.user_id },
      h('div', { class: 'row gap' }, avatar(p, 32),
        h('div', {}, h('strong', {}, `@${p?.username || 'friend'} `),
          g.badges.length === 1 ? `earned “${BADGE[g.badges[0]].name}”` : `earned ${g.badges.length} badges`,
          h('div', { class: 'muted small' }, fmtDay(g.at)))),
      h('div', { class: 'badge-icons', 'aria-hidden': 'true' }, g.badges.slice(0, 8).map(b => BADGE[b].icon).join(' '))) };
  });
}
