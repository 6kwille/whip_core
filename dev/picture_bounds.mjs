#!/usr/bin/env node
// ============================================
// picture_bounds — where the thing is in each of the media packs' pictures
// ============================================
//
// A picture of a prop, a car or a ped is the thing on nothing, with room round it: a bed is wide and flat in a
// square picture, a ped is a narrow figure in a tall one. Shown whole in a box, the thing is small. This finds
// the box round what is drawn in each (its pixels that are not see-through) and writes them to
// html/js/picture-bounds.js, which utils.js fitPicture reads to show the thing itself as big as its box allows.
//
//   node dev/picture_bounds.mjs              all three folders (about 3,000 pictures: a few minutes)
//   FFMPEG=C:/path/ffmpeg.exe node dev/...   when ffmpeg is not on the PATH
//
// Run it again after new pictures are added; a picture it has no bounds for is shown whole.
// Needs ffmpeg (it reads the WebP pictures). Nothing is written into the media packs.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assets from './assets_dirs.js';   // the media packs' folders: every one holding an area is read

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(HERE, '..');
const OUT = path.join(CORE, 'html', 'js', 'picture-bounds.js');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const SIZE = 200;            // read at this size: plenty for a box to the nearest half percent
// Alpha above this (of 255) is the thing. High on purpose: a car's and a ped's soft ground shadow runs wide of
// them, see-through (mostly under 160); the thing itself is solid.
const SOLID = 200;
const JOBS = 8;
const FOLDERS = { props: 'p', vehicles: 'v', peds: 'n' };

/** The drawn box of one picture, in thousandths of its width and height: [x0, y0, x1, y1], or null. */
function bounds(file) {
    return new Promise((resolve) => {
        const ff = spawn(FFMPEG, ['-v', 'error', '-i', file, '-vf', `scale=${SIZE}:${SIZE}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
            { stdio: ['ignore', 'pipe', 'ignore'] });
        const parts = [];
        ff.stdout.on('data', (d) => parts.push(d));
        ff.on('error', () => resolve(null));
        ff.on('close', () => {
            const px = Buffer.concat(parts);
            if (px.length < SIZE * SIZE * 4) return resolve(null);
            let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
            for (let y = 0; y < SIZE; y++) {
                for (let x = 0; x < SIZE; x++) {
                    if (px[(y * SIZE + x) * 4 + 3] > SOLID) {
                        if (x < x0) x0 = x; if (x > x1) x1 = x;
                        if (y < y0) y0 = y; if (y > y1) y1 = y;
                    }
                }
            }
            if (x1 < 0) return resolve(null);
            const k = 1000 / SIZE;
            resolve([Math.floor(x0 * k), Math.floor(y0 * k), Math.ceil((x1 + 1) * k), Math.ceil((y1 + 1) * k)]);
        });
    });
}

const out = {};
let done = 0, none = 0, total = 0;
const jobs = [];
for (const [folder, key] of Object.entries(FOLDERS)) {
    out[key] = {};
    for (const dir of assets.assetDirs('img/' + folder)) {
        for (const f of fs.readdirSync(dir)) {
            if (!f.toLowerCase().endsWith('.webp')) continue;
            jobs.push({ key, model: f.slice(0, -5).toLowerCase(), file: path.join(dir, f) });
        }
    }
}
total = jobs.length;
let next = 0;
async function worker() {
    while (next < jobs.length) {
        const j = jobs[next++];
        const b = await bounds(j.file);
        if (b) out[j.key][j.model] = b; else none++;
        if (++done % 250 === 0) process.stdout.write(`  ${done} / ${total}\n`);
    }
}
await Promise.all(Array.from({ length: JOBS }, worker));

// Sorted, so a run over the same pictures writes the same file.
for (const key of Object.keys(out)) out[key] = Object.fromEntries(Object.entries(out[key]).sort(([a], [b]) => (a < b ? -1 : 1)));
const body = Object.entries(out).map(([key, list]) =>
    `    ${key}: {\n` + Object.entries(list).map(([m, b]) => `        '${m}': [${b.join(', ')}],`).join('\n') + '\n    },').join('\n');
fs.writeFileSync(OUT, `// ============================================
// PICTURE BOUNDS — where the thing is in each of the media packs' pictures (made by dev/picture_bounds.mjs)
// ============================================
//
// For each picture of a prop (p), a car (v) and a ped (n), by model: the box round what is drawn in it,
// [left, top, right, bottom] in thousandths of the picture. utils.js fitPicture shows that box as big as its
// place allows. A picture not here is shown whole. MADE, NOT WRITTEN: run the script again for new pictures.

export const BOUNDS = {
${body}
};
`);
console.log(`\n${total - none} pictures measured, ${none} with nothing drawn or unreadable -> ${path.relative(CORE, OUT)}`);
