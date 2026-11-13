// whip's dark MINIMAP — GTA's six radar tiles, drawn from the pause menu's vector map.
//
//   node dev/map_tiles/minimap_tiles.js [size]        size: px per tile, default 4096 (GTA's own)
//
// Writes whip_media_map/stream/whipmap_<row>_<col>.ytd (one texture each, named the same), which
// client/hud_skin.lua swaps in over GTA's minimap_sea_<row>_<col> while Config.HudSkin is 'black'.
// Also writes whip_core/stream/whiphud.ytd: 'disc', the white circle the minimap frame's corners are.
//
// THE GRID IS GTA's (minimap.ymt): two columns, three rows, each 4500 m square, from (-4140, 8400) at
// the top left; row 0 is the north. The shapes are whip_media_map/map/gtav-map.js (dev/map_tiles/
// svg_map.js), already in GTA world metres. THE COLOURS ARE THE PAUSE MENU'S (html/js/pause-map.js, C
// and whipColour): change them there and here together, and bake again.
//
// Headless Chrome draws (as bake.js); C:\Tools\whip\ytdpack (CodeWalker.Core + BCnEncoder.Net) packs.
// Scratch files go to the system temp folder and are removed after.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const YTDPACK = 'C:/Tools/whip/ytdpack/bin/Release/net10.0-windows/ytdpack.exe';
const RES = path.resolve(__dirname, '..', '..', '..');
const { assetDir } = require('../assets_dirs.js');   // the media pack holding each
const MAP_JS = path.join(assetDir('map'), 'gtav-map.js');
const OUT_TILES = assetDir('stream');
const OUT_HUD = path.join(RES, 'whip_core', 'stream');
const SIZE = parseInt(process.argv[2] || '4096', 10);
const TILE_M = 4500, X0 = -4140, Y0 = 8400;
const TILES = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]];
const STRIP = 512;   // rows read back at a time

const PORT = 9533 + Math.floor(Math.random() * 300);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'whip-minimap-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The page: the pause menu's colours (pause-map.js), and a function drawing one tile.
const PAGE = `
const C = {
    land:   [17, 20, 25],   build:  [43, 48, 58],    build2: [53, 59, 71],   path: [76, 83, 96],
    road:   [126, 134, 147], hwy:   [164, 172, 186], deep:   [8, 14, 23],    shore: [24, 39, 58],
};
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * Math.max(0, Math.min(1, t))));
const GREYS = [[35, C.land], [65, C.build], [99, C.build2], [130, C.path], [180, C.road], [220, C.hwy]];
function whipColour([r, g, b]) {
    if (b > r + 6) return mix(C.deep, C.shore, ((r + g + b) / 765 - 0.25) / 0.62);
    const v = (r + g + b) / 3;
    if (v <= GREYS[0][0]) return GREYS[0][1];
    for (let i = 1; i < GREYS.length; i++) {
        if (v <= GREYS[i][0]) return mix(GREYS[i - 1][1], GREYS[i][1], (v - GREYS[i - 1][0]) / (GREYS[i][0] - GREYS[i - 1][0]));
    }
    return C.hwy;
}
const css = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
const FILLS = WHIP_MAP.colours.map((c) => css(whipColour(c)));
const POLYS = WHIP_MAP.polys;
const canvas = document.createElement('canvas');
const g = canvas.getContext('2d', { willReadFrequently: true });
window.drawTile = (row, col, size) => {
    canvas.width = canvas.height = size;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = css(C.deep);
    g.fillRect(0, 0, size, size);
    const k = size / ${TILE_M};
    const x0 = ${X0} + col * ${TILE_M}, yTop = ${Y0} - row * ${TILE_M};
    g.setTransform(k, 0, 0, -k, -x0 * k, yTop * k);   // world metres -> tile px (y down)
    const m = 50, xa = x0 - m, xb = x0 + ${TILE_M} + m, yb = yTop + m, ya = yTop - ${TILE_M} - m;
    let n = 0;
    for (const p of POLYS) {
        let inside = false;
        for (let j = 1; j < p.length; j += 2) {
            const x = p[j], y = p[j + 1];
            if (x >= xa && x <= xb && y >= ya && y <= yb) { inside = true; break; }
        }
        if (!inside) continue;
        g.fillStyle = FILLS[p[0]];
        g.beginPath();
        g.moveTo(p[1], p[2]);
        for (let j = 3; j < p.length; j += 2) g.lineTo(p[j], p[j + 1]);
        g.closePath();
        g.fill();
        n++;
    }
    return n;
};
window.readStrip = (y, h) => {
    const d = g.getImageData(0, y, canvas.width, h).data;
    let s = '';
    for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    return btoa(s);
};
window.preview = (px) => {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    c.getContext('2d').drawImage(canvas, 0, 0, px, px);
    return c.toDataURL('image/png').split(',')[1];
};
true`;

function pack(rgbaFile, w, h, name, outYtd, fmt) {
    const out = execFileSync(YTDPACK, ['pack', rgbaFile, String(w), String(h), name, outYtd, fmt], { encoding: 'utf8' });
    process.stdout.write('  ' + out);
}

// The frame's disc: a white circle, its edge a pixel of antialiasing.
function makeDisc() {
    const S = 256, r = S / 2 - 1, px = Buffer.alloc(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2);
        const a = Math.max(0, Math.min(1, r - d + 0.5));
        const i = (y * S + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 255;
        px[i + 3] = Math.round(a * 255);
    }
    const f = path.join(TMP, 'disc.rgba');
    fs.writeFileSync(f, px);
    fs.mkdirSync(OUT_HUD, { recursive: true });
    pack(f, S, S, 'disc', path.join(OUT_HUD, 'whiphud.ytd'), 'bc3');
}

(async () => {
    if (!fs.existsSync(MAP_JS)) throw new Error('no ' + MAP_JS + ' (node dev/map_tiles/svg_map.js makes it)');
    if (!fs.existsSync(YTDPACK)) throw new Error('no ' + YTDPACK + ' (dotnet build -c Release in C:\\Tools\\whip\\ytdpack)');
    console.log('the frame\'s disc:');
    makeDisc();

    const profile = path.join(TMP, 'chrome');
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
        '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
    let wsUrl;
    for (let i = 0; i < 60 && !wsUrl; i++) {
        await sleep(250);
        try { const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); const p = l.find((t) => t.type === 'page'); if (p) wsUrl = p.webSocketDebuggerUrl; } catch (_) {}
    }
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params: params || {} })); });
    const js = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
        return r.result.result.value;
    };

    await send('Runtime.enable');
    await js(fs.readFileSync(MAP_JS, 'utf8') + '\ntrue');
    await js(PAGE);

    fs.mkdirSync(OUT_TILES, { recursive: true });
    for (const [row, col] of TILES) {
        const name = 'whipmap_' + row + '_' + col;
        const n = await js(`drawTile(${row}, ${col}, ${SIZE})`);
        const file = path.join(TMP, name + '.rgba');
        const fd = fs.openSync(file, 'w');
        for (let y = 0; y < SIZE; y += STRIP) {
            fs.writeSync(fd, Buffer.from(await js(`readStrip(${y}, ${Math.min(STRIP, SIZE - y)})`), 'base64'));
        }
        fs.closeSync(fd);
        fs.writeFileSync(path.join(TMP, name + '.png'), Buffer.from(await js('preview(1024)'), 'base64'));
        console.log(name + ': ' + n + ' shapes');
        pack(file, SIZE, SIZE, name, path.join(OUT_TILES, name + '.ytd'), 'bc1');
        fs.unlinkSync(file);
    }

    ws.close();
    chrome.kill();
    await sleep(800);
    // The 1024 px previews are kept for a look; everything else goes.
    const keep = process.env.WHIP_MINIMAP_PREVIEWS;
    if (keep) {
        fs.mkdirSync(keep, { recursive: true });
        for (const f of fs.readdirSync(TMP)) if (f.endsWith('.png')) fs.copyFileSync(path.join(TMP, f), path.join(keep, f));
        console.log('previews -> ' + keep);
    }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* chrome may still hold its profile */ }
})().catch((e) => { console.error(e); process.exit(1); });
