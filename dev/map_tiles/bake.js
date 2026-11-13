// whip's dark map tiles, baked from the atlas style of https://github.com/VIRUXE/gtav-map-tiles.
//
//   git clone --depth 1 https://github.com/VIRUXE/gtav-map-tiles <folder>
//   node dev/map_tiles/bake.js <folder>
//
// Writes whip_assets/map/whip/{z}/{x}-{y}.webp (z 0-5, 256 px). The colours are in whipify.js —
// change them there and bake again. Headless Chrome does the decoding, recolouring and encoding, so
// nothing else needs installing. The art is Rockstar's; the tile set is unofficial.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SRC = path.resolve(process.argv[2] || '');
const OUT = path.join(require('../assets_dirs.js').assetDir('map'), 'whip');   // in its whip_assets_N
const PORT = 9333 + Math.floor(Math.random() * 400);
const profile = path.join(require('os').tmpdir(), 'whip-map-bake-' + PORT);
const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(path.join(SRC, 'atlas', '0', '0-0.webp'))) {
    console.error('usage: node dev/map_tiles/bake.js <gtav-map-tiles folder>  (it has no atlas/0/0-0.webp)');
    process.exit(1);
}

(async () => {
    const chrome = spawn(CHROME, [
        '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--no-first-run',
        '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank',
    ], { stdio: 'ignore' });

    let pageWs;
    for (let i = 0; i < 60 && !pageWs; i++) {
        await sleep(250);
        try {
            const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
            const page = list.find((t) => t.type === 'page');
            if (page) pageWs = page.webSocketDebuggerUrl;
        } catch (_) { /* not up yet */ }
    }
    if (!pageWs) { console.error('chrome did not start'); chrome.kill(); process.exit(1); }

    const ws = new WebSocket(pageWs);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    };
    const send = (method, params) => new Promise((res) => {
        const mid = ++id; pending.set(mid, res);
        ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });

    await send('Runtime.enable');
    await send('Page.navigate', { url: fileUrl(path.join(__dirname, 'bake.html')) });
    await sleep(1000);

    let done = 0, bytes = 0;
    for (let z = 0; z <= 5; z++) {
        const n = 1 << z;
        fs.mkdirSync(path.join(OUT, String(z)), { recursive: true });
        for (let x = 0; x < n; x++) {
            for (let y = 0; y < n; y++) {
                const src = path.join(SRC, 'atlas', String(z), x + '-' + y + '.webp');
                if (!fs.existsSync(src)) continue;
                const r = await send('Runtime.evaluate', {
                    expression: 'bake(' + JSON.stringify(fileUrl(src)) + ')', awaitPromise: true, returnByValue: true,
                });
                const url = r.result && r.result.result && r.result.result.value;
                if (typeof url !== 'string' || !url.startsWith('data:image/webp;base64,')) {
                    console.error('failed: ' + src, JSON.stringify(r.result && r.result.exceptionDetails));
                    continue;
                }
                const buf = Buffer.from(url.slice('data:image/webp;base64,'.length), 'base64');
                fs.writeFileSync(path.join(OUT, String(z), x + '-' + y + '.webp'), buf);
                done++; bytes += buf.length;
            }
        }
        console.log('z' + z + ' done (' + done + ' tiles so far)');
    }
    console.log('baked ' + done + ' tiles, ' + (bytes / 1048576).toFixed(1) + ' MB -> ' + OUT);

    ws.close();
    chrome.kill();
    await sleep(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) { /* Chrome may still hold it */ }
})().catch((e) => { console.error(e); process.exit(1); });
