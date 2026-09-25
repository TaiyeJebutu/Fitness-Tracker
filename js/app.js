import * as api from './api.js';
import { state, loadProfile, loadExercises, loadFriends, loadRoutines } from './store.js';
import { h, mount, toast, setUnits, getUnits } from './ui.js';
import { renderWorkout, active, tickRest } from './workout.js';
import { renderTrain, renderHistory, renderWorkoutDetail, renderRoutine, renderExercise } from './train.js';
import { renderFeed, renderFriend, renderRanks } from './social.js';
import { renderBody } from './body.js';
import { exportData, importData } from './backup.js';

const app = document.getElementById('app');
const view = h('main', { id: 'view', tabindex: '-1' });
const restbar = h('div', { id: 'restbar', class: 'restbar', hidden: true });
const syncDot = h('span', { class: 'sync', title: '' });

const NAV = [['#/', 'Train', '🏋️'], ['#/feed', 'Friends', '👥'], ['#/ranks', 'Ranks', '🏆'], ['#/body', 'Body', '📏'], ['#/me', 'Me', '⚙️']];
const nav = h('nav', { class: 'tabbar', 'aria-label': 'Main' },
  NAV.map(([href, label, icon]) => h('a', { href, 'data-tab': href }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon), h('span', {}, label))));

// ---------- router -------------------------------------------------------
async function route() {
  if (!api.configured()) return renderSetupNeeded();
  if (!api.session()) return renderAuth();
  if (!app.contains(view)) mount(app, h('header', { class: 'topbar' }, h('span', { class: 'brand' }, 'Fitness Tracker'), syncDot), restbar, view, nav);
  const [, a = '', b] = (location.hash || '#/').slice(1).split('/');
  nav.querySelectorAll('a').forEach(x => {
    const t = x.dataset.tab.slice(2);
    x.classList.toggle('on', t === a || (t === '' && ['', 'workout', 'routine', 'history', 'exercise'].includes(a)) || (t === 'feed' && ['friends', 'friend'].includes(a)));
  });
  nav.querySelector('a[data-tab="#/"] span:last-child').textContent = active() ? 'Workout' : 'Train';
  window.scrollTo(0, 0);
  // close pop-ups that belong to a different screen (e.g. after pressing Back)
  document.querySelectorAll('.sheet-wrap').forEach(x => x.dataset.screen !== (location.hash || '#/') && x.remove());
  // each visit gets a fresh container, so a slow screen that finishes loading late can't draw over the current one
  const page = h('div', { class: 'page' });
  mount(view, page);
  try {
    switch (a) {
      case '': return await renderTrain(page);
      case 'workout': return renderWorkout(page);
      case 'routine': return await renderRoutine(page, b);
      case 'history': return b ? await renderWorkoutDetail(page, b) : await renderHistory(page);
      case 'exercise': return await renderExercise(page, b);
      case 'feed': return await renderFeed(page, 'feed');
      case 'friends': return await renderFeed(page, 'friends');
      case 'friend': return await renderFriend(page, b);
      case 'ranks': return await renderRanks(page, b);
      case 'body': return await renderBody(page, b);
      case 'me': return renderMe(page);
      default: location.hash = '#/';
    }
  } catch (e) {
    console.error(e);
    mount(page, h('p', { class: 'muted' }, 'Something went wrong: ' + e.message));
  }
}

// ---------- first-run: not configured -----------------------------------
function renderSetupNeeded() {
  mount(app, h('main', { class: 'auth' },
    h('h1', {}, 'Almost there'),
    h('p', {}, 'This app isn’t connected to a database yet. Open js/config.js and paste in your Supabase Project URL and publishable key — see the setup guide (README) step 3.')));
}

// ---------- sign in / sign up -------------------------------------------
function renderAuth(mode = 'in') {
  const f = { email: '', password: '', username: '' };
  const err = h('p', { class: 'error', role: 'alert' });
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, mode === 'in' ? 'Sign in' : 'Create account');
  const submit = async e => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true;
    try {
      if (mode === 'up') {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(f.username)) throw new Error('Username: 3–20 letters, numbers or _');
        if (f.password.length < 8) throw new Error('Password must be at least 8 characters');
        if (!(await api.usernameAvailable(f.username))) throw new Error('That username is taken');
        await api.signUp(f.email.trim(), f.password, f.username);
      } else if (mode === 'reset') {
        await api.sendPasswordReset(f.email.trim());
        toast('If that email has an account, a reset link is on its way.');
        return renderAuth('in');
      } else {
        await api.signIn(f.email.trim(), f.password);
      }
      await boot();
    } catch (x) { err.textContent = x.message; }
    finally { btn.disabled = false; }
  };
  const input = (label, key, type, extra = {}) => h('label', { class: 'field' }, h('span', {}, label),
    h('input', { type, required: true, oninput: e => (f[key] = e.target.value), ...extra }));
  mount(app, h('main', { class: 'auth' },
    h('div', { class: 'logo', 'aria-hidden': 'true' }, '🏋️'),
    h('h1', {}, mode === 'up' ? 'Create your account' : mode === 'reset' ? 'Reset password' : 'Fitness Tracker'),
    h('form', { onsubmit: submit },
      mode === 'up' && input('Username (friends find you by this)', 'username', 'text', { autocapitalize: 'off', autocomplete: 'username', maxlength: 20 }),
      input('Email', 'email', 'email', { autocomplete: 'email', 'data-noautofocus': '1' }),
      mode !== 'reset' && input('Password', 'password', 'password', { autocomplete: mode === 'up' ? 'new-password' : 'current-password', minlength: mode === 'up' ? 8 : null }),
      err, btn),
    mode === 'in' && [
      h('button', { class: 'btn ghost block', onclick: () => renderAuth('up') }, 'New here? Create an account'),
      h('button', { class: 'link', onclick: () => renderAuth('reset') }, 'Forgot password?')],
    mode !== 'in' && h('button', { class: 'btn ghost block', onclick: () => renderAuth('in') }, 'Back to sign in')));
}

// ---------- Me / settings ----------------------------------------------
function renderMe(root) {
  const p = state.profile || {};
  let uname = p.username || '';
  const setUnitsTo = async u => {
    try { await api.patch('profiles', 'id=eq.' + api.userId(), { units: u }); state.profile.units = u; setUnits(u); toast('Units updated'); renderMe(root); }
    catch (e) { toast(e.message, 'err'); }
  };
  const pending = api.pendingCount();
  mount(root,
    h('h1', {}, 'Me'),
    h('section', { class: 'card' },
      h('p', {}, h('strong', {}, '@' + (p.username || '…')), h('br'), h('span', { class: 'muted small' }, api.session()?.user?.email || '')),
      h('form', { class: 'row gap', onsubmit: async e => {
        e.preventDefault();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(uname)) return toast('3–20 letters, numbers or _', 'err');
        try { await api.patch('profiles', 'id=eq.' + api.userId(), { username: uname }); state.profile.username = uname; toast('Username changed'); renderMe(root); }
        catch (x) { toast(x.message, 'err'); } } },
        h('input', { value: uname, 'aria-label': 'Username', autocapitalize: 'off', 'data-noautofocus': '1', oninput: e => (uname = e.target.value) }),
        h('button', { class: 'btn', type: 'submit' }, 'Rename'))),
    h('section', { class: 'card' },
      h('strong', {}, 'Units'),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Units' },
        h('button', { class: getUnits() === 'metric' ? 'on' : '', 'aria-pressed': String(getUnits() === 'metric'), onclick: () => setUnitsTo('metric') }, 'kg / cm'),
        h('button', { class: getUnits() === 'imperial' ? 'on' : '', 'aria-pressed': String(getUnits() === 'imperial'), onclick: () => setUnitsTo('imperial') }, 'lb / in'))),
    h('section', { class: 'card' },
      h('a', { class: 'row between', href: '#/history' }, h('span', {}, 'Workout history'), h('span', { class: 'muted' }, '›'))),
    h('section', { class: 'card' },
      h('strong', {}, 'Sync'),
      h('p', { class: 'muted small' }, pending ? `${pending} change${pending > 1 ? 's' : ''} waiting to upload. They’ll send automatically when you’re online.` : 'Everything is saved to the server.'),
      pending > 0 && h('button', { class: 'btn small', onclick: async () => { await api.flush(); renderMe(root); } }, 'Try now')),
    h('section', { class: 'card' },
      h('strong', {}, 'Change password'),
      h('form', { class: 'row gap', onsubmit: async e => {
        e.preventDefault(); const pw = e.target.pw.value;
        if (pw.length < 8) return toast('At least 8 characters', 'err');
        try { await api.updatePassword(pw); e.target.reset(); toast('Password changed'); } catch (x) { toast(x.message, 'err'); } } },
        h('input', { name: 'pw', type: 'password', autocomplete: 'new-password', placeholder: 'New password', 'aria-label': 'New password', 'data-noautofocus': '1' }),
        h('button', { class: 'btn', type: 'submit' }, 'Save'))),
    h('section', { class: 'card' },
      h('strong', {}, 'Backup'),
      h('p', { class: 'muted small' }, 'Download all your workouts, routines, body stats and exercise settings as a file, or restore from one.'),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn small', onclick: exportData }, 'Export my data'),
        h('button', { class: 'btn small', onclick: importData }, 'Import a backup'))),
    h('section', { class: 'card muted small' },
      h('p', {}, 'Add to home screen: on iPhone tap Share → “Add to Home Screen”; on Android tap ⋮ → “Install app”.')),
    h('button', { class: 'btn danger ghost block', onclick: async () => {
      if (api.pendingCount() && !confirm('Some changes haven’t uploaded yet and will be lost. Sign out anyway?')) return;
      await api.signOut(); } }, 'Sign out'));
}

// ---------- sync indicator ----------------------------------------------
api.onSync(({ pending, offline, error }) => {
  syncDot.className = 'sync' + (pending ? (offline ? ' off' : ' busy') : '');
  syncDot.textContent = pending ? (offline ? `Offline · ${pending} to sync` : 'Syncing…') : '';
  if (error) toast('A change couldn’t be saved: ' + error, 'err');
});

// ---------- boot ---------------------------------------------------------
async function boot() {
  if (!api.configured() || !api.session()) return route();
  setUnits(state.profile?.units);
  mount(app, h('header', { class: 'topbar' }, h('span', { class: 'brand' }, 'Fitness Tracker'), syncDot), restbar, view, nav);
  await Promise.all([loadProfile().catch(() => {}), loadExercises().catch(() => {})]);
  loadRoutines().catch(() => {}); loadFriends().catch(() => {});
  api.flush();
  route();
  tickRest();
}

api.onAuth(s => { if (!s) { state.profile = null; renderAuth(); } });
window.addEventListener('hashchange', route);

if (api.configured() && api.takeRecoveryFromUrl()) {
  boot().then(() => toast('Signed in — set a new password under “Change password”.'));
} else boot();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
