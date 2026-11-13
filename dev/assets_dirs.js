// assets_dirs — where an area of whip's assets is on disk, across the whip_assets_N folders beside whip_core: the dev
// tools' half of shared/assets.lua. An area ('img/props', 'video/emotes') is in one of them, or split over several
// in runs of names (dev/assets_index.mjs). A tool that writes into an area asks assetDir; one that reads all of a
// split area asks assetDirs.
//
//   const { assetDir, assetDirs } = require('./assets_dirs.js');                 // CommonJS
//   import assets from './assets_dirs.js'; const { assetDir } = assets;          // from an .mjs
const fs = require('fs');
const path = require('path');

const RESOURCES = path.resolve(__dirname, '..', '..');

/** Every whip_assets_N folder, in order (absolute paths). */
function chunks() {
    return fs.readdirSync(RESOURCES, { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^whip_assets_\d+$/.test(e.name))
        .map((e) => e.name)
        .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
        .map((name) => path.join(RESOURCES, name));
}

/** The area's folder in every whip_assets_N that has it (absolute paths), in order. */
function assetDirs(area) {
    return chunks().map((c) => path.join(c, ...area.split('/'))).filter((d) => fs.existsSync(d));
}

/** The area's one folder. Stops the tool when no whip_assets_N has it, or several do (read those with assetDirs). */
function assetDir(area) {
    const dirs = assetDirs(area);
    if (dirs.length === 1) return dirs[0];
    console.error(dirs.length === 0
        ? `stopped: no whip_assets_N beside whip_core has ${area}/`
        : `stopped: ${area}/ is split over ${dirs.map((d) => path.relative(RESOURCES, d).split(path.sep)[0]).join(', ')};`
            + ' this tool works on one folder');
    process.exit(1);
}

module.exports = { RESOURCES, chunks, assetDirs, assetDir };
