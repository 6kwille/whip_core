#!/usr/bin/env node
// ============================================
// sync_enhanced — the whip in git onto the Enhanced test server
// ============================================
//
// ONE WHIP FOR BOTH SERVERS (docs: Quick Start → Legacy or Enhanced). Development happens here, in the Legacy
// server's resources (the git repo). This puts the LAST COMMIT of each resource in sync_enhanced.json onto the
// Enhanced server, so the two run the same whip. Never edit the Enhanced copy by hand: the next sync replaces it.
//
//   node dev/sync_enhanced.mjs            what it WOULD do (changes nothing)
//   node dev/sync_enhanced.mjs --apply    do it (the Enhanced server must be stopped: stop.bat)
//   ... --apply --fresh                   ...carrying nothing over from the copy it replaces
//
// NOTHING IS DELETED. Each resource it replaces, and each old one it retires, is MOVED into a dated folder under
// `backups`, so any sync is undone by moving them back. The new copy is the committed files only (work in progress
// that is not committed is not sent). Without --fresh, the files git ignores in the copy being replaced (the
// server's own: whip_core's settings.json, mirrored from its database) are put back into the new copy.
//
// It touches only the resources named in sync_enhanced.json. The map and model packs (whippy_*) are not among them:
// a model built for Legacy must be converted for Enhanced, and the Enhanced server keeps its own (*_enhanced).
// A synced resource carries both: stream/ for Legacy and stream_enhanced/ for Enhanced (which reads it INSTEAD of
// stream/ when it is there). One whose streamed models have no stream_enhanced/ copy yet is listed.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');          // the resources folder: the git repo
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'sync_enhanced.json'), 'utf8'));
const APPLY = process.argv.includes('--apply');
const FRESH = process.argv.includes('--fresh');
const TAR = fs.existsSync('C:\\Windows\\System32\\tar.exe') ? 'C:\\Windows\\System32\\tar.exe' : 'tar';
const MODEL = /(^|\/)stream\/.+\.(ydr|yft|ytd|ytyp|ymap|ybn|ycd|ydd|ymf|ynv)$/i;

/** `ok`: the exit codes that are answers, not failures (check-ignore exits 1 when nothing is ignored). */
function git(args, input, ok = [0]) {
    const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', input, maxBuffer: 1 << 28 });
    if (!ok.includes(r.status)) throw new Error(`git ${args.join(' ')}: ${(r.stderr || '').trim()}`);
    return r.stdout;
}

function lines(s) { return s.split('\n').map((l) => l.trim()).filter(Boolean); }

/** Every file under `dir`, relative to it, with forward slashes. */
function walk(dir, base = dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, base, out);
        else out.push(path.relative(base, p).split(path.sep).join('/'));
    }
    return out;
}

/** Is the Enhanced server up? Three signs, any one is enough: its port listening (CFG.port, 30130), a `cfx-server`
 *  process (Enhanced's name; Legacy's is FXServer), or a process running from its folder. The path alone is not
 *  enough: Josh starts the server elevated, and Windows hides an elevated process's path from a shell that is not
 *  (21 Oct 2026). Answers { up, why }, or { up: null } when a sign could not be read (then nothing is done). */
function serverRunning() {
    const folder = CFG.serverFolder.replace(/'/g, "''");
    const port = Number(CFG.port) || 30130;
    const one = (expr) => `try { [string]@(${expr}).Count } catch { '-1' }`;
    const r = spawnSync('powershell', ['-NoProfile', '-Command', [
        one(`Get-Process -Name 'cfx-server' -ErrorAction SilentlyContinue`),
        one(`Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like '${folder}*' }`),
    ].join('; ')], { encoding: 'utf8' });
    const [named, pathed] = lines(r.stdout || '').map((s) => parseInt(s, 10));
    // The port from netstat, which sees an elevated server's listening socket too (TCP and UDP: FiveM listens on both)
    const ns = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
    const ports = ns.status === 0
        ? lines(ns.stdout || '').filter((l) => new RegExp(`^(TCP|UDP)\\s+\\S+:${port}\\s`).test(l)
            && (/^UDP/.test(l) || / LISTENING /.test(l))).length
        : -1;
    if (!(ports >= 0) || !(named >= 0) || !(pathed >= 0)) return { up: null };
    if (ports > 0) return { up: true, why: `port ${port} is listening` };
    if (named > 0) return { up: true, why: `${named} cfx-server process(es)` };
    if (pathed > 0) return { up: true, why: `${pathed} process(es) from ${CFG.serverFolder}` };
    return { up: false };
}

// ---- the plan ----

const head = git(['rev-parse', 'HEAD']).trim();
const subject = git(['log', '-1', '--format=%s', 'HEAD']).trim();
const target = CFG.target;
if (!fs.existsSync(target)) throw new Error(`no such folder: ${target}`);

// UNCHANGED SINCE THE LAST SYNC: LEFT AS IT IS. A resource's files written again, the same as before, cost the next
// start a virus scan of every one of them: Windows Defender scans a file the first time a program opens it after it
// was written, one core's worth, while the server waits. whip_assets' 44,310 files held the Enhanced server's start
// for about 4 minutes that way (measured 27 Oct 2026: MsMpEng at 100% of a core, cfx-server at 9%). So each synced
// resource's git tree id is kept in .whip_sync.json, and the same id next time means the same files: not touched.
let lastTrees = {};
try {
    const last = JSON.parse(fs.readFileSync(path.join(target, '.whip_sync.json'), 'utf8'));
    lastTrees = last.trees || {};
    // A record from before the trees were kept: the commit it wrote, and the resources it wrote from it, give them.
    if (!last.trees && last.commit && Array.isArray(last.resources)) {
        for (const res of last.resources) {
            const r = spawnSync('git', ['rev-parse', `${last.commit}:${res}`], { cwd: REPO, encoding: 'utf8' });
            if (r.status === 0) lastTrees[res] = r.stdout.trim();
        }
    }
} catch { /* the first sync */ }

const plan = [];
for (const res of CFG.resources) {
    // PAUSED ON THE SERVER: Josh switches a resource off by renaming its folder <name>NO (whip_assets, whose
    // start stalls his tests, 21 Oct 2026). Then it is his: neither it nor a <name> beside it is touched.
    if (fs.existsSync(path.join(target, res + 'NO'))) { plan.push({ res, paused: true }); continue; }
    const files = lines(git(['ls-tree', '-r', '--name-only', 'HEAD', '--', res]));
    if (!files.length) { plan.push({ res, missing: true }); continue; }
    const tree = git(['rev-parse', `HEAD:${res}`]).trim();
    const own = files.map((f) => f.slice(res.length + 1));
    const models = own.some((f) => f.startsWith('stream_enhanced/')) ? [] : own.filter((f) => MODEL.test(f));
    const where = path.join(target, res);
    const exists = fs.existsSync(where);
    if (exists && !FRESH && lastTrees[res] === tree) { plan.push({ res, same: true, files: files.length, tree }); continue; }
    let keep = [];
    if (exists && !FRESH) {
        // The server's own files in the copy being replaced: what git ignores here.
        const old = walk(where).map((f) => `${res}/${f}`);
        if (old.length) keep = lines(git(['check-ignore', '--stdin'], old.join('\n') + '\n', [0, 1]).replace(/\r/g, ''));
    }
    plan.push({ res, files: files.length, models: models.length, exists, keep, tree });
}
const retire = (CFG.retire || []).filter((r) => fs.existsSync(path.join(target, r)));
const known = new Set([...CFG.resources, ...(CFG.retire || [])]);
const untouched = fs.readdirSync(target, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !known.has(e.name)).map((e) => e.name);

console.log(`\nwhip from git: ${head.slice(0, 8)}  ${subject}`);
console.log(`onto: ${target}${APPLY ? '' : '   (a dry run: nothing changes; --apply does it)'}\n`);
for (const p of plan) {
    if (p.missing) { console.log(`  ${p.res.padEnd(28)} NOT IN GIT: skipped`); continue; }
    if (p.paused) { console.log(`  ${p.res.padEnd(28)} PAUSED on the server (${p.res}NO): left alone`); continue; }
    if (p.same) { console.log(`  ${p.res.padEnd(28)} ${String(p.files).padStart(6)} files, unchanged since the last sync: left as it is`); continue; }
    const what = p.exists ? 'replaced (old copy to the backup)' : 'new';
    const kept = p.keep.length ? `, keeps ${p.keep.length} of the server's own file(s): ${p.keep.map((k) => k.slice(p.res.length + 1)).join(', ')}` : '';
    console.log(`  ${p.res.padEnd(28)} ${String(p.files).padStart(6)} files, ${what}${kept}`);
    if (p.models) console.log(`  ${''.padEnd(28)} ! ${p.models} streamed model file(s) built for Legacy and no stream_enhanced/: on Enhanced they need converting`);
}
if (retire.length) console.log(`\n  retired (moved to the backup): ${retire.join(', ')}`);
if (untouched.length) console.log(`\n  left as they are: ${untouched.join(', ')}`);

if (!APPLY) { console.log('\nDry run only. Stop the Enhanced server (stop.bat), then run with --apply.\n'); process.exit(0); }

// ---- doing it ----

const running = serverRunning();
if (running.up !== false) {
    console.error(running.up === null ? '\nCould not check whether the Enhanced server is running: nothing done.\n'
        : `\nThe Enhanced server is running (${running.why}): stop it first (stop.bat). Nothing done.\n`);
    process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
const write = plan.filter((p) => !p.missing && !p.paused && !p.same);
const toMove = [...write.filter((p) => p.exists).map((p) => p.res), ...retire];
// A backup folder only when something goes into it.
const backup = toMove.length ? path.join(CFG.backups, stamp) : null;
if (backup) fs.mkdirSync(backup, { recursive: true });

const moved = [];
for (const name of toMove) {
    fs.renameSync(path.join(target, name), path.join(backup, name));
    moved.push(name);
}
console.log(moved.length ? `\nMoved ${moved.length} folder(s) to ${backup}` : '\nNothing to move: every resource is as it was');

// The committed files, straight out of git into the server's resources.
const names = write.map((p) => p.res);
if (names.length) await new Promise((resolve, reject) => {
    const ga = spawn('git', ['archive', '--format=tar', 'HEAD', '--', ...names], { cwd: REPO });
    const tx = spawn(TAR, ['-x', '-f', '-', '-C', target]);
    ga.stdout.pipe(tx.stdin);
    let err = '';
    ga.stderr.on('data', (d) => { err += d; });
    tx.stderr.on('data', (d) => { err += d; });
    let left = 2, failed = false;
    const done = (who) => (code) => {
        if (code !== 0) failed = true;
        if (--left === 0) failed ? reject(new Error(`${who} failed: ${err.trim()}`)) : resolve();
    };
    ga.on('close', done('git archive'));
    tx.on('close', done('tar'));
});
console.log(`Wrote ${names.length} resource(s) from ${head.slice(0, 8)}`);

let keptN = 0;
for (const p of plan) {
    for (const rel of p.keep || []) {
        const from = path.join(backup, rel), to = path.join(target, rel);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        keptN++;
    }
}
if (keptN) console.log(`Put back ${keptN} of the server's own file(s)`);

// Each resource's tree as it now stands on the server (a paused one keeps what it had), for the next sync's check.
const trees = { ...lastTrees };
for (const p of plan) if (p.tree) trees[p.res] = p.tree;
fs.writeFileSync(path.join(target, '.whip_sync.json'), JSON.stringify({
    commit: head, subject, at: new Date().toISOString(), fresh: FRESH,
    resources: names, unchanged: plan.filter((p) => p.same).map((p) => p.res), retired: retire, backup, trees,
}, null, 2));
console.log(`\nDone. The Enhanced server now runs whip ${head.slice(0, 8)}. Its ensure list is server.cfg's (yours).`);
console.log(backup ? `To undo: move the folders in ${backup} back into ${target}.\n` : '');
