// Talks to Supabase's REST + Auth APIs directly with fetch (no SDK needed).
// Writes go through an offline "outbox" so workouts can be logged with no signal.

const CFG = window.APP_CONFIG || {};
const URL_BASE = (CFG.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = CFG.SUPABASE_KEY || '';

const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
export { LS };

export const configured = () => !!URL_BASE && !URL_BASE.includes('YOUR-PROJECT') && !!KEY && !KEY.includes('YOUR-');

// ---------- helpers --------------------------------------------------
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

class ApiError extends Error {
  constructor(message, status, network = false) { super(message); this.status = status; this.network = network; }
}
export { ApiError };

function errMessage(body, status) {
  if (!body) return `Request failed (${status})`;
  const m = body.msg || body.error_description || body.message || body.error || body.hint;
  if (/duplicate key.*username|profiles_username_lower/i.test(JSON.stringify(body))) return 'That username is taken.';
  if (/Database error saving new user/i.test(m || '')) return 'Could not create the account — the username may be taken.';
  return m || `Request failed (${status})`;
}

async function raw(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const h = { apikey: KEY, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (auth) {
    const tok = await accessToken();
    if (tok) h.Authorization = 'Bearer ' + tok;
  }
  let res;
  try {
    res = await fetch(URL_BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new ApiError('You appear to be offline.', 0, true);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    if (res.status === 401 && auth && session()) {
      // token may have expired early; try one refresh
      if (await refresh(true)) return raw(path, { method, body, headers, auth });
    }
    // Supabase's gateway can return 5xx/520s when the free project is paused.
    const net = res.status >= 500;
    throw new ApiError(errMessage(data, res.status), res.status, net);
  }
  return data;
}

// ---------- auth -----------------------------------------------------
const SKEY = 'ft.session';
let listeners = [];
export const onAuth = fn => listeners.push(fn);
const emit = () => listeners.forEach(fn => fn(session()));

export const session = () => LS.get(SKEY);
export const userId = () => session()?.user?.id || null;

function saveSession(d) {
  if (!d || !d.access_token) return false;
  LS.set(SKEY, {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    user: d.user ? { id: d.user.id, email: d.user.email } : session()?.user,
  });
  emit();
  return true;
}

let refreshing = null;
async function refresh(force = false) {
  const s = session();
  if (!s) return false;
  if (!force && s.expires_at - 60 > Date.now() / 1000) return true;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const d = await raw('/auth/v1/token?grant_type=refresh_token',
          { method: 'POST', body: { refresh_token: s.refresh_token }, auth: false });
        return saveSession(d);
      } catch (e) {
        if (!e.network) { LS.del(SKEY); emit(); } // refresh token rejected: signed out
        return false;
      } finally { setTimeout(() => (refreshing = null), 0); }
    })();
  }
  return refreshing;
}

async function accessToken() {
  const s = session();
  if (!s) return null;
  if (s.expires_at - 60 <= Date.now() / 1000) await refresh();
  return session()?.access_token || null;
}

export async function usernameAvailable(name) {
  return raw('/rest/v1/rpc/username_available', { method: 'POST', body: { name }, auth: false });
}

export async function signUp(email, password, username) {
  const d = await raw('/auth/v1/signup', { method: 'POST', auth: false,
    body: { email, password, data: { username } } });
  if (!saveSession(d)) {
    throw new ApiError('Account created, but Supabase is asking for email confirmation. ' +
      'Turn off "Confirm email" in Supabase (Authentication → Sign In / Providers → Email), then sign in.', 400);
  }
}

export async function signIn(email, password) {
  const d = await raw('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } });
  saveSession(d);
}

export async function signOut() {
  try { await raw('/auth/v1/logout', { method: 'POST' }); } catch {}
  LS.del(SKEY);
  Object.keys(localStorage).filter(k => k.startsWith('ft.') && k !== 'ft.theme').forEach(k => LS.del(k));
  emit();
}

export async function sendPasswordReset(email) {
  const redirect = location.href.split('#')[0];
  await raw('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', auth: false, body: { email } });
}

// The reset email link lands back here with tokens in the URL hash.
export function takeRecoveryFromUrl() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash.includes('access_token=')) return false;
  const p = new URLSearchParams(hash);
  saveSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'),
    expires_in: +p.get('expires_in') || 3600, user: { id: parseJwt(p.get('access_token')).sub } });
  history.replaceState(null, '', location.pathname + location.search + '#/me');
  return p.get('type') === 'recovery';
}
function parseJwt(t) { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; } }

export async function updatePassword(password) {
  await raw('/auth/v1/user', { method: 'PUT', body: { password } });
}

// ---------- reads (network first, cached fallback) --------------------
export async function get(path, { cache = true } = {}) {
  const key = 'ft.cache.' + path;
  try {
    const d = await raw('/rest/v1/' + path);
    if (cache) LS.set(key, d);
    return d;
  } catch (e) {
    if (e.network) { const c = LS.get(key); if (c != null) return c; }
    throw e;
  }
}
export const cached = path => LS.get('ft.cache.' + path);

export async function rpc(fn, args, opts = {}) {
  const key = 'ft.cache.rpc.' + fn + JSON.stringify(args);
  try {
    const d = await raw('/rest/v1/rpc/' + fn, { method: 'POST', body: args });
    if (opts.cache !== false) LS.set(key, d);
    return d;
  } catch (e) {
    if (e.network) { const c = LS.get(key); if (c != null) return c; }
    throw e;
  }
}

// Direct writes that must succeed now (friend requests, profile edits).
export const patch = (table, filter, values) =>
  raw(`/rest/v1/${table}?${filter}`, { method: 'PATCH', body: values, headers: { Prefer: 'return=minimal' } });
export const insertNow = (table, row) =>
  raw(`/rest/v1/${table}`, { method: 'POST', body: row, headers: { Prefer: 'return=representation' } });
/** Write many rows at once. mode: 'skip' keeps existing rows, 'overwrite' replaces them. */
export async function bulkUpsert(table, rows, mode = 'skip', onConflict) {
  const qs = onConflict ? '?on_conflict=' + onConflict : '';
  const prefer = (mode === 'overwrite' ? 'resolution=merge-duplicates' : 'resolution=ignore-duplicates') + ',return=minimal';
  for (let i = 0; i < rows.length; i += 500) {
    await raw(`/rest/v1/${table}${qs}`, { method: 'POST', body: rows.slice(i, i + 500), headers: { Prefer: prefer } });
  }
}
/** Read every matching row, a page at a time (Supabase returns at most 1000 per request). */
export async function getAll(path) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await raw(`/rest/v1/${path}${path.includes('?') ? '&' : '?'}limit=1000&offset=${offset}`);
    out.push(...page);
    if (page.length < 1000) return out;
  }
}
export const removeNow = (table, filter) =>
  raw(`/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

// ---------- queued writes (offline-safe) -----------------------------
const OKEY = 'ft.outbox';
const outbox = () => LS.get(OKEY, []);
let syncListeners = [];
export const onSync = fn => syncListeners.push(fn);
const syncEmit = (extra = {}) => syncListeners.forEach(fn => fn({ pending: outbox().length, ...extra }));
export const pendingCount = () => outbox().length;

/** Insert-or-update a row by primary key. */
export function upsert(table, row, onConflict) {
  enqueue({ op: 'upsert', table, row, onConflict });
}
/** Delete rows matching a PostgREST filter, e.g. "id=eq.123". */
export function remove(table, filter) {
  enqueue({ op: 'delete', table, filter });
}
function enqueue(item) {
  const q = outbox();
  // collapse repeated upserts of the same row so the queue stays small offline
  if (item.op === 'upsert' && item.row.id) {
    const i = q.findIndex(x => x.op === 'upsert' && x.table === item.table && x.row.id === item.row.id);
    if (i >= 0 && !(flushing && i === 0)) { q[i].row = { ...q[i].row, ...item.row }; LS.set(OKEY, q); syncEmit(); return flush(); }
  }
  q.push(item);
  LS.set(OKEY, q);
  syncEmit();
  flush();
}

let flushing = false;
export async function flush() {
  if (flushing || !session()) return;
  flushing = true;
  try {
    while (outbox().length) {
      const [item] = outbox();
      try {
        if (item.op === 'upsert') {
          const qs = item.onConflict ? '?on_conflict=' + item.onConflict : '';
          await raw(`/rest/v1/${item.table}${qs}`, { method: 'POST', body: item.row,
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
        } else {
          await raw(`/rest/v1/${item.table}?${item.filter}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        }
      } catch (e) {
        if (e.network || e.status === 401) { syncEmit({ offline: true }); return; } // try again later
        console.warn('Dropped a change the server rejected:', item, e.message);
        syncEmit({ error: e.message });
      }
      const q = outbox(); q.shift(); LS.set(OKEY, q);
      syncEmit();
    }
  } finally { flushing = false; }
}

window.addEventListener('online', flush);
setInterval(flush, 30000);
