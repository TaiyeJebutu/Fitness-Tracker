// Tiny QR code maker (byte mode, error correction level M, versions 1–10) — enough for a link.
// Made here so no outside service or library is needed. Returns an <svg> string.

// ---------- Reed–Solomon over GF(256) ----------
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}
function rsRemainder(data, n) {
  const gen = rsGenerator(n), res = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ res.shift(); res.push(0);
    for (let i = 0; i < n; i++) res[i] ^= mul(gen[i + 1], f);
  }
  return res;
}

// ---------- tables for level M: [ec codewords per block, [[blocks, data codewords per block], ...]] ----------
const TABLE = [null,
  [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]],
  [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]]];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const dataCapacity = v => TABLE[v][1].reduce((t, [b, d]) => t + b * d, 0);

function encode(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1;
  while (v <= 10 && 4 + 8 + bytes.length * 8 > dataCapacity(v) * 8) v++;
  if (v > 10) throw new Error('Text too long for a QR code');
  // bit stream: mode 0100, 8-bit length (versions 1–9) or 16-bit (10+), data, terminator, padding
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  const cap = dataCapacity(v) * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  const words = [];
  for (let i = 0; i < bits.length; i += 8) words.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; words.length < cap / 8; pad ^= 0xec ^ 0x11) words.push(pad);
  // split into blocks, add error correction, interleave
  const [ecLen, groups] = TABLE[v];
  const blocks = []; let k = 0;
  for (const [n, d] of groups) for (let i = 0; i < n; i++) { const data = words.slice(k, k + d); k += d; blocks.push({ data, ec: rsRemainder(data, ecLen) }); }
  const out = [];
  const maxD = Math.max(...blocks.map(b => b.data.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.ec[i]);
  return { v, codewords: out };
}

// ---------- the grid ----------
function bch(value, poly, bitsOut) {
  const deg = Math.floor(Math.log2(poly));
  let r = value << deg;
  for (let i = Math.floor(Math.log2(r || 1)); i >= deg; i--) if ((r >> i) & 1) r ^= poly << (i - deg);
  return (value << deg) | r;
}
const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];

function build({ v, codewords }, mask) {
  const n = 17 + 4 * v;
  const m = Array.from({ length: n }, () => new Array(n).fill(null));   // null = free, 0/1 = module
  const fixed = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, val) => { m[r][c] = val ? 1 : 0; fixed[r][c] = true; };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(rr, cc, on);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[v];
  for (const r of al) for (const c of al) {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  set(n - 8, 8, 1);   // dark module
  // reserve format areas (filled below)
  for (let i = 0; i < 9; i++) { if (!fixed[8][i]) set(8, i, 0); if (!fixed[i][8]) set(i, 8, 0); }
  for (let i = 0; i < 8; i++) { set(8, n - 1 - i, 0); set(n - 1 - i, 8, 0); }
  // version info (7+)
  if (v >= 7) {
    const vi = bch(v, 0x1f25);
    for (let i = 0; i < 18; i++) { const b = (vi >> i) & 1, a = Math.floor(i / 3), c = n - 11 + (i % 3); set(a, c, b); set(c, a, b); }
  }
  // data, zig-zag from bottom right
  const bits = []; codewords.forEach(w => { for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1); });
  let bi = 0, up = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < n; i++) {
      const r = up ? n - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (fixed[r][c]) continue;
        let b = bi < bits.length ? bits[bi++] : 0;
        if (MASKS[mask](r, c)) b ^= 1;
        m[r][c] = b;
      }
    }
    up = !up;
  }
  // format info (level M = 00), two copies
  const fi = bch((0 << 3) | mask, 0x537) ^ 0x5412;
  const bit = i => (fi >> i) & 1;
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6); m[8][8] = bit(7); m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i);
  m[n - 8][8] = 1;   // dark module
  return m;
}

function penalty(m) {
  const n = m.length; let p = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    let run = 1;
    for (let j = 1; j < n; j++) {
      const a = pass ? m[j][i] : m[i][j], b = pass ? m[j - 1][i] : m[i][j - 1];
      if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
    }
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const s = m[r][c] + m[r + 1][c] + m[r][c + 1] + m[r + 1][c + 1]; if (s === 0 || s === 4) p += 3; }
  let dark = 0; m.forEach(row => row.forEach(x => (dark += x)));
  p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

/** A QR code for `text` as an SVG string (black on white, with a quiet zone). */
export function qrSvg(text, size = 220) {
  const enc = encode(text);
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) { const m = build(enc, mask); const p = penalty(m); if (p < bestP) { best = m; bestP = p; } }
  const n = best.length, q = 4, total = n + q * 2;
  let d = '';
  best.forEach((row, r) => row.forEach((x, c) => { if (x) d += `M${c + q} ${r + q}h1v1h-1z`; }));
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
