// Muscle heat map: a simple front and back body figure, each muscle shaded by how much you trained it.
// Drawn here (no images or libraries). Shapes are defined for the left side and mirrored.
// Counting: every logged set counts 1 for each main muscle of its exercise and ½ for each helper muscle
// (a left + right pair of a one-sided exercise counts as one set).
import { state } from './store.js';
import { h, mount, haptic } from './ui.js';

export const MUSCLES = {
  chest: 'Chest', traps: 'Traps', lats: 'Lats', lowerback: 'Lower back',
  frontdelts: 'Front shoulders', sidedelts: 'Side shoulders', reardelts: 'Rear shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abs', obliques: 'Obliques',
  glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', adductors: 'Inner thighs', calves: 'Calves',
};

// [muscle, path] for the LEFT half of the figure (x < 100); mirrored for the right. viewBox 0 0 200 420.
const FRONT = [
  ['traps', 'M91 58 C86 64 80 67 72 70 L91 70 Z'],
  ['frontdelts', 'M71 72 C64 73 60 78 60 86 C60 94 62 100 64 104 C68 98 72 92 74 84 Z'],
  ['sidedelts', 'M68 71 C58 71 51 78 51 90 C51 96 53 101 56 105 L63 104 C60 98 58 92 59 85 C60 78 64 73 68 71 Z'],
  ['chest', 'M97 74 L76 73 C74 84 70 94 66 104 C70 110 80 114 90 113 C95 112 97 109 97 104 Z'],
  ['biceps', 'M56 108 C52 116 50 128 51 140 C53 146 57 148 61 146 C64 136 65 122 63 110 Z'],
  ['forearms', 'M51 150 C47 160 44 174 44 188 C45 192 48 193 51 192 C55 180 59 166 60 152 C57 149 54 149 51 150 Z'],
  ['abs', 'M98 118 L87 118 C86 132 86 150 87 164 C89 172 93 178 98 180 Z'],
  ['obliques', 'M84 118 C80 118 76 116 72 114 C71 130 72 148 76 164 C78 169 81 172 85 172 C84 154 83 136 84 118 Z'],
  ['quads', 'M92 201 C86 200 79 197 73 193 C69 212 69 240 73 262 C76 276 81 284 87 286 C90 276 91 262 91 250 C91 232 91 216 92 201 Z'],
  ['adductors', 'M99 201 L95 201 C94 216 93 232 93 248 C96 238 99 222 99 208 Z'],
  ['calves', 'M78 300 C74 314 73 332 76 350 C78 360 82 364 86 362 C88 346 88 326 86 304 C84 300 81 299 78 300 Z'],
];
const BACK = [
  ['traps', 'M100 56 L92 58 C86 64 78 68 70 71 C80 76 88 84 94 98 C96 104 98 112 100 118 Z'],
  ['reardelts', 'M69 73 C62 74 58 80 58 88 C58 95 61 101 64 104 C68 98 72 90 74 82 Z'],
  ['sidedelts', 'M66 71 C56 72 51 79 51 90 C51 96 53 101 56 105 L62 104 C59 98 56 92 57 85 C58 78 62 73 66 71 Z'],
  ['lats', 'M92 102 C86 90 80 80 75 78 C72 90 68 100 66 108 C68 124 74 142 82 156 C86 150 90 140 93 128 Z'],
  ['lowerback', 'M98 124 L95 128 C92 142 88 154 84 162 C86 172 92 178 98 180 Z'],
  ['triceps', 'M56 108 C52 116 50 128 51 140 C53 146 57 148 61 146 C64 136 65 122 63 110 Z'],
  ['forearms', 'M51 150 C47 160 44 174 44 188 C45 192 48 193 51 192 C55 180 59 166 60 152 C57 149 54 149 51 150 Z'],
  ['glutes', 'M98 184 C88 182 78 184 73 192 C70 202 72 214 80 220 C88 224 96 222 98 216 Z'],
  ['hamstrings', 'M96 226 C88 228 80 226 74 222 C71 240 72 260 76 274 C79 282 84 286 89 285 C92 272 94 256 94 242 Z'],
  ['calves', 'M76 298 C72 310 71 326 74 342 C76 354 81 360 86 358 C89 346 90 328 88 306 C85 299 80 297 76 298 Z'],
];
// the body outline (not a muscle): head, neck, hands, knees, feet — left half
const BASE = 'M100 12 C88 12 81 21 81 33 C81 44 88 53 100 53 Z '
  + 'M92 54 L100 54 L100 70 L91 70 Z '
  + 'M44 194 C41 200 42 208 46 210 C50 211 52 205 52 196 Z '
  + 'M77 172 C80 180 88 184 98 186 L98 197 C88 197 80 194 74 189 C74 182 75 176 77 172 Z '
  + 'M88 288 C83 288 78 290 77 296 C80 298 84 299 87 300 C89 296 89 291 88 288 Z '
  + 'M86 364 C82 366 76 368 74 374 C76 378 84 378 90 376 C91 371 89 366 86 364 Z';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** One side of the figure as an SVG string. levels: { muscle: 0..4 }, titles: { muscle: 'Chest · 12 sets' }. */
export function bodySvg(side, levels = {}, titles = {}, { width = 140 } = {}) {
  const parts = side === 'back' ? BACK : FRONT;
  const shape = (m, d) => {
    const lv = levels[m] || 0;
    const t = esc(titles[m] || MUSCLES[m]);
    return `<path d="${d}" class="mus hm${lv}" data-m="${m}"><title>${t}</title></path>`
      + `<path d="${d}" class="mus hm${lv}" data-m="${m}" transform="translate(200 0) scale(-1 1)"><title>${t}</title></path>`;
  };
  return `<svg class="bodymap" viewBox="40 8 120 374" width="${width}" height="${Math.round(width * 374 / 120)}" role="img" aria-label="${side === 'back' ? 'Back' : 'Front'} of the body">`
    + `<path d="${BASE}" class="body-base"/><path d="${BASE}" class="body-base" transform="translate(200 0) scale(-1 1)"/>`
    + parts.map(([m, d]) => shape(m, d)).join('') + '</svg>';
}

// ---------- which muscles an exercise works --------------------------------------------
// Used for your own exercises that don't have muscles set yet (a guess from the body area).
export const AREA_MUSCLES = {
  Chest: [['chest'], ['triceps', 'frontdelts']], Back: [['lats'], ['traps', 'biceps']], Shoulders: [['frontdelts', 'sidedelts'], []],
  Arms: [[], ['biceps', 'triceps']], Legs: [['quads'], ['glutes', 'hamstrings']], Core: [['abs'], ['obliques']],
  'Full body': [[], ['quads', 'glutes', 'hamstrings', 'lowerback']],
};
/** [main muscles, helper muscles] for an exercise. */
export function exMuscles(ex) {
  if (!ex) return [[], []];
  const m = (ex.muscles || []).filter(k => MUSCLES[k]), m2 = (ex.muscles2 || []).filter(k => MUSCLES[k] && !m.includes(k));
  if (m.length || m2.length) return [m, m2];
  return AREA_MUSCLES[ex.category] || [[], []];
}
export const muscleList = ks => ks.map(k => MUSCLES[k]).join(', ');

/** Sets per muscle. sets: [{ exercise_id, side }] (already filtered to the period). */
export function muscleSets(sets) {
  const out = {};
  for (const x of sets) {
    const [m, m2] = exMuscles(state.exById.get(x.exercise_id));
    const w = x.side === 'L' || x.side === 'R' ? 0.5 : 1;
    for (const k of m) out[k] = (out[k] || 0) + w;
    for (const k of m2) out[k] = (out[k] || 0) + w / 2;
  }
  return out;
}
/** Shade 0–4 for each muscle, relative to your most-trained muscle. */
export function levels(counts) {
  const max = Math.max(0, ...Object.values(counts));
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v > 0 ? Math.max(1, Math.ceil((v / max) * 4)) : 0]));
}
export const fmtSets = v => { const w = Math.floor(v + 1e-9), half = v - w >= 0.5 - 1e-9; return (w || !half ? String(w) : '') + (half ? '½' : ''); };
const setsText = v => `${fmtSets(v)} set${v === 1 ? '' : 's'}`;

/** Front + back figures side by side. Tapping a muscle calls onPick(muscle). */
export function bodyPair(counts, { width = 116, onPick, selected } = {}) {
  const lv = levels(counts);
  const titles = Object.fromEntries(Object.keys(MUSCLES).map(k => [k, `${MUSCLES[k]}: ${counts[k] ? setsText(counts[k]) : 'not trained'}`]));
  const box = h('div', { class: 'bodymaps' });
  box.innerHTML = ['front', 'back'].map(sd => `<figure>${bodySvg(sd, lv, titles, { width })}<figcaption>${sd === 'front' ? 'Front' : 'Back'}</figcaption></figure>`).join('');
  if (selected) box.querySelectorAll(`[data-m="${selected}"]`).forEach(e => e.classList.add('sel'));
  if (onPick) box.addEventListener('click', e => { const m = e.target.closest?.('[data-m]')?.dataset.m; if (m) onPick(m); });
  return box;
}
export const heatLegend = () => h('div', { class: 'mm-legend', 'aria-hidden': 'true' }, 'Less', [0, 1, 2, 3, 4].map(i => h('i', { class: 'hm' + i })), 'More');

/** The Home / friend-page card. sets: [{ exercise_id, side, at }] (at = when the workout started). */
export function muscleCard(sets, { title = 'Muscles trained' } = {}) {
  let days = 7, sel = null;
  const box = h('section', { class: 'card muscle-card' });
  const draw = () => {
    const since = Date.now() - days * 86400000;
    const counts = muscleSets(sets.filter(x => +new Date(x.at) >= since));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const any = top.length > 0;
    mount(box,
      h('div', { class: 'row between' }, h('strong', {}, title), h('span', { class: 'muted small' }, 'sets')),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Period' }, [7, 30, 90].map(d =>
        h('button', { class: d === days ? 'on' : '', 'aria-pressed': String(d === days), onclick: () => { days = d; draw(); } }, `${d} days`))),
      bodyPair(counts, { selected: sel, onPick: m => { sel = sel === m ? null : m; haptic(8); draw(); } }),
      sel ? h('div', { class: 'mm-tip', role: 'status' }, `${MUSCLES[sel]} · ${counts[sel] ? setsText(counts[sel]) : 'not trained'}`)
        : h('p', { class: 'muted small center mm-hint' }, any ? 'Tap a muscle to see its sets' : `No gym sets in the last ${days} days`),
      heatLegend(),
      any && h('div', { class: 'mm-top' }, top.map(([k, v]) => h('button', { class: 'mm-chip' + (k === sel ? ' on' : ''), onclick: () => { sel = sel === k ? null : k; draw(); } }, `${MUSCLES[k]} ${fmtSets(v)}`))));
  };
  draw();
  return box;
}

/** Small map for one workout (the "Workout saved" pop-up). */
export function workoutMuscles(sets) {
  const counts = muscleSets(sets);
  const main = Object.entries(counts).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 1).slice(0, 3).map(([k]) => MUSCLES[k]);
  if (!Object.keys(counts).length) return null;
  return h('div', { class: 'saved-muscles' }, bodyPair(counts, { width: 92 }),
    main.length > 0 && h('p', { class: 'muted small center' }, 'Mostly ' + main.join(', ').replace(/, ([^,]*)$/, ' and $1').toLowerCase()));
}

// ---------- picking muscles for your own exercise ------------------------------------------
/** Two chip groups: main muscles and helper muscles (½ set). f.muscles / f.muscles2 are edited in place. */
export function musclePicker(f) {
  const box = h('div', {});
  const draw = () => mount(box,
    h('div', { class: 'field' }, h('span', {}, 'Main muscles'),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Main muscles' }, Object.entries(MUSCLES).map(([k, n]) =>
        h('button', { type: 'button', class: 'chip' + (f.muscles.includes(k) ? ' on' : ''), 'aria-pressed': String(f.muscles.includes(k)), onclick: () => {
          f.muscles = f.muscles.includes(k) ? f.muscles.filter(x => x !== k) : [...f.muscles, k];
          f.muscles2 = f.muscles2.filter(x => x !== k); draw(); } }, n)))),
    h('div', { class: 'field' }, h('span', {}, 'Also works (counts as ½ a set)'),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Helper muscles' }, Object.entries(MUSCLES).filter(([k]) => !f.muscles.includes(k)).map(([k, n]) =>
        h('button', { type: 'button', class: 'chip' + (f.muscles2.includes(k) ? ' on' : ''), 'aria-pressed': String(f.muscles2.includes(k)), onclick: () => {
          f.muscles2 = f.muscles2.includes(k) ? f.muscles2.filter(x => x !== k) : [...f.muscles2, k]; draw(); } }, n)))));
  draw();
  box.redraw = draw;
  return box;
}
