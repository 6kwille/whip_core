// speech_list — writes html/js/director/speech-voices.js, the voices and lines the Director's GTA Speech task offers.
//
// From DurtyFree's speeches.json (github.com/DurtyFree/gta-v-data-dumps), downloaded anywhere: every voice in the
// game and the lines it has (the names PLAY_PED_AMBIENT_SPEECH_WITH_VOICE_NATIVE takes). Credited in docs.html.
//
// Kept: the everyday lines, the ones at least MIN_VOICES voices share (a hello, a thanks, an insult, a scream), and
// every voice that has at least MIN_LINES of them: the passers-by, the gangs, the jobs and the story's people. Left
// out: the missions' own scripted lines (each said by one voice, in one scene).
//
// A voice is named after its ped where one of the world builder's peds starts its name (html/js/builder-peds.js):
// A_F_M_BEACH_01_WHITE_FULL_01 is "Beach Female #1 · White 1". The rest are named by their words.
//
// Usage:  node dev/speech_list.js <speeches.json> [out file]
//   The out file defaults to ..\html\js\director\speech-voices.js (the Director loads it with its other files).
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const MIN_VOICES = 20;   // a line this many voices share is an everyday one
const MIN_LINES = 3;     // a voice with fewer of them is a mission's

(async () => {
    if (!process.argv[2]) { console.error('usage: node speech_list.js <speeches.json> [out file]'); process.exit(2); }
    const dump = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const OUT = process.argv[3] || path.join(__dirname, '..', 'html', 'js', 'director', 'speech-voices.js');
    const { PEDS } = await import(pathToFileURL(path.join(__dirname, '..', 'html', 'js', 'builder-peds.js')).href);
    const pedName = new Map(PEDS.map((p) => [p.model.toLowerCase(), p.name]));
    const models = [...pedName.keys()].sort((a, b) => b.length - a.length);   // longest first: the closest match

    // The everyday lines, most shared first.
    const count = new Map();
    for (const v of dump) {
        for (const n of new Set((v.Speeches || []).map((s) => s.Name))) count.set(n, (count.get(n) || 0) + 1);
    }
    const lines = [...count.entries()].filter(([n, c]) => c >= MIN_VOICES && /^[A-Z0-9_]+$/.test(n))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
    const lineIndex = new Map(lines.map((n, i) => [n, i]));

    const words = (s) => s.toLowerCase().split('_').filter(Boolean)
        .map((w) => (/^\d+$/.test(w) ? String(Number(w)) : w)).join(' ');
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    // A voice no ped's name starts (A_F_Y_BEACH_BLACK_FULL_01): read from its parts, "Young beach female · Black 1".
    const AGE = { Y: 'young', M: '', O: 'old' };
    const SEX = { M: 'male', F: 'female' };
    const ETHNIC = new Set(['white', 'black', 'latino', 'asian', 'chinese', 'korean', 'indian', 'armenian', 'polynesian',
        'mexican', 'caucasian', 'middleeastern', 'salvadorian', 'hispanic', 'japanese', 'vietnamese', 'russian']);
    function partsOf(voice) {
        const m = voice.match(/^[AGSU]_([MF])_([YMO])_(.+)$/);
        if (!m) return cap(words(voice));
        const w = m[3].toLowerCase().split('_');
        let tail = w.findIndex((x) => ETHNIC.has(x));
        if (tail < 0) tail = w.findIndex((x) => x === 'full' || x === 'mini');
        if (tail < 0) tail = w.length;
        const sex = SEX[m[1]];
        const desc = w.slice(0, tail).filter((x) => !/^\d+$/.test(x)).join(' ').replace(new RegExp(sex + '$'), '').trim();
        const rest = w.slice(tail).filter((x) => x !== 'full').map((x) => (/^\d+$/.test(x) ? String(Number(x)) : x)).join(' ');
        const who = [AGE[m[2]], desc, sex].filter(Boolean).join(' ');
        return cap(who) + (rest ? ' · ' + cap(rest) : '');
    }
    function labelOf(voice) {
        const low = voice.toLowerCase();
        const model = models.find((m) => low.startsWith(m + '_'));
        if (!model) return partsOf(voice);
        // (FULL is every one of an ambient ped's voices but the short ones: said only for MINI.)
        const rest = words(low.slice(model.length + 1).split('_').filter((w) => w !== 'full').join('_'));
        return `${pedName.get(model)} · ${cap(rest)}`;
    }
    const groupOf = (voice) => (/^A_[MF]_/.test(voice) ? 'a' : /^G_[MF]_/.test(voice) ? 'g' : /^S_[MF]_/.test(voice) ? 's' : 'n');

    const voices = [];
    for (const v of dump) {
        if (typeof v.Name !== 'string' || !/^[A-Z0-9_]+$/.test(v.Name)) continue;
        const has = [...new Set((v.Speeches || []).map((s) => lineIndex.get(s.Name)).filter((i) => i !== undefined))];
        if (has.length < MIN_LINES) continue;
        // Which lines it has: a bit each, in SPEECH_LINES order, as base64.
        const bits = Buffer.alloc(Math.ceil(lines.length / 8));
        for (const i of has) bits[i >> 3] |= 1 << (i & 7);
        voices.push([v.Name, labelOf(v.Name), groupOf(v.Name), bits.toString('base64')]);
    }
    const ORDER = { a: 0, g: 1, s: 2, n: 3 };
    voices.sort((a, b) => ORDER[a[2]] - ORDER[b[2]] || a[1].localeCompare(b[1]));

    const out = `// ========================================
// THE GTA SPEECH TASK'S VOICES AND LINES (html/js/director/panels.js): every voice in the game with the everyday
// lines it can say, from DurtyFree's speeches.json (github.com/DurtyFree/gta-v-data-dumps).
//
// GENERATED by dev/speech_list.js: do not edit by hand, regenerate it. ${voices.length} voices, ${lines.length} lines.
// SPEECH_LINES is the lines, the most shared first; each voice is [ its name, its label, its group (a: passers-by,
// g: gangs, s: jobs and services, n: the story's people and others), which lines it has (a bit each, base64) ].
// ========================================

export const SPEECH_LINES = ${JSON.stringify(lines)};

export const SPEECH_VOICES = [
${voices.map((v) => '    ' + JSON.stringify(v)).join(',\n')},
];

/** The voices as the page reads them: { lines, voices: [ { name, label, group, lines: [line index] } ], byName }. */
export function readSpeech() {
    const voices = SPEECH_VOICES.map(([name, label, group, b64]) => {
        const bin = atob(b64);
        const has = [];
        for (let i = 0; i < SPEECH_LINES.length; i++) if (bin.charCodeAt(i >> 3) & (1 << (i & 7))) has.push(i);
        return { name, label, group, lines: has };
    });
    return { lines: SPEECH_LINES, voices, byName: new Map(voices.map((v) => [v.name, v])) };
}
`;
    fs.writeFileSync(OUT, out);
    console.log(`wrote ${OUT}: ${voices.length} voices, ${lines.length} lines, ${out.length} bytes`);
})();
