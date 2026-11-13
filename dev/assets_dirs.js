// assets_dirs — where an area of whip's media is on disk, across the media packs: the dev tools' half of
// shared/assets.lua. A media pack is a resource whose fxmanifest.lua says `whip_media_pack 'yes'` (whip_media_props,
// whip_media_map, ...), beside whip_core or in a [category] folder there ([whip]/[assets]). An area ('img/props',
// 'video/emotes') is in one of them, or split over several in runs of names (dev/assets_index.mjs). A tool that writes
// into an area asks assetDir; one that reads all of a split area asks assetDirs.
//
//   const { assetDir, assetDirs } = require('./assets_dirs.js');                 // CommonJS
//   import assets from './assets_dirs.js'; const { assetDir } = assets;          // from an .mjs
const fs = require('fs');
const path = require('path');

const RESOURCES = path.resolve(__dirname, '..', '..');
const MARKER = /^\s*whip_media_pack\s/m;

/** Every media pack: { name, dir } (dir absolute), by name. Looks beside whip_core and into [category] folders. */
function packs() {
    const out = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            const full = path.join(dir, e.name);
            if (/^\[.*\]$/.test(e.name)) { walk(full); continue; }
            const manifest = path.join(full, 'fxmanifest.lua');
            if (fs.existsSync(manifest) && MARKER.test(fs.readFileSync(manifest, 'utf8'))) out.push({ name: e.name, dir: full });
        }
    };
    walk(RESOURCES);
    return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Every media pack's folder (absolute paths), by name. */
function chunks() {
    return packs().map((p) => p.dir);
}

/** The area's folder in every media pack that has it (absolute paths). */
function assetDirs(area) {
    return chunks().map((c) => path.join(c, ...area.split('/'))).filter((d) => fs.existsSync(d));
}

/** The area's one folder. Stops the tool when no media pack has it, or several do (read those with assetDirs). */
function assetDir(area) {
    const dirs = assetDirs(area);
    if (dirs.length === 1) return dirs[0];
    const packOf = (d) => packs().find((p) => d.startsWith(p.dir + path.sep)).name;
    console.error(dirs.length === 0
        ? `stopped: no media pack (whip_media_pack in its fxmanifest.lua) near whip_core has ${area}/`
        : `stopped: ${area}/ is split over ${dirs.map(packOf).join(', ')}; this tool works on one folder`);
    process.exit(1);
}

module.exports = { RESOURCES, packs, chunks, assetDirs, assetDir };
