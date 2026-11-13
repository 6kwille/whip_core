// tattoo_list — writes shared/tattoo_list.lua, the tattoos the character editor offers (TattooList).
//
// From DurtyFree's pedOverlayCollections.json (github.com/DurtyFree/gta-v-data-dumps), downloaded anywhere.
// It is a dump of the NEWEST game, so it can name tattoos an older game build does not have: the editor
// asks the game about each one (client/appearance.lua, tattoosFor) and offers only those it knows.
//
// Kept: every TYPE_TATTOO decoration of the freemode bodies. Left out:
//   - badges (TYPE_BADGE): crew emblems and the prints that go on a shirt, not on skin
//   - singleplayer_overlays: Michael's, Franklin's and Trevor's
//   - hair fades (the hairOverlay group, and the *_Hair_* items without one): they are not tattoos but the
//     Hair tab's fades (dev/hair_fades.js)
//   - the crew tattoos (MP_Male_Crew_Tat_*, MP_Female_Crew_Tat_*): they draw the player's Social Club
//     crew emblem
//
// THE NAMES are dev/tattoo_names.json, from 3D Clanker:{ "<overlay>": "<English name>" | null },
// read from the game's shop_tattoo.meta labels and its American text (a label the game defines twice
// takes its own pack's text: the base game reuses three Beach labels for jackets). The base game's
// tattoos have none (its shop is defined in script, not in data), nor do mpHeist3_Tat_042..044; those
// show their number instead.
//
// Usage:  node dev/tattoo_list.js <pedOverlayCollections.json> [out file]
//   The out file defaults to ..\shared\tattoo_list.lua. Not loaded by fxmanifest.lua.
const fs = require('fs');
const path = require('path');
if (!process.argv[2]) { console.error('usage: node tattoo_list.js <pedOverlayCollections.json> [out file]'); process.exit(2); }
const collections = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3] || path.join(__dirname, '..', 'shared', 'tattoo_list.lua');
const NAMES_FILE = path.join(__dirname, 'tattoo_names.json');
const names = fs.existsSync(NAMES_FILE) ? JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8')) : {};

const nameOf = (overlay) => {
    const n = names[overlay];
    return typeof n === 'string' && n.trim() ? n.trim() : '';
};

const ZONE = {
    ZONE_HEAD: 'head', ZONE_TORSO: 'torso', ZONE_LEFT_ARM: 'larm', ZONE_RIGHT_ARM: 'rarm',
    ZONE_LEFT_LEG: 'lleg', ZONE_RIGHT_LEG: 'rleg',
};
const BODY = { GENDER_MALE: 'm', GENDER_FEMALE: 'f', GENDER_DONTCARE: 'mf' };
const FACING = {
    TATTOO_FRONT: 'front', TATTOO_BACK: 'back', TATTOO_LEFT: 'left', TATTOO_RIGHT: 'right',
    TATTOO_FRONT_LEFT: 'frontleft', TATTOO_FRONT_RIGHT: 'frontright', TATTOO_CHEST: 'chest', TATTOO_STOMACH: 'stomach',
};

// A collection's name in words, tidied the way the editor tidies a clothing collection's: the base game's is
// 'Base game', the rest lose 'mp' and '_overlays' and are split at capitals and numbers
// ('mpImportExport_overlays' → 'Import Export', 'mpChristmas2017_overlays' → 'Christmas 2017').
function labelOf(name) {
    if (name === 'multiplayer_overlays') return 'Base game';
    const words = name.replace(/^mp/, '').replace(/_overlays$/, '').replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

const lua = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const used = [];          // collections with at least one tattoo kept, in the dump's order
const rows = [];
const seen = new Set();
const count = { m: 0, f: 0, mf: 0 };
let named = 0;
for (const c of collections) {
    if (c.CollectionName === 'singleplayer_overlays') continue;
    const keep = (c.Overlays || []).filter(o => o.Type === 'TYPE_TATTOO'
        && o.UpdateGroup !== 'hairOverlay' && !/_Hair_|^Hair_|_Hair$/i.test(o.OverlayName)
        && !/^MP_(Male|Female)_Crew_Tat_/i.test(o.OverlayName));
    if (!keep.length) continue;
    used.push(c.CollectionName);
    const ci = used.length;
    for (const o of keep) {
        const zone = ZONE[o.ZoneName], body = BODY[o.Gender];
        if (!zone || !body) { console.error(`stopped: ${c.CollectionName} ${o.OverlayName} has zone ${o.ZoneName}, gender ${o.Gender}`); process.exit(1); }
        const key = (c.CollectionName + '/' + o.OverlayName).toLowerCase();
        if (seen.has(key)) { console.error(`stopped: ${key} is listed twice`); process.exit(1); }
        seen.add(key);
        if (!/^[A-Za-z0-9_]+$/.test(o.OverlayName)) { console.error(`stopped: ${o.OverlayName} is not a plain name`); process.exit(1); }
        const name = nameOf(o.OverlayName);
        if (name) named++;
        rows.push(`        { ${ci}, ${lua(o.OverlayName)}, '${zone}', '${body}', '${FACING[o.Facing] || ''}', ${lua(name)} },`);
        count[body]++;
    }
}

const out = `-- ============================================
-- TATTOOS — the ones the character editor offers (TattooList)
-- ============================================
--
-- WRITTEN BY dev/tattoo_list.js from DurtyFree's gta-v-data-dumps pedOverlayCollections.json and the
-- names in dev/tattoo_names.json; run it again rather than editing this by hand. ${rows.length} tattoos:
-- ${count.m} for the male body, ${count.f} for the female, ${count.mf} for both; ${named} with a name. Badges,
-- Michael's, Franklin's and Trevor's, hair fades and the crew tattoos are left out (see the script).
-- Each has a picture in whip_assets/img/tattoos/<overlay name, lower case>.webp.
--
-- The dump is of the newest game, so the editor asks the game about each tattoo and offers only the
-- ones this game build has (client/appearance.lua, tattoosFor); the server takes only a tattoo named
-- here, on the body it is for (server/events_misc.lua, sanitizeAppearance). Data only.
--
-- collections   the decoration collections, in the game's own order (the base game's first)
-- list          one tattoo a line: { collection (its place in collections), overlay name,
--               zone ('head' | 'torso' | 'larm' | 'rarm' | 'lleg' | 'rleg'),
--               body ('m' | 'f' | 'mf'),
--               facing (the side it is on: 'front', 'back', 'left', 'right', 'frontleft', 'frontright',
--                       'chest', 'stomach', or '' when the game does not say),
--               name (its English name in the game's tattoo shops, or '' when it has none) }
-- A saved tattoo is { collection = <name>, overlay = <name> } in the character's appearance.

TattooList = {
    collections = {
${used.map(n => `        { name = ${lua(n)}, label = ${lua(labelOf(n))} },`).join('\n')}
    },
    list = {
${rows.join('\n')}
    },
}
`;
fs.writeFileSync(OUT, out);
console.log(`wrote ${OUT}: ${used.length} collections, ${rows.length} tattoos (m ${count.m}, f ${count.f}, both ${count.mf}), ${named} named`);
