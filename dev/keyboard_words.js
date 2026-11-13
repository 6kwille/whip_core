// keyboard_words — writes html/keyboard/<lang>.txt, the words whip's pad keyboard suggests (js/keyboard-words.js).
//
// From a frequency list in hermitdave's FrequencyWords format ("word count" a line, most common first:
// github.com/hermitdave/FrequencyWords, content/2018/<lang>/<lang>_50k.txt, from OpenSubtitles: how people
// talk, which is what chat is). Its content is CC BY-SA 4.0, so the file written is too, and says so on its
// first line (the keyboard skips lines starting with #).
//
// Kept: the most common COUNT words (default 20000) that are only letters (any alphabet, accents too), at
// least two of them. Left out:
//   - one letter (nothing to complete)
//   - anything in the block list (LDNOOBW's list for the language, github.com/LDNOOBW/List-of-Dirty-Naughty-
//     Obscene-and-Otherwise-Bad-Words, plus EXTRA_BLOCK below), and its plural: a player can still type those,
//     and the keyboard learns them from what they send, but it never offers them unasked
// ENGLISH ONLY: the subtitles split contractions ("don" + "'t", "i" + "'m"), so they are put back together
// here: a stem becomes its contraction where it stood (don -> don't), and the pronoun ones go right after
// their word (it -> it, it's, it'll). The apostrophe-less chat spellings (im, dont) go: the keyboard
// matches without apostrophes, so "im" offers "I'm".
//
// Usage:  node dev/keyboard_words.js <lang> <frequency list> [block list] [count]
//   Writes ..\html\keyboard\<lang>.txt. Not loaded by fxmanifest.lua.
const fs = require('fs');
const path = require('path');

const [lang, freqFile, blockFile, countArg] = process.argv.slice(2);
if (!lang || !freqFile) {
    console.error('usage: node keyboard_words.js <lang> <frequency list> [block list] [count]');
    process.exit(2);
}
const COUNT = Number(countArg) || 20000;

// Strong words and slurs LDNOOBW's English list does not have. Mild ones (damn, hell, crap) stay offered.
const EXTRA_BLOCK = {
    en: ['fucked', 'fucker', 'fuckers', 'motherfucking', 'motherfuckers', 'cocksucker', 'cocksuckers', 'dickhead',
         'dickheads', 'retard', 'retards', 'retarded', 'wanker', 'wankers', 'prick', 'pricks', 'dyke', 'dykes',
         'chink', 'chinks', 'gook', 'gooks', 'douchebag', 'shithead', 'shitty', 'fag', 'fags'],
};

const STEMS = {   // a split contraction's stem -> the word, in its place
    don: "don't", didn: "didn't", doesn: "doesn't", isn: "isn't", wasn: "wasn't", weren: "weren't",
    aren: "aren't", couldn: "couldn't", wouldn: "wouldn't", shouldn: "shouldn't", haven: "haven't",
    hasn: "hasn't", hadn: "hadn't", mustn: "mustn't", needn: "needn't", shan: "shan't", ain: "ain't",
};
const AFTER = {   // these come right after their word
    i: ["I'm", "I'll", "I've", "I'd"], you: ["you're", "you'll", "you've", "you'd"],
    he: ["he's", "he'll", "he'd"], she: ["she's", "she'll", "she'd"], it: ["it's", "it'll"],
    we: ["we're", "we'll", "we've", "we'd"], they: ["they're", "they'll", "they've", "they'd"],
    that: ["that's", "that'll"], there: ["there's"], here: ["here's"], what: ["what's"], who: ["who's"],
    where: ["where's"], how: ["how's"], let: ["let's"], can: ["can't"], won: ["won't"],
};
const DROP = new Set(['ll', 're', 've', 'im', 'ive', 'dont', 'didnt', 'doesnt', 'isnt', 'wasnt', 'thats', 'youre',
                      'theyre', 'cant', 'wont', 'aint', 'couldnt', 'wouldnt', 'shouldnt', 'havent', 'lets']);

const blocked = new Set((EXTRA_BLOCK[lang] || []).map((w) => w.toLowerCase()));
if (blockFile) {
    for (const line of fs.readFileSync(blockFile, 'utf8').split(/\r?\n/)) {
        const w = line.trim().toLowerCase();
        if (w && !w.includes(' ')) blocked.add(w);
    }
}
const isBlocked = (w) => blocked.has(w) || (w.endsWith('s') && blocked.has(w.slice(0, -1)))
    || (w.endsWith('es') && blocked.has(w.slice(0, -2)));

const LETTERS = /^\p{L}[\p{L}\p{M}]*$/u;
const out = [];
const seen = new Set();
const add = (w) => {
    const k = w.toLowerCase();
    if (seen.has(k) || out.length >= COUNT) return;
    seen.add(k);
    out.push(w);
};

for (const line of fs.readFileSync(freqFile, 'utf8').split(/\r?\n/)) {
    if (out.length >= COUNT) break;
    let w = line.trim().split(/\s+/)[0];
    if (!w) continue;
    w = w.normalize('NFC').toLowerCase();
    if (lang === 'en') {
        if (STEMS[w]) { add(STEMS[w]); continue; }
        if (DROP.has(w)) continue;
    }
    const ok = LETTERS.test(w) && [...w].length >= 2 && !isBlocked(w);
    if (ok) add(w);
    if (lang === 'en' && AFTER[w]) AFTER[w].forEach(add);
}

const target = path.join(__dirname, '..', 'html', 'keyboard', lang + '.txt');
fs.mkdirSync(path.dirname(target), { recursive: true });
const head = `# whip pad keyboard words (${lang}): the ${out.length} most common, most common first. From hermitdave's`
    + ' FrequencyWords (OpenSubtitles 2018), CC BY-SA 4.0; made by dev/keyboard_words.js.';
fs.writeFileSync(target, head + '\n' + out.join('\n') + '\n');
console.log(`${target}: ${out.length} words, ${blocked.size} blocked`);
