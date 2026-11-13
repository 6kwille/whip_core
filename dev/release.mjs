// Builds a whip release: one zip with a [whip] folder, ready for `ensure [whip]`. There are two, one per game,
// the same but for the two map packs, which are built for one game each:
//
//   node whip_core/dev/release.mjs <whip-legacy.zip> legacy
//   node whip_core/dev/release.mjs <whip-enhanced.zip> enhanced <folder holding the *_enhanced map packs>
//
// Run from the resources folder (the git repo). whip's own resources (SHIP) go in as they are in the last commit:
// the settings mirrors, stray tool output and anything not committed yet stay out, and .gitattributes'
// export-ignore leaves out the design-tool briefs and the probe reports. The map packs (MAPS) are not in git: each
// is copied from disk as it stands, the Legacy build from this folder, the Enhanced one (<name>_enhanced) from the
// folder named. Nothing in the repo is changed.
//
// The commit is read once, at the start, so the zip is that one commit even while others are committing. To build
// both zips from the same commit, name it: WHIP_RELEASE_REF=<commit> node whip_core/dev/release.mjs ...
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SHIP = [
    'whip_core', 'whip_autos', 'whip_autos_shop', 'whip_chat', 'whip_fuel', 'whip_gunny', 'whip_loadingscreen',
    'whip_phone', 'whip_rope', 'whip_voice',
    ...Array.from({ length: 4 }, (_, i) => `whip_assets_${i + 1}`),
];
const MAPS = ['whip_homes_mirrorpark', 'whip_graphics'];

const [out, platform, enhancedMaps] = process.argv.slice(2);
const usage = () => {
    console.error('usage: node whip_core/dev/release.mjs <out.zip> legacy');
    console.error('       node whip_core/dev/release.mjs <out.zip> enhanced <folder holding the *_enhanced map packs>');
    process.exit(1);
};
if (!out || !out.endsWith('.zip') || !['legacy', 'enhanced'].includes(platform)) usage();
if (platform === 'enhanced' && !enhancedMaps) usage();

let commit;
try {
    commit = execFileSync('git', ['rev-parse', '--verify', `${process.env.WHIP_RELEASE_REF || 'HEAD'}^{commit}`],
        { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
    console.error(`not a commit: ${process.env.WHIP_RELEASE_REF}`);
    process.exit(1);
}

const missing = SHIP.filter((r) => !existsSync(r));
if (missing.length) {
    console.error(`not in this folder: ${missing.join(', ')} (run it from the resources folder)`);
    process.exit(1);
}
const maps = MAPS.map((name) => platform === 'legacy'
    ? { name, from: resolve(name) }
    : { name: `${name}_enhanced`, from: resolve(enhancedMaps, `${name}_enhanced`) });
for (const m of maps) {
    if (!existsSync(join(m.from, 'fxmanifest.lua'))) {
        console.error(`no map pack at ${m.from}`);
        process.exit(1);
    }
}

// Windows' own tar (bsdtar) reads git's tar and writes a zip; Git Bash's GNU tar comes first on its PATH and
// writes no zip.
const TAR = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';

const stage = mkdtempSync(join(tmpdir(), 'whip-release-'));
try {
    const folder = join(stage, '[whip]');
    mkdirSync(folder);
    const tarFile = join(stage, 'whip.tar');
    execFileSync('git', ['archive', '--format=tar', '-o', tarFile, commit, '--', ...SHIP], { stdio: 'inherit' });
    execFileSync(TAR, ['-x', '-f', tarFile, '-C', folder], { stdio: 'inherit' });
    rmSync(tarFile);
    for (const m of maps) cpSync(m.from, join(folder, m.name), { recursive: true });

    rmSync(resolve(out), { force: true });
    execFileSync(TAR, ['--format', 'zip', '-c', '-f', resolve(out), '-C', stage, '[whip]'], { stdio: 'inherit' });
} finally {
    rmSync(stage, { recursive: true, force: true });
}

const head = commit.slice(0, 9);
const version = (dir) => (readFileSync(join(dir, 'fxmanifest.lua'), 'utf8').match(/^version\s+'([^']+)'/m) || [])[1] || '?';
console.log(`wrote ${out} (${platform}): ${SHIP.length} resources from ${head}, ` +
    maps.map((m) => `${m.name} ${version(m.from)}`).join(', '));
