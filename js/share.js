// "Share the app": the phone's share sheet, a copy button, and a QR code for friends standing next to you.
import { state } from './store.js';
import { h, sheet, toast, ic, haptic } from './ui.js';
import { qrSvg } from './qr.js';

/** The app's address (without any #/screen part). */
export const appUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
const message = () => {
  const u = state.profile?.username;
  return u ? `I’m tracking my training on Fitness Tracker — a free app. Join me and add me as a friend: @${u}`
    : 'Try Fitness Tracker — a free app for tracking your training with friends.';
};
const fullText = () => `${message()}\n${appUrl()}`;

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {   // older browsers
    const t = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch { return false; }
}

export function shareSheet() {
  sheet('Share the app', close => {
    const canShare = typeof navigator.share === 'function';
    const qr = h('div', { class: 'qr-box' });
    qr.innerHTML = qrSvg(appUrl(), 200);
    return h('div', { class: 'share-sheet' },
      h('p', { class: 'muted small' }, 'Invite friends to train with you. It’s free for them too.'),
      qr,
      h('p', { class: 'muted small center' }, 'Friend next to you? They can scan this with their phone camera.'),
      h('div', { class: 'share-msg' }, message(), h('br'), h('span', { class: 'share-url' }, appUrl())),
      canShare && h('button', { class: 'btn primary block', onclick: async () => {
        try { await navigator.share({ title: 'Fitness Tracker', text: message(), url: appUrl() }); haptic(); close(); }
        catch (e) { if (e?.name !== 'AbortError') toast('Couldn’t open sharing — use Copy instead', 'err'); }
      } }, ic('share', 18), 'Share…'),
      h('button', { class: 'btn block' + (canShare ? '' : ' primary'), onclick: async () => {
        const ok = await copy(fullText());
        toast(ok ? 'Copied — paste it into a message' : 'Couldn’t copy — long-press the text above instead', ok ? '' : 'err');
      } }, ic('copy', 18), 'Copy link & message'));
  });
}
