// Xbox controller button glyphs for whip (html/img/pad/*.svg) — this is their source.
// Change a shape or colour here, then `node dev/pad_glyphs.js` rewrites all 19 files.
//
// THE "ANCHORED" LOOK: like the real Xbox Series pad — dark buttons with a hairline edge, the face
// buttons' letters in their colours (green A, red B, blue X, amber Y: whip's own four), every other
// letter light.
//
// THE LETTERS ARE WHIP'S FONT, AS OUTLINES. The artifact wrote them as <text> in Plus Jakarta Sans
// ExtraBold; an SVG used as an <img> cannot load a font, so the shapes are carried instead. They are
// the outlines of whip's own html/fonts/plusjakarta-latin.woff2 (a variable font) at wght 800, laid
// out at the artifact's place and size (centred on x, on baseline y), read out with fontkit. To redo
// them: decompress that woff2 to a TTF (wawoff2), then fontkit getVariation({ wght: 800 }) and
// layout(text); each glyph's path scaled by size / unitsPerEm, y flipped, moved to its pen position.
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'html', 'img', 'pad');
fs.mkdirSync(OUT, { recursive: true });

const BODY = '#161a22';         // the buttons: whip's glass colour, a step lighter so they stand off it
const LIT = '#eef1f5';          // letters and marks on them
const EDGE = 'stroke="#ffffff" stroke-opacity=".3" stroke-width="1"';   // the hairline round each button
const FACE = { a: '#4ade80', b: '#f87171', x: '#60a5fa', y: '#fbbf24' };   // the letters' colours

const svg = (w, body, h = 24) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;
const letter = (d, colour = LIT) => `<path d="${d}" fill="${colour}"/>`;

// ---- the letters: Plus Jakarta Sans ExtraBold (wght 800) outlines, in each icon's own units ----
//   A B X Y   centred on x 12, baseline 16.4, 12.6 tall (the face buttons, 24 x 24)
//   LB RB     centred on x 18, baseline 16.7, 9.4 (the bumpers, 36 x 24)
//   LT RT     centred on x 13, baseline 19.8, 8.6 (the triggers, 26 x 28)
//   L R       centred on x 12, baseline 15.3, 8.8 (the sticks, 24 x 24)
const GLYPH = {
    A: 'M7.53 16.4L10.7 7.01L13.3 7.01L16.47 16.4L14.34 16.4L13.71 14.48L10.27 14.48L9.64 16.4ZM10.82 12.78L13.17 12.78L11.74 8.35L12.26 8.35Z',
    B: 'M8.48 16.4L8.48 7.01L12.45 7.01Q13.42 7.01 14.12 7.34Q14.81 7.67 15.18 8.28Q15.54 8.89 15.54 9.76Q15.54 10.38 15.2 10.94Q14.86 11.5 14.08 11.88L14.08 10.92Q14.82 11.21 15.23 11.61Q15.63 12.02 15.78 12.49Q15.93 12.96 15.93 13.48Q15.93 14.86 15.01 15.63Q14.09 16.4 12.45 16.4ZM10.44 14.7L12.68 14.7Q13.27 14.7 13.63 14.36Q13.98 14.02 13.98 13.48Q13.98 12.92 13.63 12.58Q13.27 12.24 12.68 12.24L10.44 12.24ZM10.44 10.54L12.59 10.54Q13.05 10.54 13.32 10.28Q13.59 10.02 13.59 9.6Q13.59 9.17 13.32 8.91Q13.05 8.65 12.59 8.65L10.44 8.65Z',
    X: 'M7.84 16.4L10.92 11.7L7.84 7.01L10.08 7.01L12.55 10.77L11.46 10.77L13.92 7.01L16.16 7.01L13.1 11.7L16.16 16.4L13.92 16.4L11.46 12.63L12.55 12.65L10.08 16.4Z',
    Y: 'M11.03 16.4L11.03 12.31L7.91 7.01L10.14 7.01L12.4 10.99L11.61 10.99L13.86 7.01L16.1 7.01L12.98 12.29L12.98 16.4Z',
    LB: 'M12.81 16.7L12.81 9.7L14.26 9.7L14.26 15.43L17.22 15.43L17.22 16.7ZM17.95 16.7L17.95 9.7L20.91 9.7Q21.63 9.7 22.15 9.94Q22.67 10.19 22.94 10.64Q23.21 11.1 23.21 11.75Q23.21 12.21 22.96 12.63Q22.7 13.04 22.12 13.33L22.12 12.61Q22.68 12.83 22.98 13.13Q23.28 13.43 23.39 13.78Q23.5 14.13 23.5 14.52Q23.5 15.55 22.82 16.13Q22.13 16.7 20.91 16.7ZM19.41 15.43L21.08 15.43Q21.52 15.43 21.78 15.18Q22.05 14.92 22.05 14.52Q22.05 14.11 21.78 13.85Q21.52 13.6 21.08 13.6L19.41 13.6ZM19.41 12.33L21.01 12.33Q21.35 12.33 21.55 12.14Q21.76 11.94 21.76 11.62Q21.76 11.3 21.55 11.11Q21.35 10.92 21.01 10.92L19.41 10.92Z',
    RB: 'M12.24 16.7L12.24 9.7L14.92 9.7Q15.65 9.7 16.2 9.95Q16.76 10.2 17.08 10.7Q17.4 11.2 17.4 11.93Q17.4 12.65 17.07 13.15Q16.75 13.65 16.19 13.91L17.79 16.7L16.15 16.7L14.42 13.61L15.36 14.16L13.7 14.16L13.7 16.7ZM13.7 12.89L14.93 12.89Q15.24 12.89 15.47 12.77Q15.69 12.65 15.82 12.43Q15.95 12.22 15.95 11.93Q15.95 11.64 15.82 11.43Q15.69 11.21 15.47 11.09Q15.24 10.97 14.93 10.97L13.7 10.97ZM18.51 16.7L18.51 9.7L21.47 9.7Q22.2 9.7 22.71 9.94Q23.23 10.19 23.5 10.64Q23.78 11.1 23.78 11.75Q23.78 12.21 23.52 12.63Q23.27 13.04 22.69 13.33L22.69 12.61Q23.24 12.83 23.54 13.13Q23.84 13.43 23.95 13.78Q24.07 14.13 24.07 14.52Q24.07 15.55 23.38 16.13Q22.7 16.7 21.47 16.7ZM19.97 15.43L21.64 15.43Q22.08 15.43 22.35 15.18Q22.61 14.92 22.61 14.52Q22.61 14.11 22.35 13.85Q22.08 13.6 21.64 13.6L19.97 13.6ZM19.97 12.33L21.58 12.33Q21.92 12.33 22.12 12.14Q22.32 11.94 22.32 11.62Q22.32 11.3 22.12 11.11Q21.92 10.92 21.58 10.92L19.97 10.92Z',
    LT: 'M9.1 19.8L9.1 13.39L10.43 13.39L10.43 18.64L13.14 18.64L13.14 19.8ZM14.44 19.8L14.44 14.55L12.82 14.55L12.82 13.39L17.37 13.39L17.37 14.55L15.77 14.55L15.77 19.8Z',
    RT: 'M8.41 19.8L8.41 13.39L10.86 13.39Q11.53 13.39 12.04 13.63Q12.55 13.86 12.84 14.31Q13.13 14.77 13.13 15.44Q13.13 16.09 12.83 16.55Q12.53 17.01 12.02 17.25L13.49 19.8L11.99 19.8L10.41 16.97L11.27 17.48L9.74 17.48L9.74 19.8ZM9.74 16.32L10.87 16.32Q11.16 16.32 11.36 16.21Q11.57 16.09 11.68 15.9Q11.8 15.7 11.8 15.44Q11.8 15.17 11.68 14.98Q11.57 14.78 11.36 14.67Q11.16 14.55 10.87 14.55L9.74 14.55ZM15.13 19.8L15.13 14.55L13.5 14.55L13.5 13.39L18.06 13.39L18.06 14.55L16.46 14.55L16.46 19.8Z',
    L: 'M10.17 15.3L10.17 8.74L11.54 8.74L11.54 14.11L14.31 14.11L14.31 15.3Z',
    R: 'M9.65 15.3L9.65 8.74L12.15 8.74Q12.83 8.74 13.36 8.98Q13.88 9.22 14.18 9.69Q14.48 10.15 14.48 10.84Q14.48 11.51 14.17 11.98Q13.86 12.45 13.34 12.69L14.84 15.3L13.31 15.3L11.69 12.4L12.57 12.92L11.01 12.92L11.01 15.3ZM11.01 11.74L12.16 11.74Q12.45 11.74 12.66 11.62Q12.88 11.51 12.99 11.3Q13.11 11.1 13.11 10.84Q13.11 10.57 12.99 10.36Q12.88 10.16 12.66 10.05Q12.45 9.93 12.16 9.93L11.01 9.93Z',
};

// ---- face buttons: a dark disc, the letter in its colour ----
const DISC = `<circle cx="12" cy="12" r="10.6" fill="${BODY}" ${EDGE}/>`;
for (const k of Object.keys(FACE)) {
    fs.writeFileSync(path.join(OUT, `${k}.svg`), svg(24, DISC + letter(GLYPH[k.toUpperCase()], FACE[k])));
}

// ---- bumpers: a tab, rounded hard on the outer top corner (RB is LB's mirror) ----
const BUMPER = 'M3 18.5V11C3 7.4 6.4 5 10.5 5H29.5A3.5 3.5 0 0 1 33 8.5V18.5A2 2 0 0 1 31 20.5H5A2 2 0 0 1 3 18.5Z';
fs.writeFileSync(path.join(OUT, 'lb.svg'), svg(36,
    `<path d="${BUMPER}" fill="${BODY}" ${EDGE}/>` + letter(GLYPH.LB)));
fs.writeFileSync(path.join(OUT, 'rb.svg'), svg(36,
    `<path d="${BUMPER}" fill="${BODY}" ${EDGE} transform="matrix(-1 0 0 1 36 0)"/>` + letter(GLYPH.RB)));

// ---- triggers: tall, round-topped (26 x 28: a trigger is taller than it is wide) ----
const TRIGGER = 'M5 24.5V10C5 5.6 8.3 2.5 12.2 2.5H13.8C17.7 2.5 21 5.6 21 10V24.5A1.5 1.5 0 0 1 19.5 26H6.5A1.5 1.5 0 0 1 5 24.5Z';
fs.writeFileSync(path.join(OUT, 'lt.svg'), svg(26, `<path d="${TRIGGER}" fill="${BODY}" ${EDGE}/>` + letter(GLYPH.LT), 28));
fs.writeFileSync(path.join(OUT, 'rt.svg'), svg(26, `<path d="${TRIGGER}" fill="${BODY}" ${EDGE}/>` + letter(GLYPH.RT), 28));

// ---- sticks: the cap and its grip ring; the click is the cap pushed in (lit, the letter dark on it) ----
for (const s of ['L', 'R']) {
    const n = s.toLowerCase();
    fs.writeFileSync(path.join(OUT, `${n}s.svg`), svg(24,
        DISC + `<circle cx="12" cy="12" r="6.6" fill="none" stroke="${LIT}" stroke-opacity=".35" stroke-width="1.2"/>`
        + letter(GLYPH[s])));
    fs.writeFileSync(path.join(OUT, `${n}3.svg`), svg(24,
        DISC + `<circle cx="12" cy="12" r="6.6" fill="${LIT}"/>` + letter(GLYPH[s], BODY)));
}

// ---- the D-pad: a cross with an arrow on each arm; a direction lights its arm and keeps only its arrow ----
const CROSS = 'M8.5 3A1.5 1.5 0 0 1 10 1.5H14A1.5 1.5 0 0 1 15.5 3V8.5H21A1.5 1.5 0 0 1 22.5 10V14A1.5 1.5 0 0 1 21 15.5H15.5V21'
    + 'A1.5 1.5 0 0 1 14 22.5H10A1.5 1.5 0 0 1 8.5 21V15.5H3A1.5 1.5 0 0 1 1.5 14V10A1.5 1.5 0 0 1 3 8.5H8.5Z';
const UP_ARM = 'M8.5 9V3A1.5 1.5 0 0 1 10 1.5H14A1.5 1.5 0 0 1 15.5 3V9Z';
const UP_ARROW = 'M12 3.6L14.6 7.1H9.4Z';
const ARM_LIT = '#3a4250';      // the arm a direction presses: a step up from the body
const arrow = (deg) => `<path d="${UP_ARROW}" fill="${LIT}" transform="rotate(${deg} 12 12)"/>`;
fs.writeFileSync(path.join(OUT, 'dpad.svg'), svg(24,
    `<path d="${CROSS}" fill="${BODY}" ${EDGE}/>` + [0, 90, 180, 270].map(arrow).join('')));
for (const [dir, deg] of [['up', 0], ['right', 90], ['down', 180], ['left', 270]]) {
    fs.writeFileSync(path.join(OUT, `dpad_${dir}.svg`), svg(24,
        `<path d="${CROSS}" fill="${BODY}" ${EDGE}/>`
        + `<path d="${UP_ARM}" fill="${ARM_LIT}" transform="rotate(${deg} 12 12)"/>` + arrow(deg)));
}

// ---- View and Menu ----
fs.writeFileSync(path.join(OUT, 'view.svg'), svg(24, DISC
    + `<rect x="6.4" y="7.4" width="7" height="6" rx="1.3" fill="none" stroke="${LIT}" stroke-width="1.4"/>`
    + `<rect x="10.6" y="10.6" width="7" height="6" rx="1.3" fill="${BODY}" stroke="${LIT}" stroke-width="1.4"/>`));
fs.writeFileSync(path.join(OUT, 'menu.svg'), svg(24, DISC
    + `<path d="M7.6 8.6H16.4M7.6 12H16.4M7.6 15.4H16.4" stroke="${LIT}" stroke-width="1.6" stroke-linecap="round"/>`));

console.log(fs.readdirSync(OUT).join(' '));
