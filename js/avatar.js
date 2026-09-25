// Avatars: an icon on a coloured circle, chosen by each person and visible to friends.
import * as api from './api.js';
import { state } from './store.js';
import { h, mount, sheet, toast } from './ui.js';
import { ART, ART_GROUPS } from './avatar-art.js';

export const ICONS = {
  dumbbell: '🏋️', muscle: '💪', flame: '🔥', bolt: '⚡', runner: '🏃', cyclist: '🚴', climber: '🧗', swimmer: '🏊',
  gymnast: '🤸', boxing: '🥊', yoga: '🧘', mountain: '⛰️', wave: '🌊', tree: '🌲', lion: '🦁', tiger: '🐯',
  bear: '🐻', wolf: '🐺', eagle: '🦅', shark: '🦈', dragon: '🐉', gorilla: '🦍', bull: '🐂', rhino: '🦏',
  turtle: '🐢', rabbit: '🐇', trophy: '🏆', star: '⭐', target: '🎯', rocket: '🚀', crown: '👑', skull: '💀',
};
export const COLORS = ['#2f5fe0', '#0f8b8d', '#1f8a3b', '#7c3aed', '#d6336c', '#d9352b', '#e8590c', '#b88400', '#475569', '#111827'];

/** Small round avatar. `p` is a profile-like object ({avatar_icon, avatar_color, username}). */
export function avatar(p, size = 32) {
  const color = /^#[0-9a-fA-F]{6}$/.test(p?.avatar_color || '') ? p.avatar_color : COLORS[0];
  const el = h('span', { class: 'avatar', 'aria-hidden': 'true',
    style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.55) + 'px', background: color } });
  const art = ART[p?.avatar_icon];
  if (art) { el.classList.add('art'); el.innerHTML = art.svg; }   // our own static drawings, never user content
  else el.textContent = ICONS[p?.avatar_icon] || ICONS.dumbbell;
  return el;
}
const known = k => !!(ART[k] || ICONS[k]);

/** Look up someone's profile (me or a friend) by id for places that only have an id. */
export function profileById(id) {
  if (id === api.userId()) return state.profile;
  return state.friends.find(f => f.id === id) || null;
}

export function editAvatar(onSaved) {
  const p = state.profile || {};
  let icon = known(p.avatar_icon) ? p.avatar_icon : 'a_fox';
  let color = COLORS.includes(p.avatar_color) ? p.avatar_color : COLORS[0];
  sheet('Your avatar', close => {
    const preview = h('div', { class: 'avatar-preview' });
    const icons = h('div', { role: 'radiogroup', 'aria-label': 'Avatar' });
    const colors = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Background colour' });
    const draw = () => {
      mount(preview, avatar({ avatar_icon: icon, avatar_color: color }, 72), h('span', { class: 'muted small' }, 'Friends see this next to your name'));
      const pick = (k, label, content) => h('button', { class: 'icon-pick' + (k === icon ? ' on' : ''), role: 'radio',
        'aria-checked': String(k === icon), 'aria-label': label, title: label, onclick: () => { icon = k; draw(); } }, content);
      mount(icons,
        ART_GROUPS.map(([group, list]) => [h('h3', { class: 'pick-head' }, group),
          h('div', { class: 'icon-grid' }, Object.keys(list).map(k => {
            const el = pick('a_' + k, ART['a_' + k].name); el.classList.add('art');
            const a = avatar({ avatar_icon: 'a_' + k, avatar_color: color }, 44); el.append(a); return el; }))]),
        h('h3', { class: 'pick-head' }, 'Emoji'),
        h('div', { class: 'icon-grid' }, Object.entries(ICONS).map(([k, e]) => pick(k, k, e))));
      mount(colors, COLORS.map(c => h('button', { class: 'swatch' + (c === color ? ' on' : ''), role: 'radio', 'aria-checked': String(c === color),
        'aria-label': 'Colour ' + c, style: { background: c }, onclick: () => { color = c; draw(); } })));
    };
    draw();
    return h('div', {}, preview, h('h3', { class: 'pick-head' }, 'Background colour'), colors, icons,
      h('button', { class: 'btn primary block', onclick: async () => {
        try {
          await api.patch('profiles', 'id=eq.' + api.userId(), { avatar_icon: icon, avatar_color: color });
          state.profile.avatar_icon = icon; state.profile.avatar_color = color;
          toast('Avatar saved'); close(); onSaved?.();
        } catch (e) { toast(e.message, 'err'); }
      } }, 'Save'));
  });
}
