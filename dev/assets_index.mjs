#!/usr/bin/env node
// ============================================
// assets_index — which media pack holds which pictures, videos and map files
// ============================================
//
// whip's media is split into resources of at most 256 MB each, by category (Josh, 30 Oct 2026), the media packs:
// whip_media_clothing_male and whip_media_clothing_female (the character editor's clothing pictures), whip_media_props
// (the furniture pictures), whip_media_previews (vehicles, NPCs, tattoos, emote videos) and whip_media_map (the map,
// blip icons, the minimap's tiles). A category that outgrows its pack carries on in a new one (whip_media_props_2 ...),
// never mixed in with another big one. A media pack is any resource whose fxmanifest.lua says whip_media_pack 'yes'.
//
// This finds the media packs beside whip_core and in [category] folders there (dev/assets_dirs.js) and writes where
// each AREA (below) is:
//   shared/assets_index.lua   for Lua (shared/assets.lua answers WhipAssets.resourceFor(path))
//   html/js/assets-index.js   for the NUI (html/js/assets.js answers whipAssetUrl(path))
// and prints each pack's size, warning past 256 MB (stream/ is left out: streamed files download one by one).
//
//   node dev/assets_index.mjs
//
// RUN IT AGAIN after moving files between media packs, adding a new one or renaming one. New pictures in a folder
// that is already there need nothing (they are found by the folder they are in).
//
// AN AREA SPLIT OVER SEVERAL PACKS (img/props when it outgrows whip_media_props): each must hold one run of names in
// sorted order (a to m in one, n to z in the next), so a name says which. Each pack's run starts at its first name
// ("from"); a new name goes to the last pack whose run starts at or before it. Interleaved names stop it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assets from './assets_dirs.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(HERE, '..');
const CAP_MB = 256;

/** Every folder of media whip reads, by its path inside a media pack. A new kind needs a line here. */
const AREAS = [
    'img/clothing/male',     // the character editor's clothing pictures, male body
    'img/clothing/female',   // ... female body (their names and which have a picture are whip_core's own)
    'img/props',             // the furniture catalog's pictures
    'img/vehicles',          // vehicle pictures
    'img/peds',              // NPC pictures
    'img/tattoos',           // tattoo pictures
    'img/blips',             // GTA's blip icons
    'video/emotes',          // the emote menu's preview videos
    'map',                   // the 3D map's data (and the 2D map's sources, not sent)
    'stream',                // the HUD radar's tiles (Legacy)
    'stream_enhanced',       // ... (Enhanced)
];

function filesUnder(dir) {
    const out = [];
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p); else out.push(p);
        }
    };
    walk(dir);
    return out;
}

const packs = assets.packs();
const chunks = packs.map((p) => p.name);
if (chunks.length === 0) {
    console.error(`no media pack (whip_media_pack 'yes' in its fxmanifest.lua) in ${assets.RESOURCES} or its [folders]`);
    process.exit(1);
}

// [area] = [{ resource, names (sorted, inside the area), first }]
const where = {};
const sizes = {};
for (const { name: res, dir: root } of packs) {
    let bytes = 0;
    for (const f of filesUnder(root)) {
        // Streamed files are each their own download, not part of the resource's one file. A dot folder (.git:
        // each pack is its own repository) is not sent at all.
        if (/^(stream(_enhanced)?|\..*)$/.test(path.relative(root, f).split(path.sep)[0])) continue;
        bytes += fs.statSync(f).size;
    }
    sizes[res] = bytes;
    for (const area of AREAS) {
        const dir = path.join(root, ...area.split('/'));
        if (!fs.existsSync(dir)) continue;
        const names = filesUnder(dir).map((f) => path.relative(dir, f).split(path.sep).join('/').toLowerCase()).sort();
        if (names.length === 0) continue;
        (where[area] = where[area] || []).push({ resource: res, names });
    }
    // Something in a resource no area names: whip would never find it
    const known = new Set(AREAS.map((a) => a.split('/')[0]));
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
        if (e.isDirectory() && !e.name.startsWith('.') && !known.has(e.name)) console.log(`  ! ${res}/${e.name}/ is in no area: add it to AREAS or move it`);
    }
}

// Each area's resources in name order, each one run of names: [{ resource, dir, from? }]
const entries = [];
let bad = false;
for (const area of AREAS) {
    const list = where[area];
    if (!list) { console.log(`  - ${area}: in no media pack`); continue; }
    list.sort((a, b) => (a.names[0] < b.names[0] ? -1 : 1));
    for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (i > 0 && c.names[0] <= list[i - 1].names[list[i - 1].names.length - 1]) {
            console.error(`  ${area}: ${list[i - 1].resource} and ${c.resource} hold names in among each other's;`
                + ' move files so each holds one run of names (see the top of this file)');
            bad = true;
        }
        entries.push(i === 0 ? { resource: c.resource, dir: area } : { resource: c.resource, dir: area, from: c.names[0] });
    }
}
if (bad) process.exit(1);

const lua = [
    '-- GENERATED by dev/assets_index.mjs from the media packs\' folders: which pack holds each area of whip\'s',
    '-- pictures, videos and map files. Do not edit by hand: move the files, then run the script again.',
    '--',
    '-- { resource, dir, from }: `dir` is a folder inside the resource; `from` (an area split over several resources)',
    '-- is the first name in it, in sorted order. shared/assets.lua reads this (WhipAssets.resourceFor).',
    '',
    'WhipAssets = {',
    '    chunks = {',
    ...entries.map((e) => `        { resource = '${e.resource}', dir = '${e.dir}'${e.from ? `, from = '${e.from.replace(/'/g, "\\'")}'` : ''} },`),
    '    },',
    '}',
    '',
].join('\n');
fs.writeFileSync(path.join(CORE, 'shared', 'assets_index.lua'), lua);

const js = [
    '// GENERATED by dev/assets_index.mjs from the media packs\' folders: which pack holds each area of whip\'s',
    '// pictures, videos and map files. Do not edit by hand: move the files, then run the script again.',
    '// A plain script (no import or export), so a page loads it with <script> and a module with import: js/assets.js',
    '// reads it (whipAssetUrl).',
    '',
    'globalThis.WHIP_ASSET_CHUNKS = [',
    ...entries.map((e) => `    { resource: '${e.resource}', dir: '${e.dir}'${e.from ? `, from: ${JSON.stringify(e.from)}` : ''} },`),
    '];',
    '',
].join('\n');
fs.writeFileSync(path.join(CORE, 'html', 'js', 'assets-index.js'), js);

console.log(`${entries.length} areas in ${chunks.length} resources -> shared/assets_index.lua, html/js/assets-index.js`);
for (const res of chunks) {
    const mb = sizes[res] / 1048576;
    const areas = entries.filter((e) => e.resource === res).map((e) => e.dir + (e.from ? ` (from ${e.from})` : ''));
    console.log(`  ${res.padEnd(28)} ${mb.toFixed(1).padStart(7)} MB  ${areas.join(', ')}${mb > CAP_MB ? `   ! OVER ${CAP_MB} MB: move part of it into a new media pack` : ''}`);
}
