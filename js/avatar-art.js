// Original avatar illustrations (drawn for this app). Each is an SVG on a 100×100 canvas with a
// transparent background — the circle behind it uses the person's chosen colour.
const O = '#1f2330';            // outline
const W = 'stroke="' + O + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const svg = body => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const eye = (x, y, r = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${O}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff"/>`;
const eyes = (y, gap = 11, cx = 50, r = 4) => eye(cx - gap, y, r) + eye(cx + gap, y, r);
const smile = (y, w = 9, cx = 50) => `<path d="M${cx - w} ${y} Q${cx} ${y + w * 0.9} ${cx + w} ${y}" fill="none" ${W}/>`;
const blush = (y, gap = 17, cx = 50) => `<ellipse cx="${cx - gap}" cy="${y}" rx="4.5" ry="2.8" fill="#ff7a8a" opacity=".55"/><ellipse cx="${cx + gap}" cy="${y}" rx="4.5" ry="2.8" fill="#ff7a8a" opacity=".55"/>`;
const dumbbell = (x, y, s = 1, c = '#3d4452') => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-16" y="-2.5" width="32" height="5" rx="2" fill="#9aa3b2" ${W}/><rect x="-22" y="-9" width="8" height="18" rx="2.5" fill="${c}" ${W}/><rect x="14" y="-9" width="8" height="18" rx="2.5" fill="${c}" ${W}/></g>`;
const shirt = (c, y = 82) => `<path d="M16 104 Q18 ${y} 50 ${y - 4} Q82 ${y} 84 104 Z" fill="${c}" ${W}/>`;
const head = (c, cy = 48, rx = 24, ry = 25) => `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" ${W}/>`;

// ---------- animal mascots ----------
const animals = {
  fox: ['Fox', svg(`
    <path d="M28 38 L22 12 L42 28 Z M72 38 L78 12 L58 28 Z" fill="#f07b2e" ${W}/>
    <path d="M26 20 L30 32 M74 20 L70 32" stroke="#ffe3cc" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 44 Q24 24 50 24 Q76 24 76 44 Q76 64 50 80 Q24 64 24 44 Z" fill="#f07b2e" ${W}/>
    <path d="M30 52 Q40 58 50 78 Q60 58 70 52 Q60 70 50 80 Q40 70 30 52 Z" fill="#fff4ea"/>
    <rect x="24" y="33" width="52" height="8" rx="3" fill="#e5383b" ${W}/>
    ${eyes(50, 11)}<circle cx="50" cy="66" r="4" fill="${O}"/>${smile(70, 5)}`)],
  bear: ['Bear', svg(`
    <circle cx="29" cy="28" r="10" fill="#8b5a3c" ${W}/><circle cx="71" cy="28" r="10" fill="#8b5a3c" ${W}/>
    <circle cx="29" cy="28" r="4.5" fill="#d9a77f"/><circle cx="71" cy="28" r="4.5" fill="#d9a77f"/>
    ${head('#8b5a3c', 48, 27, 25)}
    <ellipse cx="50" cy="58" rx="12" ry="9" fill="#d9a77f" ${W}/><ellipse cx="50" cy="54" rx="4.5" ry="3.2" fill="${O}"/>
    ${eyes(44, 11)}${smile(60, 4)}
    <path d="M50 76 q-9 0 -9 6" fill="none" ${W}/><circle cx="50" cy="90" r="11" fill="#6b7280" ${W}/><path d="M42 82 Q50 72 58 82" fill="none" stroke="${O}" stroke-width="4"/>`)],
  owl: ['Owl', svg(`
    <path d="M24 30 L30 16 L40 26 M76 30 L70 16 L60 26" fill="#7a5c99" ${W}/>
    <path d="M22 50 Q22 22 50 22 Q78 22 78 50 Q78 84 50 86 Q22 84 22 50 Z" fill="#7a5c99" ${W}/>
    <path d="M36 62 Q50 56 64 62 Q64 80 50 82 Q36 80 36 62 Z" fill="#d7c4ea"/>
    <circle cx="38" cy="44" r="11" fill="#fff" ${W}/><circle cx="62" cy="44" r="11" fill="#fff" ${W}/>
    ${eye(38, 44, 5)}${eye(62, 44, 5)}<path d="M46 52 L50 60 L54 52 Z" fill="#f5b700" ${W}/>
    <circle cx="74" cy="74" r="12" fill="#f4f4f4" ${W}/><path d="M74 66 V74 L79 77" fill="none" ${W}/><rect x="71" y="57" width="6" height="5" rx="1" fill="${O}"/>`)],
  panda: ['Panda', svg(`
    <circle cx="28" cy="28" r="10" fill="${O}"/><circle cx="72" cy="28" r="10" fill="${O}"/>
    ${head('#fbfbfb', 48, 27, 25)}
    <ellipse cx="38" cy="46" rx="8" ry="10" fill="${O}" transform="rotate(-20 38 46)"/><ellipse cx="62" cy="46" rx="8" ry="10" fill="${O}" transform="rotate(20 62 46)"/>
    <circle cx="39" cy="45" r="3" fill="#fff"/><circle cx="61" cy="45" r="3" fill="#fff"/>
    <ellipse cx="50" cy="57" rx="4" ry="3" fill="${O}"/>${smile(62, 4)}${blush(60, 18)}
    ${dumbbell(50, 86, 1.1, '#6b7280')}`)],
  bunny: ['Bunny', svg(`
    <ellipse cx="38" cy="20" rx="7" ry="20" fill="#f1ece4" ${W} transform="rotate(-8 38 20)"/><ellipse cx="62" cy="20" rx="7" ry="20" fill="#f1ece4" ${W} transform="rotate(8 62 20)"/>
    <ellipse cx="38" cy="20" rx="3" ry="13" fill="#ffb3c1" transform="rotate(-8 38 20)"/><ellipse cx="62" cy="20" rx="3" ry="13" fill="#ffb3c1" transform="rotate(8 62 20)"/>
    ${head('#f1ece4', 54, 25, 24)}
    <rect x="25" y="38" width="50" height="8" rx="3" fill="#2ec4b6" ${W}/>
    ${eyes(55, 10)}<path d="M47 63 L53 63 L50 66 Z" fill="#ff8fa3" ${W}/><path d="M50 66 v4 M44 70 q6 4 12 0" fill="none" ${W}/>${blush(64)}`)],
  cat: ['Boxer Cat', svg(`
    <path d="M28 34 L26 12 L44 26 Z M72 34 L74 12 L56 26 Z" fill="#9aa3b2" ${W}/>
    ${head('#9aa3b2', 48, 26, 23)}
    <path d="M36 28 l4 6 M50 26 v7 M64 28 l-4 6" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/>
    ${eyes(46, 11)}<path d="M47 55 h6 l-3 3 Z" fill="#ff8fa3" ${W}/>${smile(59, 4)}
    <path d="M26 56 h-10 M26 61 h-9 M74 56 h10 M74 61 h9" stroke="${O}" stroke-width="2"/>
    <ellipse cx="26" cy="84" rx="13" ry="12" fill="#e5383b" ${W}/><ellipse cx="74" cy="84" rx="13" ry="12" fill="#e5383b" ${W}/>
    <path d="M22 78 q4 -3 8 0 M70 78 q4 -3 8 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`)],
  frog: ['Frog', svg(`
    <circle cx="34" cy="30" r="12" fill="#5bbf4a" ${W}/><circle cx="66" cy="30" r="12" fill="#5bbf4a" ${W}/>
    <path d="M18 60 Q18 36 50 36 Q82 36 82 60 Q82 82 50 82 Q18 82 18 60 Z" fill="#5bbf4a" ${W}/>
    <circle cx="34" cy="30" r="7" fill="#fff" ${W}/><circle cx="66" cy="30" r="7" fill="#fff" ${W}/>${eye(34, 31, 3.5)}${eye(66, 31, 3.5)}
    <rect x="20" y="44" width="60" height="7" rx="3" fill="#ffbe0b" ${W}/>
    <path d="M30 64 Q50 80 70 64" fill="#e5383b" ${W}/>${blush(60, 24)}`)],
  penguin: ['Penguin', svg(`
    <path d="M24 56 Q24 18 50 18 Q76 18 76 56 Q76 92 50 92 Q24 92 24 56 Z" fill="#2b2f3a" ${W}/>
    <path d="M34 50 Q34 32 50 32 Q66 32 66 50 Q66 86 50 86 Q34 86 34 50 Z" fill="#fff"/>
    ${eyes(44, 7, 50, 3.5)}<path d="M44 51 L56 51 L50 58 Z" fill="#f5a623" ${W}/>${blush(54, 12)}
    <path d="M42 64 L50 74 L58 64" fill="none" stroke="#2ec4b6" stroke-width="4"/><circle cx="50" cy="78" r="7" fill="#ffd166" ${W}/><path d="M50 75 v6" stroke="${O}" stroke-width="2"/>`)],
  lion: ['Lion', svg(`
    <circle cx="50" cy="48" r="36" fill="#c8741c" ${W}/>
    <path d="M50 12 l6 10 l10 -6 l1 12 l12 -1 l-5 11 l11 5 l-10 7 l8 9 l-12 3 l3 12 l-12 -4 l-3 12 l-9 -8 l-9 8 l-3 -12 l-12 4 l3 -12 l-12 -3 l8 -9 l-10 -7 l11 -5 l-5 -11 l12 1 l1 -12 l10 6 Z" fill="#a95a12"/>
    ${head('#f2b65a', 50, 22, 22)}
    <circle cx="32" cy="32" r="6" fill="#f2b65a" ${W}/><circle cx="68" cy="32" r="6" fill="#f2b65a" ${W}/>
    ${eyes(46, 9)}<path d="M45 56 h10 l-5 5 Z" fill="${O}"/>${smile(61, 5)}`)],
  koala: ['Koala', svg(`
    <circle cx="24" cy="36" r="15" fill="#aeb4be" ${W}/><circle cx="76" cy="36" r="15" fill="#aeb4be" ${W}/>
    <circle cx="24" cy="36" r="8" fill="#f1d7e0"/><circle cx="76" cy="36" r="8" fill="#f1d7e0"/>
    ${head('#aeb4be', 52, 25, 24)}
    ${eyes(48, 10)}<ellipse cx="50" cy="60" rx="7" ry="9" fill="${O}"/>${smile(70, 4)}
    <rect x="66" y="66" width="14" height="26" rx="4" fill="#4cc9f0" ${W}/><rect x="68" y="61" width="10" height="6" rx="2" fill="#2b2f3a" ${W}/>`)],
};

// ---------- athlete characters ----------
const face = (skin, extra = '') => `<ellipse cx="50" cy="48" rx="20" ry="22" fill="${skin}" ${W}/>${eyes(48, 8, 50, 3)}${smile(58, 6)}${extra}`;
const athletes = {
  lifter: ['Lifter', svg(`
    <rect x="4" y="66" width="92" height="6" rx="3" fill="#9aa3b2" ${W}/><rect x="2" y="56" width="9" height="26" rx="3" fill="#3d4452" ${W}/><rect x="89" y="56" width="9" height="26" rx="3" fill="#3d4452" ${W}/>
    ${shirt('#e5383b', 84)}<path d="M30 26 Q50 12 70 26 L70 36 Q50 30 30 36 Z" fill="#2b2f3a" ${W}/>
    ${face('#c68642')}<rect x="30" y="34" width="40" height="6" rx="2" fill="#ffd166" ${W}/>`)],
  runner: ['Runner', svg(`
    ${shirt('#3a86ff', 84)}<rect x="38" y="86" width="24" height="16" rx="2" fill="#fff" ${W}/><text x="50" y="98" font-size="10" font-weight="800" text-anchor="middle" fill="${O}" font-family="system-ui,sans-serif">26</text>
    ${face('#f1c27d')}<path d="M28 36 Q30 18 50 18 Q70 18 72 36 Z" fill="#ff006e" ${W}/><path d="M68 34 Q84 34 86 40 L68 40 Z" fill="#ff006e" ${W}/>
    <path d="M30 40 q-6 10 -2 22" fill="none" stroke="#6b4423" stroke-width="5" stroke-linecap="round"/>`)],
  climber: ['Climber', svg(`
    ${shirt('#2a9d8f', 84)}<path d="M36 80 L50 92 L64 80" fill="none" stroke="#f4a261" stroke-width="4"/>
    ${face('#8d5524')}<path d="M27 42 Q27 18 50 18 Q73 18 73 42 Z" fill="#f4a261" ${W}/><path d="M31 42 L27 56 M69 42 L73 56" stroke="${O}" stroke-width="2.5"/>
    <circle cx="80" cy="70" r="9" fill="#fff" ${W}/><circle cx="76" cy="66" r="2" fill="#cfd4dc"/><circle cx="83" cy="72" r="2" fill="#cfd4dc"/>`)],
  boxer: ['Boxer', svg(`
    ${shirt('#2b2f3a', 86)}${face('#e0ac69', `<path d="M32 40 Q34 24 50 24 Q66 24 68 40 Q58 32 50 34 Q42 32 32 40 Z" fill="#3b2314" ${W}/>`)}
    <ellipse cx="24" cy="70" rx="14" ry="13" fill="#e5383b" ${W}/><ellipse cx="76" cy="70" rx="14" ry="13" fill="#e5383b" ${W}/>
    <rect x="18" y="80" width="12" height="7" rx="2" fill="#fff" ${W}/><rect x="70" y="80" width="12" height="7" rx="2" fill="#fff" ${W}/>`)],
  yogi: ['Yogi', svg(`
    ${shirt('#9b5de5', 84)}<circle cx="50" cy="20" r="10" fill="#1b1b1b" ${W}/>
    <ellipse cx="50" cy="48" rx="20" ry="22" fill="#ffdbac" ${W}/><path d="M30 44 Q32 26 50 26 Q68 26 70 44 Q64 34 50 34 Q36 34 30 44 Z" fill="#1b1b1b" ${W}/>
    <path d="M38 49 q4 3 8 0 M54 49 q4 3 8 0" fill="none" ${W}/>${smile(58, 5)}${blush(55, 13)}<circle cx="50" cy="40" r="2" fill="#e5383b"/>`)],
  cyclist: ['Cyclist', svg(`
    ${shirt('#ffbe0b', 84)}<path d="M30 92 L50 84 L70 92" fill="none" stroke="${O}" stroke-width="3"/>
    ${face('#a1665e')}<path d="M26 40 Q28 16 50 16 Q72 16 74 40 L64 36 L58 40 L50 34 L42 40 L36 36 Z" fill="#06d6a0" ${W}/>
    <rect x="30" y="42" width="40" height="10" rx="5" fill="#2b2f3a" ${W}/><rect x="34" y="44" width="13" height="6" rx="3" fill="#8ecae6"/><rect x="53" y="44" width="13" height="6" rx="3" fill="#8ecae6"/>`)],
  swimmer: ['Swimmer', svg(`
    <path d="M4 84 q12 -8 24 0 t24 0 t24 0 t24 0 V104 H4 Z" fill="#4cc9f0" ${W}/>
    ${face('#f1c27d')}<path d="M29 46 Q29 22 50 22 Q71 22 71 46 Z" fill="#e5383b" ${W}/>
    <rect x="28" y="42" width="44" height="4" fill="${O}"/><circle cx="41" cy="46" r="7" fill="#90e0ef" ${W}/><circle cx="59" cy="46" r="7" fill="#90e0ef" ${W}/>`)],
  tennis: ['Tennis Ace', svg(`
    ${shirt('#fff', 84)}<path d="M40 82 L50 92 L60 82" fill="none" stroke="#2a9d8f" stroke-width="4"/>
    ${face('#c68642', `<path d="M30 42 Q30 24 50 24 Q70 24 70 42 Q72 30 62 26 Q76 22 72 40 Z" fill="#4a2c17" ${W}/><path d="M34 30 q-8 -10 2 -16 q4 10 10 8" fill="#4a2c17" ${W}/>`)}
    <rect x="30" y="34" width="40" height="6" rx="2" fill="#2a9d8f" ${W}/>
    <circle cx="82" cy="60" r="8" fill="#d4f542" ${W}/><path d="M76 56 q6 4 12 0" fill="none" stroke="#fff" stroke-width="2"/>`)],
  footballer: ['Footballer', svg(`
    ${shirt('#06d6a0', 84)}<text x="50" y="98" font-size="12" font-weight="800" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">10</text>
    ${face('#8d5524', `<path d="M30 40 Q30 22 50 22 Q70 22 70 40 Q66 30 50 30 Q34 30 30 40 Z" fill="#111" ${W}/>`)}
    <circle cx="80" cy="76" r="11" fill="#fff" ${W}/><path d="M80 70 l5 4 l-2 6 h-6 l-2 -6 Z" fill="${O}"/>`)],
  coach: ['Coach', svg(`
    ${shirt('#3d4452', 84)}<path d="M40 82 Q50 96 60 82" fill="none" stroke="#ffd166" stroke-width="3"/><rect x="54" y="92" width="10" height="6" rx="2" fill="#cfd4dc" ${W}/>
    ${face('#ffdbac', `<path d="M36 64 Q50 74 64 64 Q64 72 50 74 Q36 72 36 64 Z" fill="#8a8f98" ${W}/>`)}
    <path d="M28 38 Q30 20 50 20 Q70 20 72 38 Z" fill="#1d3557" ${W}/><path d="M26 38 H80 Q82 44 72 44 H28 Z" fill="#1d3557" ${W}/>`)],
};

// ---------- monsters & creatures ----------
const monsters = {
  blob: ['Gym Blob', svg(`
    <path d="M20 84 Q14 50 30 34 Q50 16 70 34 Q86 50 80 84 Q66 92 50 88 Q34 92 20 84 Z" fill="#8ac926" ${W}/>
    ${eye(50, 46, 9)}<circle cx="50" cy="46" r="9" fill="none" stroke="${O}" stroke-width="3"/>${smile(66, 8)}
    ${dumbbell(50, 16, 0.9, '#e5383b')}<path d="M34 34 L40 22 M66 34 L60 22" ${W} fill="none"/>`)],
  gremlin: ['Spiky Gremlin', svg(`
    <path d="M18 60 L10 48 L22 46 L16 32 L30 34 L30 18 L42 28 L50 12 L58 28 L70 18 L70 34 L84 32 L78 46 L90 48 L82 60 Q84 84 50 86 Q16 84 18 60 Z" fill="#9b5de5" ${W}/>
    ${eyes(52, 12, 50, 5)}<path d="M36 68 L42 64 L46 70 L50 64 L54 70 L58 64 L64 68" fill="#fff" ${W}/>
    <path d="M28 44 L42 48 M72 44 L58 48" stroke="${O}" stroke-width="3.5" stroke-linecap="round"/>`)],
  cloud: ['Buff Cloud', svg(`
    <path d="M22 66 Q8 64 12 50 Q14 38 28 40 Q30 22 48 24 Q60 12 72 26 Q90 26 88 44 Q96 56 84 66 Z" fill="#f8f9fa" ${W}/>
    ${eyes(48, 10, 52)}${smile(56, 6, 52)}${blush(54, 16, 52)}
    <path d="M18 66 Q6 74 12 86 Q20 94 28 84 Q30 76 24 70" fill="#f8f9fa" ${W}/><path d="M82 66 Q94 74 88 86 Q80 94 72 84 Q70 76 76 70" fill="#f8f9fa" ${W}/>
    <path d="M40 72 l-4 14 l8 -6 l-2 12" fill="none" stroke="#ffd166" stroke-width="4" stroke-linejoin="round"/>`)],
  cyclops: ['Cyclops', svg(`
    <path d="M40 18 L44 8 L48 18 M52 18 L56 8 L60 18" fill="#f2f2f2" ${W}/>
    <path d="M22 54 Q22 18 50 18 Q78 18 78 54 Q78 88 50 88 Q22 88 22 54 Z" fill="#ff7b00" ${W}/>
    <circle cx="50" cy="44" r="13" fill="#fff" ${W}/>${eye(50, 45, 6.5)}
    <path d="M34 68 Q50 80 66 68" fill="${O}" ${W}/><rect x="42" y="68" width="6" height="5" fill="#fff"/><rect x="52" y="68" width="6" height="5" fill="#fff"/>`)],
  alien: ['Three-eyed Alien', svg(`
    <path d="M40 22 L32 6 M60 22 L68 6" ${W} fill="none"/><circle cx="32" cy="6" r="4" fill="#ffd166" ${W}/><circle cx="68" cy="6" r="4" fill="#ffd166" ${W}/>
    <path d="M20 46 Q20 18 50 18 Q80 18 80 46 Q80 72 62 84 Q50 90 38 84 Q20 72 20 46 Z" fill="#43d9ad" ${W}/>
    ${eye(34, 46, 5)}${eye(50, 38, 6)}${eye(66, 46, 5)}${smile(66, 8)}`)],
  ghost: ['Pumped Ghost', svg(`
    <path d="M22 88 V46 Q22 16 50 16 Q78 16 78 46 V88 L70 80 L62 88 L54 80 L46 88 L38 80 L30 88 Z" fill="#edf2fb" ${W}/>
    ${eyes(44, 10, 50, 4.5)}<ellipse cx="50" cy="60" rx="6" ry="7" fill="${O}"/>${blush(54, 18)}
    ${dumbbell(50, 76, 0.8, '#7b2cbf')}`)],
  slime: ['Slime', svg(`
    <path d="M14 86 Q16 60 30 46 Q40 22 50 20 Q60 22 70 46 Q84 60 86 86 Z" fill="#48cae4" ${W} opacity=".95"/>
    <path d="M30 86 v8 M54 86 v5 M72 86 v9" stroke="#48cae4" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="38" cy="40" rx="5" ry="8" fill="#fff" opacity=".6"/>${eyes(58, 10)}${smile(70, 7)}`)],
  yeti: ['Yeti', svg(`
    <path d="M20 50 l-6 -6 l8 -4 l-4 -10 l10 2 l2 -12 l10 6 l10 -10 l10 10 l10 -6 l2 12 l10 -2 l-4 10 l8 4 l-6 6 Q84 86 50 88 Q16 86 20 50 Z" fill="#f1faee" ${W}/>
    <ellipse cx="50" cy="56" rx="20" ry="18" fill="#a8dadc" ${W}/>${eyes(52, 8)}
    <path d="M42 64 Q50 70 58 64" fill="#fff" ${W}/><path d="M44 64 v4 M56 64 v4" stroke="${O}" stroke-width="2"/>
    <path d="M30 34 L44 30 L50 36 L56 30 L70 34 L68 40 H32 Z" fill="#e63946" ${W}/>`)],
  robot: ['Robo-Lifter', svg(`
    <path d="M50 14 V22" ${W}/><circle cx="50" cy="12" r="4" fill="#e5383b" ${W}/>
    <rect x="22" y="22" width="56" height="48" rx="10" fill="#c0c7d1" ${W}/><rect x="12" y="38" width="10" height="16" rx="3" fill="#8a94a3" ${W}/><rect x="78" y="38" width="10" height="16" rx="3" fill="#8a94a3" ${W}/>
    <rect x="30" y="32" width="40" height="20" rx="6" fill="#1f2330"/><circle cx="41" cy="42" r="4" fill="#4cc9f0"/><circle cx="59" cy="42" r="4" fill="#4cc9f0"/>
    <rect x="36" y="58" width="28" height="5" rx="2" fill="#1f2330"/><path d="M40 58 v5 M46 58 v5 M52 58 v5 M58 58 v5" stroke="#c0c7d1" stroke-width="1.5"/>
    <rect x="30" y="74" width="40" height="24" rx="6" fill="#8a94a3" ${W}/><circle cx="50" cy="86" r="5" fill="#ffd166" ${W}/>`)],
  dragon: ['Mini Dragon', svg(`
    <path d="M30 30 L22 12 L38 24 M70 30 L78 12 L62 24" fill="#ffd166" ${W}/>
    <path d="M20 54 Q20 22 50 22 Q80 22 80 54 Q80 80 50 82 Q20 80 20 54 Z" fill="#e63946" ${W}/>
    <path d="M36 66 Q50 58 64 66 Q64 82 50 82 Q36 82 36 66 Z" fill="#ffb4a2" ${W}/><circle cx="45" cy="68" r="2" fill="${O}"/><circle cx="55" cy="68" r="2" fill="${O}"/>
    ${eyes(46, 12)}<path d="M40 36 L46 30 L50 36 L54 30 L60 36" fill="#ffd166" ${W}/>
    <path d="M58 76 q10 6 20 -2 q-4 10 -14 10" fill="#ff9f1c" ${W}/>`)],
};

// ---------- bold geometric emblems ----------
const geometric = {
  bolt_shield: ['Lightning Shield', svg(`
    <path d="M50 8 L84 20 V48 Q84 76 50 92 Q16 76 16 48 V20 Z" fill="#1d3557" ${W}/><path d="M50 16 L76 26 V48 Q76 70 50 84 Q24 70 24 48 V26 Z" fill="#457b9d"/>
    <path d="M56 22 L36 54 H50 L42 80 L66 44 H52 Z" fill="#ffd166" ${W}/>`)],
  hex_wolf: ['Hex Wolf', svg(`
    <path d="M50 6 L88 28 V72 L50 94 L12 72 V28 Z" fill="#2b2d42" ${W}/>
    <path d="M30 30 L40 44 L50 38 L60 44 L70 30 L72 54 L60 72 L50 78 L40 72 L28 54 Z" fill="#adb5bd" ${W}/>
    <path d="M40 54 L46 56 M60 54 L54 56" stroke="${O}" stroke-width="4" stroke-linecap="round"/><path d="M46 66 L50 70 L54 66 Z" fill="${O}"/>`)],
  peak: ['Summit', svg(`
    <circle cx="50" cy="50" r="40" fill="#023047" ${W}/>
    <path d="M14 72 L40 32 L52 50 L62 38 L86 72 Q70 88 50 90 Q30 88 14 72 Z" fill="#8ecae6" ${W}/>
    <path d="M40 32 L47 43 L42 46 L36 40 Z M62 38 L67 45 L62 47 Z" fill="#fff"/><circle cx="70" cy="26" r="7" fill="#ffb703" ${W}/>`)],
  crest: ['Iron Crest', svg(`
    <path d="M20 16 H80 V50 Q80 80 50 92 Q20 80 20 50 Z" fill="#6a040f" ${W}/><path d="M20 16 H80 V34 H20 Z" fill="#9d0208" ${W}/>
    <path d="M30 25 l3 -5 l3 5 M47 25 l3 -5 l3 5 M64 25 l3 -5 l3 5" fill="none" stroke="#ffd166" stroke-width="2.5"/>
    ${dumbbell(50, 58, 1.1, '#ffd166')}`)],
  star: ['Gold Star', svg(`
    <circle cx="50" cy="50" r="40" fill="#fb8500" ${W}/><circle cx="50" cy="50" r="31" fill="none" stroke="#ffd166" stroke-width="3" stroke-dasharray="4 5"/>
    <path d="M50 22 L57 41 L77 41 L61 53 L67 73 L50 61 L33 73 L39 53 L23 41 L43 41 Z" fill="#ffd166" ${W}/>`)],
  flame: ['Ember', svg(`
    <path d="M50 6 Q70 30 72 52 Q74 80 50 92 Q26 80 28 54 Q30 40 40 30 Q42 44 50 46 Q46 28 50 6 Z" fill="#e85d04" ${W}/>
    <path d="M50 44 Q62 58 60 72 Q58 84 50 86 Q42 84 40 72 Q40 62 46 56 Q48 64 52 64 Q50 54 50 44 Z" fill="#ffba08" ${W}/>`)],
  eagle: ['Geo Eagle', svg(`
    <path d="M50 30 L8 20 L24 44 L4 46 L30 60 L50 54 L70 60 L96 46 L76 44 L92 20 Z" fill="#6c757d" ${W}/>
    <path d="M40 28 L50 20 L60 28 L58 48 L50 56 L42 48 Z" fill="#f8f9fa" ${W}/><path d="M50 40 L58 44 L50 50 Z" fill="#ffb703" ${W}/>
    <circle cx="46" cy="34" r="2.5" fill="${O}"/><circle cx="54" cy="34" r="2.5" fill="${O}"/><path d="M40 60 L50 84 L60 60 Z" fill="#495057" ${W}/>`)],
  bull: ['Geo Bull', svg(`
    <path d="M28 30 Q10 26 12 10 Q22 22 34 22 Z M72 30 Q90 26 88 10 Q78 22 66 22 Z" fill="#f1faee" ${W}/>
    <path d="M28 24 H72 L78 46 L62 82 H38 L22 46 Z" fill="#9c6644" ${W}/><path d="M38 60 H62 L58 80 H42 Z" fill="#ddb892" ${W}/>
    <circle cx="44" cy="70" r="2.5" fill="${O}"/><circle cx="56" cy="70" r="2.5" fill="${O}"/>
    <path d="M32 40 L42 44 M68 40 L58 44" stroke="${O}" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="84" r="5" fill="none" stroke="#ffd166" stroke-width="3"/>`)],
  chevrons: ['Rank Up', svg(`
    <rect x="18" y="12" width="64" height="76" rx="12" fill="#264653" ${W}/>
    <path d="M28 44 L50 30 L72 44 V54 L50 40 L28 54 Z" fill="#e9c46a" ${W}/><path d="M28 64 L50 50 L72 64 V74 L50 60 L28 74 Z" fill="#f4a261" ${W}/>
    <circle cx="50" cy="22" r="4" fill="#e9c46a"/>`)],
  kettlebell: ['Kettle Emblem', svg(`
    <path d="M50 6 L90 50 L50 94 L10 50 Z" fill="#118ab2" ${W}/>
    <path d="M38 38 Q38 24 50 24 Q62 24 62 38" fill="none" stroke="${O}" stroke-width="7"/><path d="M38 38 Q38 24 50 24 Q62 24 62 38" fill="none" stroke="#adb5bd" stroke-width="3"/>
    <circle cx="50" cy="56" r="18" fill="#2b2d42" ${W}/><rect x="42" y="50" width="16" height="10" rx="2" fill="#ffd166"/><text x="50" y="59" font-size="8" font-weight="800" text-anchor="middle" fill="${O}" font-family="system-ui,sans-serif">24</text>`)],
};

export const ART_GROUPS = [
  ['Animal mascots', animals], ['Athletes', athletes], ['Creatures', monsters], ['Emblems', geometric],
];
export const ART = Object.fromEntries(ART_GROUPS.flatMap(([, g]) => Object.entries(g).map(([k, [name, s]]) => ['a_' + k, { name, svg: s }])));
