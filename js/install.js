// "Add to Home Screen": works out what kind of phone this is, shows the right steps,
// offers a one-tap Install button where the browser allows it (Android Chrome / desktop Chrome & Edge),
// and nudges browser users once to install.
import { h, mount, sheet, ic, logoMark, toast } from './ui.js';

// ---------- where are we? ----------------------------------------------------
const ua = navigator.userAgent || '';
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const platform = () => (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) ? 'ios' : /Android/.test(ua) ? 'android' : 'other';
const iosOtherBrowser = () => /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

// The browser's own install prompt (Chrome/Edge/Samsung). It fires once, early, so catch it straight away.
let deferred = null, justInstalled = false;
const listeners = new Set();
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; listeners.forEach(f => f()); });
window.addEventListener('appinstalled', () => { deferred = null; markNudged(); listeners.forEach(f => f()); });
export const canPromptInstall = () => !!deferred;
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred; deferred = null;
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  justInstalled = choice?.outcome === 'accepted';
  listeners.forEach(f => f());
  return justInstalled;
}

// ---------- the steps, for the tour card and the help sheet --------------------
const shareIcon = () => h('span', { class: 'inline-ico' }, ic('share', 16));
const kebab = () => h('span', { class: 'inline-ico' }, ic('kebab', 16));

/** Title + picture + steps for this phone. Returns { title, art, body } elements (body can include an Install button). */
export function installContent() {
  const p = platform();
  if (isStandalone()) return {
    title: 'You’re all set',
    art: h('div', { class: 'tour-installed' }, logoMark(72), h('span', { class: 'tour-tick' }, ic('check', 22))),
    body: h('p', {}, 'You’re using Fitness Tracker from your Home Screen, so it opens full-screen like a normal app and works without signal.'),
  };
  if (p === 'ios') return {
    title: 'Add it to your Home Screen',
    art: h('div', { class: 'tour-share' },
      h('div', { class: 'tour-share-bar' }, h('span', {}, ic('back', 18)), h('span', { class: 'hi' }, ic('share', 20)), h('span', {}, ic('calendar', 18))),
      h('div', { class: 'tour-share-sheet' },
        h('div', {}, h('span', {}, 'Copy'), ic('edit', 16)),
        h('div', { class: 'hi' }, h('span', {}, 'Add to Home Screen'), ic('plus', 16)),
        h('div', {}, h('span', {}, 'Add Bookmark'), ic('medal', 16)))),
    body: h('ol', { class: 'tour-steps' },
      h('li', {}, 'Tap the Share button ', shareIcon(), iosOtherBrowser() ? ' (top right, next to the address bar).' : ' at the bottom of Safari.'),
      h('li', {}, 'Scroll down and tap ', h('b', {}, 'Add to Home Screen'), '.'),
      h('li', {}, 'Tap ', h('b', {}, 'Add'), ', then open Fitness Tracker from your Home Screen.')),
  };
  const btn = h('button', { class: 'btn primary block install-btn', onclick: async () => {
    if (await promptInstall()) toast('Installed — find Fitness Tracker on your Home Screen');
  } }, ic('plus', 18), 'Install app');
  const manual = p === 'android'
    ? h('ol', { class: 'tour-steps' },
        h('li', {}, 'Tap the menu ', kebab(), ' at the top right of Chrome.'),
        h('li', {}, 'Tap ', h('b', {}, 'Install app'), ' (or ', h('b', {}, 'Add to Home screen'), ').'),
        h('li', {}, 'Tap ', h('b', {}, 'Install'), ', then open Fitness Tracker from your Home Screen.'))
    : h('p', {}, 'On your phone, open ', h('b', {}, location.host + location.pathname.replace(/\/$/, '')), ' and add it to your Home Screen. On a computer, Chrome and Edge can install it from the icon in the address bar.');
  const body = h('div', {});
  const paint = () => mount(body, justInstalled
    ? h('p', { class: 'install-done' }, ic('check', 18), 'Installed — open it from your Home Screen')
    : canPromptInstall()
    ? [h('p', {}, 'Put Fitness Tracker on your Home Screen so it opens full-screen like a normal app and works without signal.'), btn]
    : manual);
  listeners.add(paint);
  paint();
  return {
    title: 'Add it to your Home Screen',
    art: h('div', { class: 'tour-android' },
      h('div', { class: 'tour-share-bar' }, h('span', { class: 'url' }, 'fitness-tracker'), h('span', { class: 'hi' }, ic('kebab', 20))),
      h('div', { class: 'tour-share-sheet' },
        h('div', {}, h('span', {}, 'New tab'), ic('plus', 16)),
        h('div', { class: 'hi' }, h('span', {}, 'Install app'), ic('home', 16)),
        h('div', {}, h('span', {}, 'Share…'), ic('share', 16)))),
    body,
  };
}

/** The same steps in a bottom sheet (from the nudge banner or Help). */
export function installSheet() {
  const c = installContent();
  sheet(c.title, close => h('div', { class: 'install-sheet' }, h('div', { class: 'tour-art small', 'aria-hidden': 'true' }, c.art), c.body,
    h('button', { class: 'btn ghost block', onclick: close }, 'Close')));
}

// ---------- one-time nudge for people still in the browser ------------------------
const NKEY = 'ft.installNudge';
export const markNudged = () => { try { localStorage.setItem(NKEY, 'done'); } catch {} };
const nudged = () => { try { return localStorage.getItem(NKEY) === 'done'; } catch { return true; } };

/** Show a small dismissible banner once, on phones, when the app isn't installed. */
export function maybeNudgeInstall(bar) {
  if (!bar || nudged() || isStandalone() || platform() === 'other' || document.querySelector('.tour')) return;
  const done = () => { markNudged(); bar.hidden = true; };
  mount(bar,
    h('button', { class: 'install-nudge-main', onclick: () => { done(); installSheet(); } },
      h('span', { class: 'list-ico accent' }, ic('plus', 18)),
      h('span', { class: 'grow' }, h('strong', {}, 'Add Fitness Tracker to your Home Screen'), h('br'), h('span', { class: 'muted small' }, 'Full-screen, one tap to open, works offline. Show me how'))),
    h('button', { class: 'icon-btn', 'aria-label': 'Dismiss', onclick: done }, ic('close', 18)));
  bar.hidden = false;
}
