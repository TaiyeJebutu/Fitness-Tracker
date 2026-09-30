// First-run tutorial: a few swipeable cards. Shown once after signing up, and any time
// from Help & guide ("Take the tour again") or Me ("Replay the tutorial").
import { h, ic, logoMark, haptic } from './ui.js';
import { installContent, markNudged } from './install.js';

const PENDING = 'ft.tourPending';
/** Ask for the tour to open after the next sign-in (used right after creating an account). */
export const queueTour = () => { try { localStorage.setItem(PENDING, '1'); } catch {} };
export function maybeShowTour() {
  let pending = false;
  try { pending = localStorage.getItem(PENDING) === '1'; localStorage.removeItem(PENDING); } catch {}
  if (pending) setTimeout(showTour, 500);
}

// ---------- little illustrations built from the app's own pieces ----------
const mini = (...kids) => h('div', { class: 'tour-art', 'aria-hidden': 'true' }, ...kids);
const tabs = on => h('div', { class: 'tour-tabs' }, [['home', 'Home'], ['train', 'Train'], ['friends', 'Friends'], ['ranks', 'Ranks'], ['me', 'Me']]
  .map(([i, l]) => h('span', { class: l === on ? 'on' : '' }, ic(i, 20), l)));
const setRow = (n, kg, reps, done) => h('div', { class: 'tour-set' + (done ? ' done' : '') },
  h('b', {}, n), h('span', {}, kg), h('span', {}, reps), h('i', { class: done ? 'on' : '' }, ic('check', 16)));

const CARDS = [
  { title: 'Welcome to Fitness Tracker', text: 'Track gym workouts, runs, swims and more, and keep each other going with friends. It’s free, with no ads. Here’s a quick tour.',
    art: () => mini(h('div', { class: 'tour-logo' }, logoMark(84))) },
  { install: true },
  { title: 'Find your way around', text: 'Five tabs along the bottom. Home is your dashboard: your streak and weekly goal rings, your plan for the week (tap a day to plan it), a grid of every day you trained, and this week’s numbers.',
    art: () => mini(h('div', { class: 'tour-ring' }, h('b', {}, '4'), h('span', {}, 'week streak')),
      h('div', { class: 'tour-grid' }, Array.from({ length: 28 }, (_, i) => h('i', { class: 'hm' + [0, 2, 0, 3, 1, 0, 0, 1, 0, 4, 0, 2, 0, 0, 2, 0, 3, 0, 1, 0, 0, 0, 4, 0, 2, 3, 0, 1][i] }))),
      tabs('Home')) },
  { title: 'Start a gym workout', text: 'On Train, tap “Start empty workout”, or save your usual sessions as routines (like “Push day”) and start them in one tap.',
    art: () => mini(h('div', { class: 'tour-btn' }, ic('play', 18), 'Start empty workout'),
      h('div', { class: 'tour-card' }, h('span', {}, h('strong', {}, 'Push day'), h('small', {}, 'Bench Press, Overhead Press…')), h('em', {}, ic('play', 14), 'Start')), tabs('Train')) },
  { title: 'Log your sets', text: 'Weight and reps are filled in from last time. Tick a set to log it: the rest timer starts, and you can note how many reps you had left (RIR). Tap Finish when you’re done.',
    art: () => mini(h('div', { class: 'tour-card col' }, h('strong', {}, 'Bench Press'),
      setRow('1', '80', '8', true), setRow('2', '80', '8', true), setRow('3', '82.5', '6', false)),
      h('div', { class: 'tour-rest' }, ic('timer', 18), h('b', {}, '1:24'), h('span', {}, 'REST'))) },
  { title: 'Runs, swims & more', text: 'After a run, swim, ride or game, tap Run, Swim or Other on Train and enter the distance and time. You’ll get your pace, weekly totals and personal bests like your fastest 5k.',
    art: () => mini(h('div', { class: 'tour-kinds' }, [['run', 'Run'], ['swim', 'Swim'], ['pulse', 'Other']].map(([i, l]) => h('span', {}, ic(i, 22), l))),
      h('div', { class: 'tour-card' }, h('span', {}, h('strong', {}, '5k'), h('small', {}, 'Personal best')), h('em', { class: 'plain' }, '24:10'))) },
  { title: 'Friends, ranks & badges', text: 'Add friends by username on the Friends tab to see each other’s training. Compete on the leaderboards in Ranks, and earn badges as you go.',
    art: () => mini(h('div', { class: 'tour-board' }, [['1', '@you', '142 kg'], ['2', '@sam', '130 kg'], ['3', '@alex', '118 kg']]
      .map(([r, n, v], i) => h('div', { class: i === 0 ? 'me' : '' }, h('b', {}, r), h('span', {}, n), h('em', {}, v)))),
      h('div', { class: 'tour-badges' }, ['🎉', '🔥', '🏃', '🏅'].map(e => h('span', {}, e)))) },
  { title: 'Help is always there', text: 'Tap the question mark at the top of any screen for help with it — including how to add the app to your Home Screen. You can replay this tour from Help & guide or the Me tab.',
    art: () => mini(h('div', { class: 'tour-help' }, ic('help', 34)), h('div', { class: 'tour-btn ghost' }, ic('play', 16), 'Take the tour again')) },
];

export function showTour() {
  if (document.querySelector('.tour')) return;
  let i = 0;
  markNudged();   // the tour covers installing, so no separate nudge afterwards
  const page = (c, n, ...kids) => h('section', { class: 'tour-card-page', 'aria-roledescription': 'slide', 'aria-label': `${n + 1} of ${CARDS.length}` }, ...kids);
  const track = h('div', { class: 'tour-track' }, CARDS.map((c, n) => {
    if (c.install) { const x = installContent(); return page(c, n, mini(x.art), h('h2', {}, x.title), h('div', { class: 'tour-body' }, x.body)); }
    return page(c, n, c.art(), h('h2', {}, c.title), h('p', {}, c.text));
  }));
  const dots = h('div', { class: 'tour-dots', 'aria-hidden': 'true' }, CARDS.map(() => h('i')));
  const next = h('button', { class: 'btn primary block big' }, 'Next');
  const back = h('button', { class: 'btn ghost tour-back', 'aria-label': 'Previous' }, ic('back', 18), 'Back');
  const skip = h('button', { class: 'btn ghost small tour-skip' }, 'Skip');
  const wrap = h('div', { class: 'tour', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Welcome tour' },
    h('div', { class: 'tour-top' }, h('span', { class: 'tour-count', 'aria-live': 'polite' }), skip), track, dots, h('div', { class: 'tour-nav' }, back, next));
  const paint = () => {
    [...dots.children].forEach((d, n) => d.classList.toggle('on', n === i));
    wrap.querySelector('.tour-count').textContent = `${i + 1} of ${CARDS.length}`;
    next.textContent = i === CARDS.length - 1 ? 'Let’s go' : 'Next';
    back.style.visibility = i === 0 ? 'hidden' : 'visible';
    skip.style.visibility = i === CARDS.length - 1 ? 'hidden' : 'visible';
  };
  const go = n => { i = Math.max(0, Math.min(CARDS.length - 1, n)); track.scrollTo({ left: i * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); paint(); };
  const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 220); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); };
  next.addEventListener('click', () => { haptic(8); i === CARDS.length - 1 ? close() : go(i + 1); });
  back.addEventListener('click', () => go(i - 1));
  skip.addEventListener('click', close);
  // swiping: keep the dots in step with the scroll position
  let t;
  track.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { const n = Math.round(track.scrollLeft / track.clientWidth); if (n !== i) { i = n; paint(); } }, 60); });
  document.addEventListener('keydown', key);
  document.body.append(wrap);
  paint();
  next.focus();
}
