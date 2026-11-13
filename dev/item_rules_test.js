// An item's `when`, read the same on both sides: html/js/core/item-rules.js (the page, what to show) and
// server/item_options.lua (the server, before an option runs). One list of cases through both, and a few
// of the server's checks on what a resource registers.
//
//   node dev/item_rules_test.js        (from whip_core; WHIP_LUA for a lua other than C:\Tools\lua54\lua.exe)
//
// Not loaded by fxmanifest.lua.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const LUA = process.env.WHIP_LUA || 'C:\\Tools\\lua54\\lua.exe';

// [when, metadata, expected]
const CASES = [
    [{ ammo: 0 }, { ammo: 0 }, true],
    [{ ammo: 0 }, { ammo: 3 }, false],
    [{ ammo: 0 }, {}, false],
    [{ loaded: true }, { loaded: true }, true],
    [{ loaded: true }, { loaded: 1 }, false],
    [{ model: 'adder' }, { model: 'adder' }, true],
    [{ model: 'adder' }, { model: 'Adder' }, false],
    [{ model: ['adder', 't20'] }, { model: 't20' }, true],
    [{ model: ['adder', 't20'] }, { model: 'zentorno' }, false],
    [{ model: ['adder', 't20'] }, {}, false],
    [{ ammo: { above: 0 } }, { ammo: 1 }, true],
    [{ ammo: { above: 0 } }, { ammo: 0 }, false],
    [{ ammo: { above: 0 } }, {}, false],
    [{ ammo: { above: 0 } }, { ammo: '5' }, false],
    [{ ammo: { below: 30 } }, { ammo: 29.5 }, true],
    [{ ammo: { below: 30 } }, { ammo: 30 }, false],
    [{ ammo: { atLeast: 1, atMost: 5 } }, { ammo: 5 }, true],
    [{ ammo: { atLeast: 1, atMost: 5 } }, { ammo: 6 }, false],
    [{ ammo: { atLeast: 1, atMost: 5 } }, { ammo: 1 }, true],
    [{ slots: { empty: false } }, { slots: { 1: { item: 'cash', amount: 5 } } }, true],
    [{ slots: { empty: false } }, { slots: {} }, false],
    [{ slots: { empty: false } }, { slots: [] }, false],
    [{ slots: { empty: false } }, {}, false],
    [{ slots: { empty: true } }, {}, true],
    [{ slots: { empty: true } }, { slots: '' }, true],
    [{ slots: { empty: true } }, { slots: 0 }, true],
    [{ slots: { empty: true } }, { slots: false }, true],
    [{ slots: { empty: true } }, { slots: 'x' }, false],
    [{ fuel: { empty: false, above: 10 } }, { fuel: 50 }, true],
    [{ fuel: { empty: false, above: 10 } }, { fuel: 5 }, false],
    [{ ammo: { above: 0 }, loaded: true }, { ammo: 3, loaded: true }, true],
    [{ ammo: { above: 0 }, loaded: true }, { ammo: 3, loaded: false }, false],
    [null, { anything: 1 }, true],
    // `default`: a field the item does not have counts as this (a magazine with no ammo is empty).
    [{ ammo: { below: 12, default: 0 } }, {}, true],
    [{ ammo: { below: 12, default: 0 } }, { ammo: 12 }, false],
    [{ ammo: { below: 12, default: 0 } }, { ammo: 11 }, true],
    [{ ammo: { below: 12 } }, {}, false],
    [{ ammo: { above: 0, default: 0 } }, {}, false],
];

// A picture's `amount`: the slot's count (the page only: the server checks the words, below). [amount, count, expected]
const AMOUNT_CASES = [
    [{ below: 100 }, 99, true],
    [{ below: 100 }, 100, false],
    [{ below: 1000 }, 100, true],
    [{ atLeast: 500000 }, 500000, true],
    [{ atLeast: 500000 }, 499999, false],
    [{ atLeast: 100, below: 1000 }, 999, true],
    [{ below: 100 }, undefined, false],   // no slot to count (a shop's list): the item's own picture
    [undefined, undefined, true],          // no amount test: as before
];

/** A JS value as a Lua literal (cases only: objects, arrays, text, numbers, booleans, null). */
function toLua(v) {
    if (v === null || v === undefined) return 'nil';
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return '{' + v.map(toLua).join(', ') + '}';
    return '{' + Object.keys(v).map((k) => (/^\d+$/.test(k) ? `[${k}]` : `[${JSON.stringify(k)}]`) + ' = ' + toLua(v[k])).join(', ') + '}';
}

const LUA_DRIVER = `
-- The two shared helpers item_options.lua uses at file scope and when checking.
InteractSpec = {
    didYouMean = function(word, fields, hints)
        if hints and hints[word] then return hints[word] end
        for name in pairs(fields) do if name:lower() == tostring(word):lower() then return "'" .. name .. "'" end end
        if word == 'lable' then return "'label'" end
        return nil
    end,
    checkRequire = function(req, where)
        if req ~= nil and type(req) ~= 'table' then return where .. ' must be a table' end
        return nil
    end,
}
dofile(${JSON.stringify(path.join(ROOT, 'server', 'item_options.lua'))})
local cases = ${'{' + CASES.map((c) => `{ when = ${toLua(c[0])}, meta = ${toLua(c[1])} }`).join(',\n') + '}'}
for i = 1, ${CASES.length} do
    local c = cases[i]
    print(tostring(ItemOptions.whenMet(c.when, c.meta)))
end
-- What a resource registers: refused with a reason a person can act on.
local function refusal(opt) local _, why = ItemOptions.cleanOption(opt, 'opt'); return why or 'ok' end
print('CHECK ' .. refusal({ action = 'a', label = 'A' }))
print('CHECK ' .. refusal({ action = 'a', lable = 'A' }))
print('CHECK ' .. refusal({ action = 'a', label = 'A', when = { ammo = { gt = 0 } } }))
print('CHECK ' .. refusal({ action = string.rep('x', 33), label = 'A' }))
print('CHECK ' .. refusal({ action = 'a', label = 'A', when = {} }))
local _, why = ItemOptions.cleanImages({ { image = '../x.webp' } }, 'images'); print('CHECK ' .. tostring(why))
_, why = ItemOptions.cleanImages({ { image = 'html/img/keys/{make}.webp' } }, 'images'); print('CHECK ' .. tostring(why))
_, why = ItemOptions.cleanImages({ { image = 'html/img/keys/{make.webp' } }, 'images'); print('CHECK ' .. tostring(why))
print('CHECK ' .. refusal({ action = 'a', label = 'A', when = { ammo = { below = 12, default = 0 } } }))
print('CHECK ' .. refusal({ action = 'a', label = 'A', when = { ammo = { default = 0 } } }))
print('CHECK ' .. refusal({ action = 'a', label = 'A', when = { ammo = { above = 0 } }, whyNot = 'Empty' }))
print('CHECK ' .. refusal({ action = 'a', label = 'A', whyNot = 5 }))
_, why = ItemOptions.cleanImages({ { amount = { below = 100 }, image = 'html/img/items/a.webp' } }, 'images'); print('CHECK ' .. tostring(why))
_, why = ItemOptions.cleanImages({ { amount = { gt = 100 }, image = 'html/img/items/a.webp' } }, 'images'); print('CHECK ' .. tostring(why))
_, why = ItemOptions.cleanImages({ { amount = { below = '100' }, image = 'html/img/items/a.webp' } }, 'images'); print('CHECK ' .. tostring(why))
_, why = ItemOptions.cleanImages({ { amount = {}, image = 'html/img/items/a.webp' } }, 'images'); print('CHECK ' .. tostring(why))
`;

const CHECKS = [
    (s) => s === 'ok',
    (s) => s.includes("use 'label'"),
    (s) => s.includes("'above'"),
    (s) => s.includes('longer than 32'),
    (s) => s.includes('no tests'),
    (s) => s.includes('inside'),
    (s) => s === 'nil',
    (s) => s.includes('{part}'),
    (s) => s === 'ok',
    (s) => s.includes('beside a test'),
    (s) => s === 'ok',
    (s) => s.includes('whyNot'),
    (s) => s === 'nil',
    (s) => s.includes("'above'"),
    (s) => s.includes('is a number'),
    (s) => s.includes('table of tests'),
];

(async () => {
    const { whenMet, amountMet } = await import(pathToFileURL(path.join(ROOT, 'html', 'js', 'core', 'item-rules.js')).href);
    const driver = path.join(os.tmpdir(), 'whip_item_rules_' + process.pid + '.lua');
    fs.writeFileSync(driver, LUA_DRIVER);
    let out;
    try { out = execFileSync(LUA, [driver], { encoding: 'utf8' }).trim().split(/\r?\n/); }
    finally { fs.unlinkSync(driver); }

    let bad = 0;
    CASES.forEach(([when, meta, want], i) => {
        const js = whenMet(when, meta);
        const lua = out[i] === 'true';
        if (js !== want || lua !== want) {
            bad++;
            console.log(`case ${i + 1}: when ${JSON.stringify(when)} meta ${JSON.stringify(meta)}: want ${want}, page ${js}, server ${lua}`);
        }
    });
    AMOUNT_CASES.forEach(([amount, count, want], i) => {
        const js = amountMet(amount, count);
        if (js !== want) {
            bad++;
            console.log(`amount case ${i + 1}: amount ${JSON.stringify(amount)} count ${count}: want ${want}, page ${js}`);
        }
    });
    const checks = out.filter((l) => l.startsWith('CHECK ')).map((l) => l.slice(6));
    checks.forEach((s, i) => {
        if (!CHECKS[i] || !CHECKS[i](s)) { bad++; console.log(`check ${i + 1}: unexpected "${s}"`); }
    });
    console.log(bad ? `${bad} wrong` : `OK: ${CASES.length} cases agree, ${AMOUNT_CASES.length} amount cases, ${checks.length} checks`);
    process.exit(bad ? 1 : 0);
})();
