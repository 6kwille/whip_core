// hair_fades — writes shared/hair_fades.lua, the hair fades the character editor offers (HairFades).
//
// From DurtyFree's pedOverlayCollections.json (github.com/DurtyFree/gta-v-data-dumps), downloaded anywhere: the
// same dump dev/tattoo_list.js reads. A fade is a decoration drawn on the scalp, as a tattoo is drawn on the skin:
// the shaved stubble under a short hairstyle. GTA Online puts one on with each hairstyle at the barber; in whip
// the player picks it (any fade, any hairstyle, or none). The dump is of the newest game, so the editor asks
// the game about each one (client/appearance.lua, fadesFor) and offers only those it knows.
//
// Kept: every decoration of the hairOverlay group, and the other *_Hair_* ones (the same test tattoo_list.js
// leaves them out by), but not Michael's, Franklin's and Trevor's (singleplayer_overlays). The body is the
// dump's, and for one it gives to both the overlay's name says it (NG_M_Hair_001 is the male body's); a name
// that does not say (FM_Hair_Fuzz) is for both. Fades have no names in the game (they are sold with their
// hairstyle) and no pictures: the editor numbers them.
//
// Usage:  node dev/hair_fades.js <pedOverlayCollections.json> [out file]
//   The out file defaults to ..\shared\hair_fades.lua. Not loaded by fxmanifest.lua.
const fs = require('fs');
const path = require('path');
if (!process.argv[2]) { console.error('usage: node hair_fades.js <pedOverlayCollections.json> [out file]'); process.exit(2); }
const collections = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3] || path.join(__dirname, '..', 'shared', 'hair_fades.lua');

// As tattoo_list.js labels a collection: 'multiplayer_overlays' → 'Base game', 'mpBiker_overlays' → 'Biker'.
function labelOf(name) {
    if (name === 'multiplayer_overlays') return 'Base game';
    const words = name.replace(/^mp/, '').replace(/_overlays$/, '').replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function bodyOf(o) {
    if (o.Gender === 'GENDER_MALE') return 'm';
    if (o.Gender === 'GENDER_FEMALE') return 'f';
    if (o.Gender !== 'GENDER_DONTCARE') return null;
    if (/_M_|_M$/.test(o.OverlayName)) return 'm';
    if (/_F_|_F$/.test(o.OverlayName)) return 'f';
    return 'mf';
}

const lua = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const used = [];
const rows = [];
const seen = new Set();
const count = { m: 0, f: 0, mf: 0 };
for (const c of collections) {
    if (c.CollectionName === 'singleplayer_overlays') continue;
    const keep = (c.Overlays || []).filter(o => o.UpdateGroup === 'hairOverlay' || /_Hair_|^Hair_|_Hair$/i.test(o.OverlayName));
    if (!keep.length) continue;
    used.push(c.CollectionName);
    const ci = used.length;
    for (const o of keep) {
        const body = bodyOf(o);
        if (!body || o.ZoneName !== 'ZONE_HEAD') { console.error(`stopped: ${c.CollectionName} ${o.OverlayName} has zone ${o.ZoneName}, gender ${o.Gender}`); process.exit(1); }
        const key = (c.CollectionName + '/' + o.OverlayName).toLowerCase();
        if (seen.has(key)) { console.error(`stopped: ${key} is listed twice`); process.exit(1); }
        seen.add(key);
        if (!/^[A-Za-z0-9_]+$/.test(o.OverlayName)) { console.error(`stopped: ${o.OverlayName} is not a plain name`); process.exit(1); }
        rows.push(`        { ${ci}, ${lua(o.OverlayName)}, '${body}' },`);
        count[body]++;
    }
}

const out = `-- ============================================
-- HAIR FADES — the ones the character editor offers (HairFades)
-- ============================================
--
-- WRITTEN BY dev/hair_fades.js from DurtyFree's gta-v-data-dumps pedOverlayCollections.json; run it again
-- rather than editing this by hand. ${rows.length} fades: ${count.m} for the male body, ${count.f} for the female, ${count.mf} for both.
-- A fade is a decoration drawn on the scalp (the shaved stubble under a short hairstyle), put on as a
-- tattoo is. The player picks one, or none, on the editor's Hair tab; the game gives them no names and
-- whip has no pictures of them, so the editor numbers them.
--
-- The dump is of the newest game, so the editor asks the game about each fade and offers only the ones
-- this game build has (client/appearance.lua, fadesFor); the server takes only a fade named here, on the
-- body it is for (server/events_misc.lua, sanitizeAppearance). Data only.
--
-- collections   the decoration collections, in the game's own order (the base game's first)
-- list          one fade a line: { collection (its place in collections), overlay name, body ('m' | 'f' | 'mf') }
-- A saved fade is hairFade = { collection = <name>, overlay = <name> } in the character's appearance.

HairFades = {
    collections = {
${used.map(n => `        { name = ${lua(n)}, label = ${lua(labelOf(n))} },`).join('\n')}
    },
    list = {
${rows.join('\n')}
    },
}
`;
fs.writeFileSync(OUT, out);
console.log(`wrote ${OUT}: ${used.length} collections, ${rows.length} fades (m ${count.m}, f ${count.f}, both ${count.mf})`);
