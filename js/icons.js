// Fitness Tracker icon set — original line icons on a 24×24 grid, 1.75px strokes, round caps/joins.
// Use: icon('home') returns an <svg> string that inherits currentColor.
const P = {
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  train: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  friends: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.8" cy="9.3" r="2.5"/><path d="M15.5 14.3c2.6-.3 4.5 1.3 5 4.2"/>',
  ranks: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1.5A3 3 0 0 0 8 10.4M16 6h3v1.5a3 3 0 0 1-3 2.9M12 13v3.5M8.5 20h7M10 16.5h4l.5 3.5h-5z"/>',
  me: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1-3.8 3.9-5.8 7.5-5.8s6.5 2 7.5 5.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M10 3.5h4M18.5 6.5l1.5-1.5"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  back: '<path d="m14.5 6-6 6 6 6"/>',
  flame: '<path d="M12 20.5c3.6 0 6-2.5 6-5.9 0-3.6-2.6-5.4-3.3-8.6-.2-.9-1.3-1.1-1.8-.4C11.7 7.4 11.6 9.5 12.2 11c-1.4-.4-2.3-1.6-2.5-2.9-.1-.6-.9-.8-1.2-.3C7.2 9.4 6 11.4 6 14.6c0 3.4 2.4 5.9 6 5.9z"/>',
  chart: '<path d="M4 20h16M7 16.5V11M12 16.5V6M17 16.5v-4"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 9.5a5 5 0 0 1 7 0L13 12"/>',
  medal: '<circle cx="12" cy="14.5" r="5"/><path d="M9 10 6.5 4h4L12 7.5 13.5 4h4L15 10M12 12.5v4"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.6a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.5v.6"/><circle cx="12" cy="16.9" r=".6" fill="currentColor"/>',
  more: '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  play: '<path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.8-6.2a.8.8 0 0 0 0-1.4L9.2 5.1a.8.8 0 0 0-1.2.7z"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  heart: '<path d="M12 19.5s-7.5-4.4-7.5-9.8A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 9.8-7.5 9.8z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  edit: '<path d="M4.5 19.5 5.3 15.6 15.7 5.2a2 2 0 0 1 2.9 0l.2.2a2 2 0 0 1 0 2.9L8.4 18.7z"/><path d="m13.8 7.1 3.1 3.1"/>',
  trash: '<path d="M5 7h14M10 4h4M7 7l.8 11.2a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8L17 7"/>',
  run: '<circle cx="15" cy="4.8" r="1.9"/><path d="M8.5 9.2 11.8 7.6l3 2.3 2.4.6M11.8 7.6l-1.6 5.7 3.2 2.6-.9 4.6M10.2 13.3l-2.4 3.1H4.8"/>',
  swim: '<circle cx="16.5" cy="6.8" r="1.9"/><path d="M4 13c2.3-2.6 5-4 8-4l2.4 2.8M3 17.5c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"/>',
  pulse: '<path d="M3 12h4l2.5-6 5 12 2.5-6H21"/>',
  sync: '<path d="M19 12a7 7 0 0 1-12.5 4.3M5 12a7 7 0 0 1 12.5-4.3M17.5 4v3.7h-3.7M6.5 20v-3.7h3.7"/>',
};
export const ICON_NAMES = Object.keys(P);
export function icon(name, size = 24, extra = '') {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || ''}</svg>`;
}
