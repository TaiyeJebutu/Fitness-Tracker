// Release check — run before publishing:  node tools/check-release.mjs
// Makes sure the guide and version numbers were updated along with the code.
import { readFileSync, readdirSync } from 'node:fs';
import { TOPICS, SECTIONS, CHANGELOG, topicForScreen } from '../js/guide.js';

const problems = [];
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// 1. One version number everywhere, and a "What's new" entry for it
const appV = read('js/theme.js').match(/APP_VERSION = '([\d.]+)'/)?.[1];
const jsonV = JSON.parse(read('version.json')).version;
const swV = read('sw.js').match(/const VERSION = 'v([\d.]+)'/)?.[1];
if (!(appV && appV === jsonV && appV === swV)) problems.push(`Version mismatch: theme.js ${appV}, version.json ${jsonV}, sw.js ${swV}`);
if (CHANGELOG[0]?.version !== appV) problems.push(`guide.js CHANGELOG has no entry for v${appV} (newest is v${CHANGELOG[0]?.version}) — add “What’s new” items`);
if (!CHANGELOG[0]?.items?.length) problems.push('Newest CHANGELOG entry has no items');

// 2. Every screen has a help topic (Me and Help open the guide's contents page)
const screens = [...read('js/app.js').matchAll(/case '([a-z]*)':/g)].map(m => m[1]);
for (const s of screens) if (!['me', 'help'].includes(s) && !topicForScreen(s)) problems.push(`Screen '#/${s}' has no help topic (add it to a topic's screens list)`);

// 3. Guide is well-formed
const ids = new Set();
for (const t of TOPICS) {
  if (ids.has(t.id)) problems.push('Duplicate topic id ' + t.id);
  ids.add(t.id);
  if (!SECTIONS.includes(t.section)) problems.push(`Topic ${t.id} has unknown section “${t.section}”`);
  if (!t.body?.length) problems.push(`Topic ${t.id} is empty`);
}

// 4. Every app script is cached for offline use
const sw = read('sw.js');
for (const f of readdirSync(new URL('../js/', import.meta.url))) if (f.endsWith('.js') && !sw.includes(`'js/${f}'`)) problems.push(`sw.js FILES is missing js/${f}`);

if (problems.length) { console.log('✗ Release check failed:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log(`✓ Release check passed: v${appV}, ${TOPICS.length} help topics, ${screens.length} screens covered`);
