// Help & guide screens, the "?" button target, and the one-time "What's new" card.
import * as api from './api.js';
import { state } from './store.js';
import { TOPICS, SECTIONS, CHANGELOG, topicForScreen } from './guide.js';
import { h, mount, sheet, fmtDay } from './ui.js';

const block = b => typeof b === 'string' ? h('p', {}, b)
  : b.steps ? h('ol', { class: 'guide-steps' }, b.steps.map(s => h('li', {}, s)))
  : b.tip ? h('p', { class: 'guide-tip' }, '💡 ', b.tip) : null;
const text = t => [t.title, t.keywords, ...t.body.map(b => typeof b === 'string' ? b : b.steps ? b.steps.join(' ') : b.tip || '')].join(' ').toLowerCase();

/** Where the ? button should go for the current screen. */
export function helpHref() {
  const screen = (location.hash || '#/').slice(2).split('/')[0];
  if (screen === 'help') return '#/help';
  const t = topicForScreen(screen);
  return t ? '#/help/' + t.id : '#/help';
}

export function renderHelp(root, id) {
  if (id === 'whats-new') return renderChangelog(root);
  const t = TOPICS.find(x => x.id === id);
  if (t) {
    const related = TOPICS.filter(x => x.section === t.section && x.id !== t.id);
    mount(root,
      h('a', { class: 'back', href: '#/help' }, '‹ All help'),
      h('p', { class: 'muted small' }, t.section),
      h('h1', {}, t.title),
      h('div', { class: 'guide-body' }, t.body.map(block)),
      related.length > 0 && [h('h2', {}, 'More on ' + t.section.toLowerCase()),
        h('div', { class: 'card list-card' }, related.map(r => h('a', { class: 'row between', href: '#/help/' + r.id }, h('span', {}, r.title), h('span', { class: 'muted' }, '›'))))]);
    return;
  }
  const list = h('div', {});
  const draw = q => {
    const ql = q.trim().toLowerCase();
    if (ql) {
      const words = ql.split(/\s+/);
      // best matches first: words in the title, then in keywords, then anywhere
      const score = t => words.reduce((n, w) => n + (t.title.toLowerCase().includes(w) ? 10 : 0) + (t.keywords.includes(w) ? 3 : 0), 0);
      const hits = TOPICS.filter(t => words.every(w => text(t).includes(w))).sort((a, b) => score(b) - score(a));
      mount(list, hits.length
        ? h('div', { class: 'card list-card' }, hits.map(t => h('a', { class: 'row between', href: '#/help/' + t.id },
            h('span', {}, t.title, h('br'), h('span', { class: 'muted small' }, t.section)), h('span', { class: 'muted' }, '›'))))
        : h('p', { class: 'muted' }, 'No matches. Try another word, or ask on the feedback board (Me → Feature requests & bug reports).'));
      return;
    }
    mount(list,
      h('a', { class: 'card row between whats-new-link', href: '#/help/whats-new' },
        h('span', {}, h('strong', {}, '✨ What’s new'), h('br'), h('span', { class: 'muted small' }, `You’re on v${window.APP_VERSION}`)), h('span', { class: 'muted' }, '›')),
      SECTIONS.map(s => {
        const ts = TOPICS.filter(t => t.section === s);
        return ts.length ? [h('h2', {}, s), h('div', { class: 'card list-card' },
          ts.map(t => h('a', { class: 'row between', href: '#/help/' + t.id }, h('span', {}, t.title), h('span', { class: 'muted' }, '›'))))] : null;
      }));
  };
  draw('');
  mount(root,
    h('h1', {}, 'Help & guide'),
    h('input', { type: 'search', placeholder: 'Search help (e.g. “rest timer”, “left right”)', 'aria-label': 'Search help', 'data-noautofocus': '1', oninput: e => draw(e.target.value) }),
    list);
}

function renderChangelog(root) {
  mount(root,
    h('a', { class: 'back', href: '#/help' }, '‹ All help'),
    h('h1', {}, 'What’s new'),
    CHANGELOG.map(c => h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, 'v' + c.version), h('span', { class: 'muted small' }, fmtDay(c.date + 'T12:00'))),
      h('ul', { class: 'guide-list' }, c.items.map(i => h('li', {}, i))))));
}

/** Show "What's new" once after an update (not to brand-new accounts). */
export function maybeShowWhatsNew() {
  const KEY = 'ft.seenVersion';
  const seen = api.LS.get(KEY);
  const v = window.APP_VERSION;
  if (seen === v) return;
  api.LS.set(KEY, v);
  const created = state.profile?.created_at ? new Date(state.profile.created_at) : null;
  const newAccount = !seen && created && Date.now() - created < 24 * 3600e3;
  if (newAccount) return;
  const entry = CHANGELOG.find(c => c.version === v);
  if (!entry) return;
  sheet(`What’s new in v${v}`, close => h('div', {},
    h('ul', { class: 'guide-list' }, entry.items.map(i => h('li', {}, i))),
    h('button', { class: 'btn primary block', onclick: close }, 'Got it'),
    h('a', { class: 'btn block ghost', href: '#/help/whats-new', onclick: close }, 'See all updates')));
}
