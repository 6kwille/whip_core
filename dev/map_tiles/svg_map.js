// GTA V's map as shapes, for the pause menu's map — from https://gist.github.com/Regynate/01a82731994e592cbe5d7e1c1b055d33
//
//   node dev/map_tiles/svg_map.js <gtav-map.svg>
//
// Writes whip_media_map/map/gtav-map.js: `window.WHIP_MAP = { colours, polys }`, read by
// html/js/pause-map.js, which draws it on a canvas — sharp at every zoom, unlike the tiles.
//   colours  [[r, g, b], ...]                  the SVG's own fills; pause-map.js recolours them
//   polys    [colourIndex, x0, y0, x1, y1, ...] in the SVG's order (later ones on top)
// Points are GTA world metres (X east, Y north), to a tenth. A gradient fill (a few ramps) becomes
// the average of its stops. A script, not JSON: the page loads it with a <script> tag from
// a media pack, which a fetch across resources might not be allowed to do.
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
const OUT = path.join(require('../assets_dirs.js').assetDir('map'), 'gtav-map.js');   // in its media pack
if (!SRC || !fs.existsSync(SRC)) { console.error('usage: node dev/map_tiles/svg_map.js <gtav-map.svg>'); process.exit(1); }

const s = fs.readFileSync(SRC, 'utf8');
const grads = {};
for (const m of s.matchAll(/<linearGradient id="([^"]+)"[\s\S]*?<\/linearGradient>/g)) {
    const stops = [...m[0].matchAll(/stop-color:rgb\((\d+),(\d+),(\d+)\)/g)].map((x) => [+x[1], +x[2], +x[3]]);
    grads[m[1]] = stops.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
        .map((v) => Math.round(v / Math.max(1, stops.length)));
}

const colours = [], index = new Map(), polys = [];
for (const m of s.matchAll(/<polygon points="([^"]+)" fill="([^"]+)"/g)) {
    const g = m[2].match(/url\(#([^)]+)\)/);
    const c = g ? (grads[g[1]] || [150, 150, 150]) : m[2].match(/rgb\((\d+),(\d+),(\d+)\)/).slice(1).map(Number);
    const key = c.join(',');
    let ci = index.get(key);
    if (ci === undefined) { ci = colours.length; colours.push(c); index.set(key, ci); }
    const pts = m[1].trim().split(/\s+/).flatMap((p) => p.split(',').map((v) => Math.round(+v * 10) / 10));
    polys.push([ci, ...pts]);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, '// GTA V\'s map as shapes (whip_core/dev/map_tiles/svg_map.js). Rockstar\'s map, traced by the gist above.\n'
    + 'window.WHIP_MAP = ' + JSON.stringify({ colours, polys }) + ';\n');
console.log(colours.length + ' colours, ' + polys.length + ' shapes, '
    + (fs.statSync(OUT).size / 1048576).toFixed(2) + ' MB -> ' + OUT);
