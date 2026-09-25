// Avatars: an icon on a coloured circle, chosen by each person and visible to friends.
import * as api from './api.js';
import { state } from './store.js';
import { h, mount, sheet, toast } from './ui.js';

export const ICONS = {
  dumbbell: '🏋️', muscle: '💪', flame: '🔥', bolt: '⚡', runner: '🏃', cyclist: '🚴', climber: '🧗', swimmer: '🏊',
  gymnast: '🤸', boxing: '🥊', yoga: '🧘', mountain: '⛰️', wave: '🌊', tree: '🌲', lion: '🦁', tiger: '🐯',
  bear: '🐻', wolf: '🐺', eagle: '🦅', shark: '🦈', dragon: '🐉', gorilla: '🦍', bull: '🐂', rhino: '🦏',
  turtle: '🐢', rabbit: '🐇', trophy: '🏆', star: '⭐', target: '🎯', rocket: '🚀', crown: '👑', skull: '💀',
};
export const COLORS = ['#2f5fe0', '#0f8b8d', '#1f8a3b', '#7c3aed', '#d6336c', '#d9352b', '#e8590c', '#b88400', '#475569', '#111827'];

/** Small round avatar. `p` is a profile-like object ({avatar_icon, avatar_color, username}). */
export function avatar(p, size = 32) {
  const icon = ICONS[p?.avatar_icon] || ICONS.dumbbell;
  const color = /^#[0-9a-fA-F]{6}$/.test(p?.avatar_color || '') ? p.avatar_color : COLORS[0];
  return h('span', { class: 'avatar', 'aria-hidden': 'true',
    style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.55) + 'px', background: color } }, icon);
}

/** Look up someone's profile (me or a friend) by id for places that only have an id. */
export function profileById(id) {
  if (id === api.userId()) return state.profile;
  return state.friends.find(f => f.id === id) || null;
}

export function editAvatar(onSaved) {
  const p = state.profile || {};
  let icon = ICONS[p.avatar_icon] ? p.avatar_icon : 'dumbbell';
  let color = COLORS.includes(p.avatar_color) ? p.avatar_color : COLORS[0];
  sheet('Your avatar', close => {
    const preview = h('div', { class: 'avatar-preview' });
    const icons = h('div', { class: 'icon-grid', role: 'radiogroup', 'aria-label': 'Icon' });
    const colors = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Background colour' });
    const draw = () => {
      mount(preview, avatar({ avatar_icon: icon, avatar_color: color }, 72), h('span', { class: 'muted small' }, 'Friends see this next to your name'));
      mount(icons, Object.entries(ICONS).map(([k, e]) => h('button', { class: 'icon-pick' + (k === icon ? ' on' : ''), role: 'radio',
        'aria-checked': String(k === icon), 'aria-label': k, onclick: () => { icon = k; draw(); } }, e)));
      mount(colors, COLORS.map(c => h('button', { class: 'swatch' + (c === color ? ' on' : ''), role: 'radio', 'aria-checked': String(c === color),
        'aria-label': 'Colour ' + c, style: { background: c }, onclick: () => { color = c; draw(); } })));
    };
    draw();
    return h('div', {}, preview, icons, colors,
      h('button', { class: 'btn primary block', onclick: async () => {
        try {
          await api.patch('profiles', 'id=eq.' + api.userId(), { avatar_icon: icon, avatar_color: color });
          state.profile.avatar_icon = icon; state.profile.avatar_color = color;
          toast('Avatar saved'); close(); onSaved?.();
        } catch (e) { toast(e.message, 'err'); }
      } }, 'Save'));
  });
}
