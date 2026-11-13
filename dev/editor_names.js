// editor_names — writes html/js/editor-names.js, the names the character editor shows under its cards
// (window.WHIP_EDITOR_NAMES), from dev/editor_names.json.
//
// editor_names.json is 3D Clanker's, read from the game's own text: { "<key>": "<English name>" | null }
//   <gender>_<slot>_<collection>_<item>_<colour>   a clothing or hair picture's name (html/js/utils.js,
//                                                clothingPictureName): 'male_11_mp_m_vinewood_004_00'
//   overlay_<id>_<value>                         a face overlay's style, id = GTA's head overlay index
//   parent_<0..45>                               a heritage parent
// null where the game has no name; the card then shows its number. Tattoos' names are not here: they
// are in shared/tattoo_list.lua (dev/tattoo_list.js).
//
// In whip_core (Josh, 30 Oct 2026), not with the pictures: the names show even when a media pack is not
// running. It costs 1.5 MB more in every whip_core download. A classic script rather than JSON, loaded
// the first time the editor opens (html/js/creator.js loadNames).
//
// Usage:  node dev/editor_names.js [out file]   (default ..\html\js\editor-names.js)
//   Not loaded by fxmanifest.lua.
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'editor_names.json');
const OUT = process.argv[2] || path.join(__dirname, '..', 'html', 'js', 'editor-names.js');

const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const KEY = /^((male|female)_(prop)?\d+_[a-z0-9_]+_\d{3}_\d{2}|overlay_\d+_\d+|parent_\d+)$/;
const names = {};
let dropped = 0;
for (const [key, name] of Object.entries(all)) {
    if (!KEY.test(key)) { console.error(`stopped: "${key}" is not a key the editor asks for`); process.exit(1); }
    if (typeof name === 'string' && name.trim()) names[key] = name.trim();
    else dropped++;
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
// Accents written as \u escapes ("Güffy"), so the names read right whatever character set the
// script is served with.
const body = JSON.stringify(names).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
fs.writeFileSync(OUT, '// The character editor\'s names, written by whip_core/dev/editor_names.js from 3D Clanker\'s\n'
    + '// editor_names.json (the game\'s own text). Do not edit by hand: change the JSON and run it again.\n'
    + 'window.WHIP_EDITOR_NAMES = ' + body + ';\n');
console.log(`wrote ${OUT}: ${Object.keys(names).length} names (${dropped} without one left out), ${fs.statSync(OUT).size} bytes`);
