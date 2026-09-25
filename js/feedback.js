// Shared board for feature requests and bug reports. Everyone signed in can read, post, upvote and
// comment; the app owner (see app_admins in the SQL) sets each post's status.
import * as api from './api.js';
import { avatar } from './avatar.js';
import { h, mount, toast, sheet, confirmSheet, spinner, ago, fmtDay } from './ui.js';

const STATUS = {
  open: ['Open', 'st-open'], planned: ['Planned', 'st-planned'], in_progress: ['In progress', 'st-progress'],
  done: ['Done', 'st-done'], wont_do: ['Won’t do', 'st-wont'],
};
const KIND = { feature: ['💡', 'Feature request'], bug: ['🐞', 'Bug report'] };
const AUTHOR = 'author_profile:profiles!feedback_posts_author_fkey(username,avatar_icon,avatar_color)';
const statusTag = s => h('span', { class: 'tag ' + (STATUS[s]?.[1] || '') }, STATUS[s]?.[0] || s);
const kindTag = k => h('span', { class: 'tag kind' }, `${KIND[k][0]} ${k === 'bug' ? 'Bug' : 'Feature'}`);

let admins = null;
async function loadAdmins() {
  if (!admins) admins = new Set((await api.get('app_admins?select=user_id').catch(() => [])).map(a => a.user_id));
  return admins;
}
const amOwner = () => admins?.has(api.userId());

function device() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Other';
  const br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone ? ' · installed app' : '';
  return `${os} · ${br}${app} · ${innerWidth}×${innerHeight}`;
}

async function toggleVote(post, btn) {
  const me = api.userId();
  const on = !post.mine;
  post.mine = on; post.votes += on ? 1 : -1; paintVote(btn, post);
  try {
    if (on) await api.insertNow('feedback_votes', { post_id: post.id, user_id: me });
    else await api.removeNow('feedback_votes', `post_id=eq.${post.id}&user_id=eq.${me}`);
  } catch (e) { post.mine = !on; post.votes += on ? -1 : 1; paintVote(btn, post); toast(e.message, 'err'); }
}
function paintVote(btn, post) {
  btn.classList.toggle('on', post.mine);
  btn.setAttribute('aria-pressed', String(post.mine));
  btn.setAttribute('aria-label', `${post.mine ? 'Remove upvote' : 'Upvote'} (${post.votes})`);
  mount(btn, h('span', { 'aria-hidden': 'true' }, '▲'), h('strong', {}, post.votes));
}
const voteButton = post => { const b = h('button', { class: 'vote', onclick: e => { e.preventDefault(); e.stopPropagation(); toggleVote(post, b); } }); paintVote(b, post); return b; };

// ---------- board -----------------------------------------------------------
const VIEW_KEY = 'ft.fbView';
export async function renderFeedback(root) {
  const v = { kind: 'all', sort: 'top', show: 'active', ...api.LS.get(VIEW_KEY, {}) };
  const listEl = h('div', {}, spinner());
  const seg = (key, opts, label) => h('div', { class: 'seg', role: 'group', 'aria-label': label },
    opts.map(([k, l]) => h('button', { class: v[key] === k ? 'on' : '', 'aria-pressed': String(v[key] === k),
      onclick: () => { v[key] = k; api.LS.set(VIEW_KEY, v); renderFeedback(root); } }, l)));
  mount(root,
    h('a', { class: 'back', href: '#/me' }, '‹ Me'),
    h('div', { class: 'section-head' }, h('h1', {}, 'Feedback'),
      h('button', { class: 'btn primary small', onclick: () => editPost(null) }, '＋ New post')),
    h('p', { class: 'muted small' }, 'Suggest features and report bugs. Everyone using the app can see and upvote posts.'),
    seg('kind', [['all', 'All'], ['feature', '💡 Features'], ['bug', '🐞 Bugs']], 'Type'),
    h('div', { class: 'row gap fb-filters' },
      seg('sort', [['top', 'Top'], ['new', 'New']], 'Sort'),
      seg('show', [['active', 'Active'], ['closed', 'Closed'], ['everything', 'All']], 'Status')),
    listEl);
  try {
    const [posts, mineVotes] = await Promise.all([
      api.get(`feedback_posts?select=id,author,kind,title,status,created_at,${AUTHOR},feedback_votes(count),feedback_comments(count)&order=created_at.desc&limit=300`),
      api.get(`feedback_votes?user_id=eq.${api.userId()}&select=post_id`), loadAdmins()]);
    const mine = new Set(mineVotes.map(x => x.post_id));
    let list = posts.map(p => ({ ...p, votes: p.feedback_votes?.[0]?.count || 0, comments: p.feedback_comments?.[0]?.count || 0, mine: mine.has(p.id) }));
    const closed = s => s === 'done' || s === 'wont_do';
    list = list.filter(p => (v.kind === 'all' || p.kind === v.kind) &&
      (v.show === 'everything' || (v.show === 'closed' ? closed(p.status) : !closed(p.status))));
    if (v.sort === 'top') list.sort((a, b) => b.votes - a.votes || new Date(b.created_at) - new Date(a.created_at));
    mount(listEl, list.length ? list.map(p => h('a', { class: 'card fb-card', href: '#/feedback/' + p.id },
      voteButton(p),
      h('div', { class: 'fb-main' },
        h('strong', { class: 'fb-title' }, p.title),
        h('div', { class: 'tags' }, kindTag(p.kind), statusTag(p.status)),
        h('div', { class: 'muted small row gap' }, avatar(p.author_profile, 18), `@${p.author_profile?.username || '?'} · ${ago(p.created_at)} · 💬 ${p.comments}`))))
      : h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Nothing here yet.'), h('button', { class: 'btn primary', onclick: () => editPost(null) }, 'Be the first to post')));
  } catch (e) {
    mount(listEl, h('p', { class: 'muted' }, e.network ? 'The feedback board needs an internet connection.' : e.message));
  }
}

// ---------- create / edit ----------------------------------------------------
function editPost(post) {
  const f = { kind: post?.kind || 'feature', title: post?.title || '', body: post?.body || '' };
  sheet(post ? 'Edit post' : 'New post', close => {
    const err = h('p', { class: 'error', role: 'alert' });
    const body = h('textarea', { rows: 6, maxlength: 4000, oninput: e => (f.body = e.target.value) }, f.body);
    const hint = h('p', { class: 'muted small' });
    const kinds = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Type' });
    const paint = () => {
      mount(kinds, Object.entries(KIND).map(([k, [icon, label]]) => h('button', { type: 'button', role: 'radio', class: f.kind === k ? 'on' : '',
        'aria-checked': String(f.kind === k), onclick: () => { f.kind = k; paint(); } }, `${icon} ${label}`)));
      body.placeholder = f.kind === 'bug' ? 'What happened? What did you expect? Steps to make it happen again…' : 'What would you like, and why would it help?';
      hint.textContent = f.kind === 'bug' && !post ? `Your app version (v${window.APP_VERSION}) and device type are added automatically to help fix it.` : '';
    };
    paint();
    const btn = h('button', { class: 'btn primary block', type: 'submit' }, post ? 'Save' : 'Post');
    return h('form', { onsubmit: async e => {
      e.preventDefault(); err.textContent = '';
      if (f.title.trim().length < 3) return (err.textContent = 'Give it a short title (at least 3 characters)');
      btn.disabled = true;
      try {
        if (post) {
          await api.patch('feedback_posts', 'id=eq.' + post.id, { kind: f.kind, title: f.title.trim(), body: f.body.trim(), updated_at: new Date().toISOString() });
          toast('Saved'); close(); renderPost(document.querySelector('#view > .page'), post.id);
        } else {
          const [row] = await api.insertNow('feedback_posts', { author: api.userId(), kind: f.kind, title: f.title.trim(), body: f.body.trim(),
            app_version: window.APP_VERSION, device: f.kind === 'bug' ? device() : null });
          await api.insertNow('feedback_votes', { post_id: row.id, user_id: api.userId() }).catch(() => {});  // you upvote your own post
          toast('Posted — thanks!'); close(); location.hash = '#/feedback/' + row.id;
        }
      } catch (x) { err.textContent = x.network ? 'You’re offline — try again when you have signal.' : x.message; btn.disabled = false; }
    } },
      kinds,
      h('label', { class: 'field' }, h('span', {}, 'Title'),
        h('input', { value: f.title, maxlength: 120, placeholder: 'Short summary', oninput: e => (f.title = e.target.value) })),
      h('label', { class: 'field' }, h('span', {}, 'Details'), body),
      hint, err, btn);
  });
}

// ---------- one post ---------------------------------------------------------
export async function renderPost(root, id) {
  if (!root) return;
  mount(root, spinner());
  const me = api.userId();
  let p, comments, voted;
  try {
    [[p], comments, voted] = await Promise.all([
      api.get(`feedback_posts?id=eq.${id}&select=*,${AUTHOR},feedback_votes(count)`, { cache: false }),
      api.get(`feedback_comments?post_id=eq.${id}&select=*,author_profile:profiles!feedback_comments_author_fkey(username,avatar_icon,avatar_color)&order=created_at.asc`, { cache: false }),
      api.get(`feedback_votes?post_id=eq.${id}&user_id=eq.${me}&select=post_id`, { cache: false }), loadAdmins()]);
  } catch (e) { mount(root, h('a', { class: 'back', href: '#/feedback' }, '‹ Feedback'), h('p', { class: 'muted' }, e.network ? 'The feedback board needs an internet connection.' : e.message)); return; }
  if (!p) { mount(root, h('a', { class: 'back', href: '#/feedback' }, '‹ Feedback'), h('p', { class: 'muted' }, 'This post was deleted.')); return; }
  const post = { ...p, votes: p.feedback_votes?.[0]?.count || 0, mine: voted.length > 0 };
  const isAuthor = p.author === me;
  const owner = amOwner();
  const ownerTag = uid => admins.has(uid) && h('span', { class: 'tag st-planned' }, 'Owner');

  const statusControl = owner
    ? h('label', { class: 'field' }, h('span', {}, 'Status (only you can change this)'),
        h('select', { onchange: async e => {
          try { await api.rpc('set_feedback_status', { p_post: id, p_status: e.target.value }, { cache: false }); toast('Status updated'); }
          catch (x) { toast(x.message, 'err'); renderPost(root, id); }
        } }, Object.entries(STATUS).map(([k, [l]]) => h('option', { value: k, selected: k === p.status }, l))))
    : null;

  let draft = '';
  const cbtn = h('button', { class: 'btn primary', type: 'submit' }, 'Send');
  mount(root,
    h('a', { class: 'back', href: '#/feedback' }, '‹ Feedback'),
    h('div', { class: 'fb-head' }, voteButton(post), h('h1', {}, p.title)),
    h('div', { class: 'tags' }, kindTag(p.kind), statusTag(p.status)),
    h('p', { class: 'muted small row gap' }, avatar(p.author_profile, 22), `@${p.author_profile?.username || '?'}`, ownerTag(p.author), h('span', {}, '· ' + fmtDay(p.created_at))),
    p.body && h('div', { class: 'card fb-body' }, p.body),
    p.kind === 'bug' && (p.app_version || p.device) && h('p', { class: 'muted small' }, `Reported on v${p.app_version || '?'}${p.device ? ' · ' + p.device : ''}`),
    statusControl,
    (isAuthor || owner) && h('div', { class: 'row gap' },
      isAuthor && h('button', { class: 'btn small', onclick: () => editPost(p) }, 'Edit'),
      h('button', { class: 'btn small danger ghost', onclick: async () => {
        if (!(await confirmSheet('Delete this post?', 'Its votes and comments will be deleted too.'))) return;
        try { await api.removeNow('feedback_posts', 'id=eq.' + id); toast('Deleted'); location.hash = '#/feedback'; } catch (x) { toast(x.message, 'err'); }
      } }, 'Delete')),
    h('h2', {}, `Comments (${comments.length})`),
    comments.map(c => h('div', { class: 'card fb-comment' },
      h('div', { class: 'row between' },
        h('span', { class: 'row gap small' }, avatar(c.author_profile, 22), h('strong', {}, '@' + (c.author_profile?.username || '?')), ownerTag(c.author), h('span', { class: 'muted' }, ago(c.created_at))),
        (c.author === me || owner) && h('button', { class: 'icon-btn', 'aria-label': 'Delete comment', onclick: async () => {
          try { await api.removeNow('feedback_comments', 'id=eq.' + c.id); renderPost(root, id); } catch (x) { toast(x.message, 'err'); } } }, '✕')),
      h('p', { class: 'fb-text' }, c.body))),
    h('form', { class: 'fb-reply', onsubmit: async e => {
      e.preventDefault();
      if (!draft.trim()) return;
      cbtn.disabled = true;
      try { await api.insertNow('feedback_comments', { post_id: id, author: me, body: draft.trim() }); renderPost(root, id); }
      catch (x) { toast(x.network ? 'You’re offline — try again later.' : x.message, 'err'); cbtn.disabled = false; }
    } },
      h('textarea', { rows: 2, maxlength: 2000, placeholder: 'Add a comment…', 'aria-label': 'Add a comment', 'data-noautofocus': '1', oninput: e => (draft = e.target.value) }),
      cbtn));
}
