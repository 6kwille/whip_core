// clothing_pictures — writes whip_core/data/clothing-pictures.json: which clothing items have a picture.
//
// The character editor shows apparel and accessories only where there is a picture (GTA's lists carry
// items that do not exist, and those have none). Knowing which means listing img/clothing/<body> (a
// media pack each: dev/assets_dirs.js finds them), and FXServer's Lua cannot list a folder. This lists
// them once, here, and whip_core reads the answer (server/clothing_pictures.lua) when it starts and
// whenever a media pack does. A server-side JavaScript file doing it at every start made FXServer
// enter whip_core every server frame for good. The list is whip_core's own, so the editor shows only
// real items even when their pictures' media pack is not running.
//
// RUN IT AGAIN after adding, removing or renaming clothing pictures (double-click "Rebuild clothing
// picture list.bat" in whip_media_clothing_male), then restart whip_core: it reads the new list then.
//
// What it writes:
//   { files, made, found }
//   found  { male = { components = { ['11'] = { base = '0-15,17,19-207', mp_m_2023_01 = '0-30' } },
//                     props = { ['0'] = { ... } } },
//            female = { ... } }
//          the item numbers each collection has a picture for, as ranges, per body and slot: the file
//          names' own parts, <body>_<slot | propN>_<collection>_<item>_<colour>.webp
//   files  how many pictures that is
//   made   when it was written (the server console says so, so an old list can be spotted)
//
// data/ is not in whip_core's `files`: players never download the list.
//
// Usage:  node dev/clothing_pictures.js
//   Not loaded by fxmanifest.lua.
const fs = require('fs');
const path = require('path');
const { assetDirs } = require('./assets_dirs.js');

const OUT = path.join(__dirname, '..', 'data', 'clothing-pictures.json');
const BODIES = ['male', 'female'];
const FILE = /^(male|female)_(prop)?(\d{1,2})_(.+)_(\d{3})_(\d{2})\.webp$/;

/** [0,1,2,3,5,7,8,9] → '0-3,5,7-9' */
function ranges(numbers) {
    const sorted = Array.from(numbers).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < sorted.length; i++) {
        const from = sorted[i];
        while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
        out.push(from === sorted[i] ? String(from) : `${from}-${sorted[i]}`);
    }
    return out.join(',');
}

function scan() {
    const sets = {};
    let files = 0, read = 0;
    // Each body's folder wherever it is (in more than one media pack, should it ever be split)
    const places = [];
    for (const body of BODIES) for (const dir of assetDirs('img/clothing/' + body)) places.push({ body, dir });
    for (const { body, dir } of places) {
        let folders;
        try {
            folders = fs.readdirSync(dir, { withFileTypes: true });
        } catch (err) {
            console.error(`could not read ${dir}: ${err.code || err.message}`);
            continue;
        }
        read++;
        for (const folder of folders) {
            if (!folder.isDirectory()) continue;
            for (const name of fs.readdirSync(path.join(dir, folder.name))) {
                const m = FILE.exec(name);
                if (!m || m[1] !== body) continue;
                const kind = m[2] ? 'props' : 'components';
                const slot = String(Number(m[3]));
                const b = sets[body] || (sets[body] = { components: {}, props: {} });
                const s = b[kind][slot] || (b[kind][slot] = {});
                (s[m[4]] || (s[m[4]] = new Set())).add(Number(m[5]));
                files++;
            }
        }
    }
    if (read === 0) return null;

    const found = {};
    for (const body of Object.keys(sets)) {
        found[body] = { components: {}, props: {} };
        for (const kind of ['components', 'props']) {
            for (const slot of Object.keys(sets[body][kind])) {
                const out = found[body][kind][slot] = {};
                for (const [collection, items] of Object.entries(sets[body][kind][slot])) out[collection] = ranges(items);
            }
        }
    }
    return { files, found };
}

const result = scan();
if (!result) {
    console.error('stopped: no media pack beside whip_core has img/clothing/male or img/clothing/female');
    process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const made = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
fs.writeFileSync(OUT, JSON.stringify({ files: result.files, made, found: result.found }));
console.log(`wrote ${OUT}: ${result.files} clothing pictures, ${fs.statSync(OUT).size} bytes`);
