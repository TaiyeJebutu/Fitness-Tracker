// Loaded before the page draws: app version + the viewer's colour scheme (saved on this device).
window.APP_VERSION = '2.4.0';

(function () {
  const KEY = 'ft.theme';
  // Colour themes, tuned for the Stone design (muted, calm). Sage is the default.
  const PRESETS = [
    ['Sage', '#2f6f5e'], ['Ocean', '#2c5d8f'], ['Plum', '#6b4c8a'], ['Clay', '#b0583a'],
    ['Rose', '#a8445f'], ['Ochre', '#96701a'], ['Forest', '#3f6b2f'], ['Slate', '#4b5563'],
  ];
  // colours from the old (v1) palette move to their closest calm equivalent
  const OLD = { '#2f5fe0': '#2c5d8f', '#0f8b8d': '#2f6f5e', '#1f8a3b': '#3f6b2f', '#7c3aed': '#6b4c8a',
    '#d6336c': '#a8445f', '#d9352b': '#b0583a', '#e8590c': '#b0583a', '#b88400': '#96701a' };
  const load = () => {
    let t; try { t = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { t = {}; }
    const c = (t.accent || '').toLowerCase();
    if (OLD[c]) { t.accent = OLD[c]; save(t); }
    return t;
  };
  const save = t => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch {} };

  // ---- colour maths: keep any chosen accent readable in light and dark mode ----
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // Nudge the colour toward black (light mode) or white (dark mode) until it has enough contrast with the background.
  function fit(c, bg, target, toward) {
    for (let t = 0; t <= 1; t += 0.04) { const m = mix(c, toward, t); if (contrast(m, bg) >= target) return m; }
    return toward;
  }
  const ink = c => (contrast(c, [255, 255, 255]) >= contrast(c, [11, 13, 18]) ? '#ffffff' : '#0b0d12');
  const valid = h => /^#[0-9a-fA-F]{6}$/.test(h || '');

  function apply(t = load()) {
    const root = document.documentElement;
    if (t.mode === 'light' || t.mode === 'dark') root.dataset.theme = t.mode; else delete root.dataset.theme;
    const st = root.style;
    if (valid(t.accent)) {
      const base = rgb(t.accent);
      const light = fit(base, [255, 255, 255], 4.5, [0, 0, 0]);
      const dark = fit(mix(base, [255, 255, 255], 0.25), [31, 30, 27], 4.5, [255, 255, 255]);   // on the dark Stone surface
      st.setProperty('--accent-l', hex(light)); st.setProperty('--accent-ink-l', ink(light));
      st.setProperty('--accent-d', hex(dark)); st.setProperty('--accent-ink-d', ink(dark));
    } else ['--accent-l', '--accent-ink-l', '--accent-d', '--accent-ink-d'].forEach(p => st.removeProperty(p));
    // browser/status-bar colour
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
      const isDarkMeta = (m.getAttribute('media') || '').includes('dark');
      m.content = t.mode === 'dark' ? '#141311' : t.mode === 'light' ? '#f3f1ec' : isDarkMeta ? '#141311' : '#f3f1ec';
    });
  }
  window.FTTheme = { load, save, apply, PRESETS, valid };
  apply();
})();
