#!/usr/bin/env node
// ============================================
// whip inventory preview: your inventory UI in Chrome, with sample items, reloading when you save
// ============================================
//
//   node whip_core/dev/inventory-preview/preview.js my_inventory_ui
//   node whip_core/dev/inventory-preview/preview.js                  (whip's own inventory)
//
// Opens Chrome (or Edge) on whip's real page, served from your resources folder the way the game serves it:
// https://cfx-nui-whip_core/html/index.html for whip, https://cfx-nui-my_inventory_ui/... for your resource. So your
// renderer.js, its imports, its pictures and fonts load exactly as in the game. page/fixture.js plays the game's
// side: a scene opens with sample items, moves are answered, and a toolbar changes scene, refuses a move, presses
// controller buttons and shows what your UI sent. Save any file in your resource and the page reloads on the
// same scene. Errors from your UI print here as well as in the browser's DevTools (F12).
//
// Options:
//   --scene <id>      pockets (default), stash, car, full, player, stock, shop
//   --night           the night backdrop
//   --size 1920x1080  the window's size
//   --resources <dir> another folder of resources to look in (your UI kept outside the server's folder)
//   --browser <path>  Chrome or Edge, when it is not found on its own
//   --verbose         print the page's warnings and logs too, not only errors
//
// For scripts and tests (no window):
//   --headless --shot out.png     open, wait, save a screenshot, exit
//   --headless --run steps.js     run steps.js: `module.exports = async (page) => { ... }`, where
//                                 page.eval(js), page.shot(file), page.wait(ms), page.reload() and page.log
//                                 (everything the page printed) are there to use; exit when it returns
//
// Needs Node 18 or newer and Chrome or Edge. Nothing is installed: it talks to the browser over a pipe.

'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ---- arguments ----

const argv = process.argv.slice(2);
const opt = { scene: 'pockets', night: false, size: null, browser: null, verbose: false, headless: false, shot: null, run: null, resource: '', more: [] };
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--scene') opt.scene = next();
    else if (a === '--night') opt.night = true;
    else if (a === '--size') opt.size = next();
    else if (a === '--resources') opt.more.push(path.resolve(next()));
    else if (a === '--browser') opt.browser = next();
    else if (a === '--verbose') opt.verbose = true;
    else if (a === '--headless') opt.headless = true;
    else if (a === '--shot') opt.shot = next();
    else if (a === '--run') opt.run = next();
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 30).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }
    else if (a.startsWith('--')) fail('Unknown option ' + a + ' (--help lists them)');
    else opt.resource = a;
}
let [W, H] = (opt.size || '1600x900').split('x').map(Number);
if (!(W > 0 && H > 0)) fail('--size is WIDTHxHEIGHT, like 1920x1080');

function fail(text) {
    console.error('\n  ' + text + '\n');
    process.exit(1);
}

// ---- the resources folder ----

const CORE_DIR = path.resolve(__dirname, '..', '..');
const HERE = path.join(__dirname, 'page');

// The folder the server reads resources from: the nearest "resources" above whip_core, else the folder whip_core is in.
function resourcesRoot() {
    let dir = path.dirname(CORE_DIR);
    for (let d = dir; ; d = path.dirname(d)) {
        if (path.basename(d).toLowerCase() === 'resources') return d;
        if (path.dirname(d) === d) break;
    }
    return dir;
}

// Every resource under the roots by name, through [category] folders as the server finds them. The first found wins.
function indexResources(roots) {
    const found = new Map();
    const walk = (dir, depth) => {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
        for (const e of entries) {
            if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
            const full = path.join(dir, e.name);
            if (fs.existsSync(path.join(full, 'fxmanifest.lua')) || fs.existsSync(path.join(full, '__resource.lua'))) {
                if (!found.has(e.name)) found.set(e.name, full);
            } else if (depth < 4) {
                walk(full, depth + 1);
            }
        }
    };
    found.set('whip_core', CORE_DIR);
    for (const root of roots) {
        if (!fs.existsSync(root)) fail('No folder at ' + root);
        walk(root, 0);
    }
    return found;
}

const ROOT = resourcesRoot();
const RESOURCES = indexResources([...opt.more, ROOT]);
const RES_NAME = /^[A-Za-z0-9_-]{1,64}$/;
let uiDir = null;
if (opt.resource) {
    if (!RES_NAME.test(opt.resource)) fail('"' + opt.resource + '" is not a resource name (letters, digits, _ and -)');
    uiDir = RESOURCES.get(opt.resource);
    if (!uiDir) fail('No resource called ' + opt.resource + ' under ' + ROOT);
    if (!fs.existsSync(path.join(uiDir, 'renderer.js'))) fail(opt.resource + ' has no renderer.js (' + uiDir + ')');
    checkManifest();
}

// The game only serves the files fxmanifest.lua lists: warn about a file the preview would load but the game would not.
function checkManifest() {
    let text = '';
    try { text = fs.readFileSync(path.join(uiDir, 'fxmanifest.lua'), 'utf8'); } catch (_) { return; }
    if (!/['"]renderer\.js['"]/.test(text) && !/['"]\*\*?[^'"]*\.js['"]/.test(text)) {
        console.log("  Note: renderer.js is not in " + opt.resource + "'s fxmanifest.lua files { }: the game will not find it.");
    }
}

// ---- the browser ----

function findBrowser() {
    if (opt.browser) return fs.existsSync(opt.browser) ? opt.browser : fail('No browser at ' + opt.browser);
    const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
    const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || '';
    const list = process.platform === 'win32' ? [
        path.join(pf, 'Google/Chrome/Application/chrome.exe'),
        path.join(pf86, 'Google/Chrome/Application/chrome.exe'),
        path.join(local, 'Google/Chrome/Application/chrome.exe'),
        path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
        path.join(pf, 'Microsoft/Edge/Application/msedge.exe'),
    ] : process.platform === 'darwin' ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
    const hit = list.find((p) => p && fs.existsSync(p));
    return hit || fail('Chrome or Edge was not found. Point at it with --browser "<path to chrome.exe>"');
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'whip-inventory-preview-'));
const args = [
    '--remote-debugging-pipe', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--disable-features=Translate,MediaRouter', '--window-size=' + W + ',' + H, '--autoplay-policy=no-user-gesture-required',
];
if (opt.headless) args.push('--headless=new', '--hide-scrollbars', 'about:blank');
else args.push('--app=about:blank');
const browser = spawn(findBrowser(), args, { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });

let quitting = false;
function quit(code) {
    if (quitting) return;
    quitting = true;
    try { browser.kill(); } catch (_) { /* gone */ }
    setTimeout(() => {
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) { /* still held for a moment */ }
        process.exit(code || 0);
    }, 400);
}
browser.on('exit', () => { if (!quitting) { console.log('  Browser closed.'); quit(0); } });
process.on('SIGINT', () => quit(0));

// ---- DevTools protocol over the pipe ----

const toBrowser = browser.stdio[3];
const fromBrowser = browser.stdio[4];
let nextId = 0;
const waiting = new Map();
const handlers = {};
let buffer = '';
fromBrowser.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let end;
    while ((end = buffer.indexOf('\0')) !== -1) {
        const msg = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        if (msg.id && waiting.has(msg.id)) {
            const { resolve, reject } = waiting.get(msg.id);
            waiting.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
        } else if (msg.method && handlers[msg.method]) {
            handlers[msg.method](msg.params, msg.sessionId);
        }
    }
});
function send(method, params, sessionId) {
    const id = ++nextId;
    const msg = { id, method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    toBrowser.write(JSON.stringify(msg) + '\0');
    return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
}
let session = null;
const page = (method, params) => send(method, params, session);

// ---- serving cfx-nui-* the way FiveM does ----

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
    '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav', '.webm': 'video/webm', '.mp4': 'video/mp4',
};

function fileFor(resource, rel) {
    if (resource === 'whip_core' && rel.startsWith('__preview/')) {
        const f = path.resolve(HERE, rel.slice('__preview/'.length));
        return f.startsWith(HERE + path.sep) ? f : null;
    }
    const dir = RESOURCES.get(resource);
    if (!dir) return null;
    const f = path.resolve(dir, rel);
    if (!(f === dir || f.startsWith(dir + path.sep))) return null;
    return f;
}

function pageHtml(file) {
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace('<head>', '<head>\n<script src="/__preview/early.js"></script>');
    html = html.replace('</head>', '<link rel="stylesheet" href="/__preview/preview.css">\n</head>');
    html = html.replace('</body>', '<script type="module" src="/__preview/fixture.js"></script>\n</body>');
    return Buffer.from(html, 'utf8');
}

function serve(p) {
    const m = /^https:\/\/cfx-nui-([A-Za-z0-9_-]+)\/([^?#]*)/.exec(p.request.url);
    const headers = [
        { name: 'Access-Control-Allow-Origin', value: '*' },   // FiveM's NUIResourceHandler sends it too
        { name: 'Cache-Control', value: 'no-store' },
    ];
    const answer = (code, body, type) => {
        if (type) headers.push({ name: 'Content-Type', value: type });
        page('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: code, responseHeaders: headers, body: body.toString('base64') })
            .catch(() => { /* the page moved on */ });
    };
    if (!m) return answer(404, Buffer.alloc(0));
    let rel;
    try { rel = decodeURIComponent(m[2]); } catch (_) { return answer(400, Buffer.alloc(0)); }
    const file = fileFor(m[1], rel);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        if (opt.verbose || m[1] === opt.resource) console.log('  404 ' + m[1] + '/' + rel);
        return answer(404, Buffer.alloc(0));
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const body = (m[1] === 'whip_core' && rel === 'html/index.html') ? pageHtml(file) : fs.readFileSync(file);
    answer(200, body, type);
}

// ---- what the page prints ----

const pageLog = [];
function printable(args) {
    return args.map((a) => (a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : (a.description || a.type))).join(' ');
}
handlers['Runtime.consoleAPICalled'] = (prm) => {
    const text = printable(prm.args || []);
    pageLog.push(prm.type + ': ' + text);
    const mine = /\[whip_core:renderer\]/.test(text) || (opt.resource && text.indexOf(opt.resource) !== -1);
    if (prm.type === 'error' || mine || opt.verbose) console.log('  [page' + (prm.type === 'log' ? '' : ' ' + prm.type) + '] ' + text);
};
handlers['Runtime.exceptionThrown'] = (prm) => {
    const d = prm.exceptionDetails || {};
    const text = (d.exception && d.exception.description) || d.text || 'error';
    pageLog.push('exception: ' + text);
    console.log('  [page error] ' + text + (d.url ? '  (' + d.url.replace(/\?.*$/, '') + ':' + (d.lineNumber + 1) + ')' : ''));
};
handlers['Fetch.requestPaused'] = (prm) => serve(prm);

// ---- start ----

function startUrl(extra) {
    const q = new URLSearchParams({ scene: opt.scene, bg: opt.night ? 'night' : 'day' });
    if (opt.resource) q.set('renderer', opt.resource);
    for (const k in (extra || {})) q.set(k, extra[k]);
    return 'https://cfx-nui-whip_core/html/index.html?' + q.toString();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function attach() {
    for (let i = 0; i < 80; i++) {
        const { targetInfos } = await send('Target.getTargets');
        const t = targetInfos.find((x) => x.type === 'page');
        if (t) return (await send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
        await sleep(100);
    }
    throw new Error('the browser opened no page');
}

let loaded = null;
handlers['Page.loadEventFired'] = () => { if (loaded) { loaded(); loaded = null; } };
const waitLoad = () => new Promise((r) => { loaded = r; });

async function reload(changedFile) {
    const href = (await page('Runtime.evaluate', { expression: 'location.href', returnByValue: true })).result.value;
    const url = new URL(href && href.startsWith('https://cfx-nui-whip_core/') ? href : startUrl());
    if (changedFile) url.searchParams.set('changed', changedFile);
    const done = waitLoad();
    await page('Page.navigate', { url: url.href });
    await done;
}

function watch() {
    if (!uiDir) return;
    let timer = null;
    let last = '';
    const onChange = (_, name) => {
        const f = String(name || '').replace(/\\/g, '/');
        if (!f || /(^|\/)\.|node_modules|~$|\.tmp$/.test(f)) return;
        last = f;
        clearTimeout(timer);
        timer = setTimeout(() => {
            console.log('  Saved ' + last + ': reloading');
            reload(last).catch((e) => console.log('  Reload failed: ' + e.message));
        }, 150);
    };
    try {
        fs.watch(uiDir, { recursive: true }, onChange);
    } catch (_) {
        fs.watch(uiDir, onChange);   // a platform without recursive watching: the top folder only
        console.log('  (Only files directly in ' + opt.resource + ' reload on save here.)');
    }
}

(async () => {
    session = await attach();
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Fetch.enable', { patterns: [{ urlPattern: 'https://cfx-nui-*', requestStage: 'Request' }] });
    if (opt.headless) await page('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

    const first = waitLoad();
    await page('Page.navigate', { url: startUrl() });
    await first;

    const shoot = async (file) => {
        const img = await page('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(file, Buffer.from(img.data, 'base64'));
        console.log('  Screenshot: ' + path.resolve(file));
    };

    if (opt.run || opt.shot) {
        if (opt.run) watch();
        await sleep(2500);
        if (opt.shot) await shoot(opt.shot);
        if (opt.run) {
            const steps = require(path.resolve(opt.run));
            await steps({
                eval: async (expression) => {
                    const r = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
                    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
                    return r.result.value;
                },
                shot: shoot,
                wait: sleep,
                reload: async (changedFile) => { await reload(changedFile); await sleep(2500); },
                log: pageLog,
                cdp: page,
            });
        }
        return quit(0);
    }

    console.log('\n  whip inventory preview: ' + (opt.resource || "whip's own inventory"));
    if (uiDir) console.log('  Watching ' + uiDir + ' : save a file and the page reloads.');
    console.log('  The toolbar is bottom left (F9 hides it). Close the window or press Ctrl+C to stop.\n');
    watch();
})().catch((e) => { console.error('  ' + e.message); quit(1); });
