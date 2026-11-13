// ============================================
// whip inventory preview — the game's side of the page
// ============================================
//
// dev/inventory-preview/preview.js serves whip's real page (whip_core/html) and your resource exactly as the game
// does, and adds this file. It plays everything the page normally hears from client Lua and the server:
//
//   * opens the inventory on a scene (pockets, a stash, a car, someone else's pockets, ...), with sample items;
//   * answers what the UI sends: a move is accepted after the "ping" (or refused, when you ask it to), so the
//     optimistic state your UI drew stands, or is put back and notify() is called;
//   * a toolbar (bottom left, F9 hides it) to change scene, open and close, refuse the next move, turn developer
//     mode on, press controller buttons, and see what your UI sent.
//
// Not the server: nothing is saved, weights are what the scene says, and Give / Use / Place only show what
// would be sent.

import * as core from '/html/js/core/inventory.js';

const params = new URLSearchParams(location.search);
const RENDERER = params.get('renderer') || '';
const SCENES = [
    ['pockets', 'On foot: pockets and Nearby'],
    ['stash', 'A stash, and a wallet open'],
    ['car', 'In a car: glovebox and ignition'],
    ['full', 'Full pockets'],
    ['player', "Someone else's pockets (admin)"],
    ['stock', 'A shop worker stocking a shelf'],
    ['shop', "A shop (whip's own screen)"],
];
const prefs = {
    scene: params.get('scene') || 'pockets',
    night: params.get('bg') === 'night',
    dev: params.get('dev') === '1',
    ping: Number(params.get('ping') || 120),
    at: params.get('bar') || '',          // where the toolbar was dragged to: "x,y"
    folded: params.get('fold') === '1',
};
let refuseNext = false;

const post = (action, data, extra) => window.postMessage(Object.assign({ action, data }, extra || {}), '*');

// ---- the sample items ----

const IMG = (file) => 'img/items/' + file;   // whip_core/html/img/items, beside the page
const itemDefs = {
    cash:        { name: 'Cash', desc: 'Legal tender.', weight: 0.0001, type: 'currency', stack: true, maxStack: 999999 },
    duffle_bag:  { name: 'Duffle Bag', desc: 'A heavy canvas holdall.', weight: 1.5, type: 'accessory', stack: false,
                   img: IMG('duffle_bag.webp'), contextOptions: [{ action: 'open_duffle', label: 'Open' }] },
    phone:       { name: 'Phone', desc: 'A smartphone. (No picture here: this is the missing-picture fallback.)',
                   weight: 0.2, type: 'electronics', stack: false, usable: true,
                   contextOptions: [{ action: 'phone_sim_tray', label: 'SIM tray' }] },
    pistol_mag:  { name: 'Pistol Magazine', desc: 'Holds 12 rounds.', weight: 0.3, type: 'weapon', stack: false,
                   metaFields: [{ key: 'ammo', label: 'Rounds' }],
                   contextOptions: [{ action: 'whip_gunny:unload_mag', label: 'Unload', order: 3, when: { ammo: { above: 0 } } },
                                    { action: 'whip_gunny:load_mag', label: 'Load Bullets', order: 2, when: { ammo: { below: 12, default: 0 } } }] },
    vehicle_key: { name: 'Vehicle Key', desc: 'Starts one car.', weight: 0.05, type: 'key', stack: false,
                   img: IMG('vehicle_key.webp'), metaFields: [{ key: 'plate', label: 'Plate', format: 'uppercase' }] },
    wallet:      { name: 'Wallet', desc: 'Holds cash and cards.', weight: 0.1, type: 'container', stack: false,
                   contextOptions: [{ action: 'open_wallet', label: 'Open' }] },
    id_card:     { name: 'ID Card', desc: 'State identification.', weight: 0.01, type: 'document', stack: false,
                   metaFields: [{ key: 'name', label: 'Name' }],
                   contextOptions: [{ action: 'police:run_id', label: 'Run ID', require: { job: 'police', onDuty: true } }] },
    food:        { name: 'Burger', desc: 'Restores hunger.', weight: 0.25, type: 'food', stack: true, maxStack: 10, usable: true },
    drink:       { name: 'Water', desc: 'Restores thirst.', weight: 0.5, type: 'drink', stack: true, maxStack: 10, usable: true },
    bandage:     { name: 'Bandage', desc: 'Stops bleeding.', weight: 0.1, type: 'medical', stack: true, maxStack: 20, usable: true },
    lockpick:    { name: 'Lockpick', desc: 'For doors that are not yours.', weight: 0.1, type: 'tool', stack: true, maxStack: 5, usable: true },
    armour:      { name: 'Body Armour', desc: 'Takes a few hits for you.', weight: 3, type: 'armour', stack: false, usable: true, img: IMG('armour.webp') },
    camera:      { name: 'Camera', desc: 'Takes pictures.', weight: 0.6, type: 'tool', stack: false, usable: true, img: IMG('camera.webp') },
    jerry_can:   { name: 'Jerry Can', desc: '20 litres of fuel.', weight: 4, type: 'tool', stack: false, img: IMG('jerry_can.webp'),
                   metaFields: [{ key: 'fuel', label: 'Fuel' }] },
    'ammo-9':    { name: '9mm Rounds', desc: 'Pistol ammunition.', weight: 0.01, type: 'ammo', stack: true, maxStack: 250 },
    'ammo-rifle':{ name: '5.56 Rounds', desc: 'Rifle ammunition.', weight: 0.012, type: 'ammo', stack: true, maxStack: 250 },
    mystery:     { name: 'Unknown Thing', desc: 'Its resource has no picture for it.', weight: 1, type: 'misc', stack: false },
};

const S = (item, amount, metadata) => ({ item, amount: amount || 1, metadata: metadata || null });

function pockets(full) {
    const player = {
        1: S('phone'), 2: S('food', 4), 3: S('drink', 2), 4: S('bandage', 6), 5: S('vehicle_key', 1, { plate: 'WHIP 01' }),
        6: S('pistol_mag', 1, { ammo: 0 }), 7: S('lockpick', 2), 8: S('ammo-9', 120), 9: S('pistol_mag', 1, { ammo: 7 }),
        10: S('duffle_bag'), 11: S('mystery'), 12: S('wallet'), 13: S('armour'), 14: S('id_card', 1, { name: 'John Framework' }),
        15: S('camera'), 16: S('jerry_can', 1, { fuel: '12 L' }),
    };
    if (full) {
        const fill = ['food', 'drink', 'bandage', 'ammo-rifle', 'lockpick', 'cash'];
        for (let i = 17; i <= 30; i++) player[i] = S(fill[i % fill.length], (i % 4) + 1);
    }
    return { player, accessory: { 1: S('phone'), 2: S('vehicle_key', 1, { plate: 'WHIP 02' }), 3: S('cash', 7920) } };
}

function base(full) {
    return {
        inventory: pockets(full),
        itemDefs,
        weights: { player: full ? 41.37 : 13.5, accessory: 0.45 },
        maxSlots: { player: 30, accessory: 5 },
        maxWeight: { player: 80, accessory: 10 },
        charName: 'John Framework',
        charId: 1,
        accountNumber: '4417 0092',
    };
}

const SCENE_OPEN = {
    pockets() {
        const d = base(false);
        d.groundItems = { 1: Object.assign(S('food', 3), { groundId: 91 }), 2: Object.assign(S('cash', 150), { groundId: 92 }) };
        post('openInventory', d);
    },
    full() {
        const d = base(true);
        d.groundItems = {};
        post('openInventory', d);
    },
    stash() {
        const d = base(false);
        d.containerId = 12;
        d.storeId = 'container:12';
        d.containerDef = { name: 'Apartment Stash, Alta St', type: 'stash', slots: 30, maxWeight: 100 };
        d.containerInv = { 1: S('drink', 6), 2: S('ammo-rifle', 240), 5: S('bandage', 12), 6: S('lockpick', 2) };
        d.containerWeight = 6.28;
        post('openInventoryWithContainer', d);
        post('openExternalPanel', {
            id: 'wallet_1', label: 'Wallet', slots: 3, allowedItems: ['cash', 'id_card'],
            items: { 1: S('cash', 420), 2: S('id_card', 1, { name: 'John Framework' }) },
        });
    },
    car() {
        const d = base(false);
        d.containerId = null;
        d.storeId = 'vehicle:7:glovebox';
        d.containerDef = { name: 'Glovebox, WHIP 01', type: 'glovebox', slots: 5, maxWeight: 10 };
        d.containerInv = { 1: S('lockpick', 1), 2: S('bandage', 2) };
        d.containerWeight = 0.3;
        d.showIgnition = true;
        d.ignitionSlot = S('vehicle_key', 1, { plate: 'WHIP 01' });
        d.ignitionVehicleId = 7;
        post('openInventoryWithContainer', d);
    },
    player() {
        const d = base(false);
        d.targetCharName = 'Maria Lopez';
        d.targetCharId = 2;
        d.targetInv = { player: { 1: S('food', 2), 2: S('lockpick', 5), 3: S('cash', 830), 7: S('pistol_mag', 1, { ammo: 12 }) } };
        d.targetMaxSlots = { player: 30 };
        d.targetMaxWeight = { player: 80 };
        d.targetWeights = { player: 2.1 };
        post('openInventoryWithPlayer', d);
    },
    stock() {
        const d = base(false);
        d.containerId = 40;
        d.storeId = 'container:40';
        d.containerDef = { name: '24/7 Supermarket, back room', type: 'stash', slots: 20, maxWeight: 200 };
        d.containerInv = { 1: S('food', 10), 2: S('drink', 10), 3: S('bandage', 20), 4: S('lockpick', 3) };
        d.containerWeight = 13;
        d.stockMode = true;
        d.stockShopId = 1;
        d.stockPrices = { food: { price: 15, forSale: true }, drink: { price: 5, forSale: true }, bandage: { price: 40, forSale: false } };
        post('openInventoryWithContainer', d);
    },
    shop() {
        const d = base(false);
        d.shopId = 1;
        d.name = '24/7 Supermarket';
        d.mode = 'stocked';
        d.currency = { item: 'cash', name: 'Cash', money: true };
        d.accounts = [{ accountId: 3, accountNumber: '4417 0092', label: 'Personal', type: 'personal', balance: 12850 }];
        const shelf = [
            { item: 'food', price: 15, stock: 12, category: 'Food' }, { item: 'drink', price: 5, stock: 0, category: 'Drinks' },
            { item: 'bandage', price: 40, stock: 30, category: 'Medical' }, { item: 'lockpick', price: 250, stock: 3 },
            { item: 'ammo-9', price: 2, stock: 480 }, { item: 'wallet', price: 120, stock: 6 },
        ];
        const basket = [{ slot: 1, item: 'food', amount: 2, price: 15 }];
        d.screen = {
            shelf, categories: ['Food', 'Drinks', 'Medical'], uncategorised: true, basket, basketSlots: 10,
            basketTotal: 30, basketWeight: 0.5,
        };
        post('openInventoryWithShop', d);
    },
};

function openScene() {
    post('inventoryWash', undefined, { show: true, color: 'rgba(10, 12, 18, 0.55)' });
    (SCENE_OPEN[prefs.scene] || SCENE_OPEN.pockets)();
    bar.status();
}
function closeNow() {
    // As client Lua closes it (CloseInventory): the page is told, and does not report back.
    post('closeInventory');
    post('inventoryWash', undefined, { show: false });
    bar.status();
}

// ---- the game's answers ----

// What the UI sent, newest first (the toolbar shows them). Only the inventory's calls: the rest of whip's page
// talks to the game too (what it can draw, which screen has the controller), and is answered {} quietly.
const INVENTORY_CALLS = new Set([
    'moveItem', 'dropOneItem', 'containerMoveItem', 'containerDropOneItem', 'playerInvMoveItem', 'playerInvDropOneItem',
    'ignitionInsertKey', 'ignitionRemoveKey', 'externalPanelMove', 'splitItem', 'destroyItem', 'quickMove', 'dropToGround',
    'dropOneToGround', 'pickupGroundItem', 'splitGroundItem', 'destroyGroundItem', 'useItem', 'giveItem', 'placeItem',
    'customContextAction', 'storeContextAction', 'shopSetPrice', 'shopPriceInput', 'closeInventory',
]);
const sent = [];
function record(name, body) {
    if (!INVENTORY_CALLS.has(name) && !(body && body.opId !== undefined)) return;
    const b = Object.assign({}, body || {});
    delete b.opId;
    sent.unshift({ name, body: b, at: new Date() });
    if (sent.length > 40) sent.length = 40;
    bar.log();
}

const SAYS = {
    useItem: 'Use: the server runs the item',
    giveItem: 'Give: whip asks who to give it to',
    placeItem: 'Place: whip closes the inventory and starts placing',
    customContextAction: 'An item option: its resource gets it',
    storeContextAction: 'A store option: its resource gets it',
};

window.__whipPreview.onCall = (name, body) => {
    if (name === 'itemVehicleMakes') return { makes: {} };
    if (name === 'closeInventory') {
        record(name, body);
        post('inventoryWash', undefined, { show: false });
        setTimeout(() => bar.status(), 0);
        return {};
    }
    // A gesture the optimistic engine tracks: the server's answer after the ping.
    if (body && body.opId !== undefined && body.opId !== null) {
        record(name, body);
        const opId = body.opId;
        const refuse = refuseNext;
        if (refuse) { refuseNext = false; bar.status(); }
        setTimeout(() => {
            if (refuse) post('inventoryRevert', undefined, { error: 'The preview refused this one (as the server can)', opId });
            else post('moveAck', undefined, { opId });
        }, prefs.ping);
        return {};
    }
    record(name, body);
    if (SAYS[name]) bar.say(SAYS[name]);
    return {};
};

// ---- the toolbar ----

const bar = (() => {
    const host = document.createElement('div');
    host.id = 'whip-preview-bar';
    host.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
<style>
  :host { all: initial; }
  :host([hidden]) { display: none; }
  .bar { font: 12px/1.35 system-ui, "Segoe UI", sans-serif; color: #e8ebf0; background: rgba(16, 19, 26, 0.94);
         border: 1px solid #39404d; border-radius: 8px; width: 330px; box-shadow: 0 6px 24px rgba(0,0,0,.45); }
  .head { display: flex; align-items: center; gap: 8px; padding: 7px 10px; cursor: move; border-bottom: 1px solid #2b313c; }
  .head b { font-size: 12px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .body { padding: 8px 10px 10px; display: grid; gap: 8px; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  select, button { font: inherit; color: inherit; background: #232935; border: 1px solid #3d4554; border-radius: 5px; padding: 3px 8px; }
  button { cursor: pointer; }
  button:hover, select:hover { border-color: #6b7a92; }
  button.on { background: #2f5d3a; border-color: #4f9a62; }
  button.warn.on { background: #6a2b2b; border-color: #b4524f; }
  select { flex: 1; min-width: 0; }
  .pad button { width: 34px; padding: 3px 0; }
  .say { color: #9fd6ff; min-height: 16px; }
  .log { font: 11px/1.4 ui-monospace, Consolas, monospace; color: #b7c0cc; max-height: 120px; overflow: auto;
         background: #12151c; border-radius: 5px; padding: 5px 6px; white-space: pre-wrap; word-break: break-word; }
  .log:empty::before { content: 'What your UI sends shows here.'; color: #6b7482; }
  .muted { color: #8792a2; }
  .tag { font-size: 10px; color: #8792a2; }
  .min .body { display: none; }
  .min { width: auto; }
</style>
<div class="bar">
  <div class="head"><b></b><span class="tag">F9</span><button data-k="min" title="Fold">_</button></div>
  <div class="body">
    <div class="row"><select data-k="scene"></select></div>
    <div class="row">
      <button data-k="open">Open</button><button data-k="close">Close</button>
      <button data-k="night">Night</button><button data-k="dev" title="Destroy is offered only in developer mode">Developer mode</button>
    </div>
    <div class="row">
      <button data-k="refuse" class="warn" title="The server's answer to the next move is no: whip puts it back and calls notify()">Refuse next move</button>
      <span class="muted">Ping</span>
      <select data-k="ping" style="flex:0 0 auto"><option value="0">0 ms</option><option value="120">120 ms</option><option value="400">400 ms</option></select>
    </div>
    <div class="row pad" title="Controller buttons, as the game sends them (navInput)">
      <button data-nav="left">◀</button><button data-nav="up">▲</button><button data-nav="down">▼</button><button data-nav="right">▶</button>
      <button data-nav="select">A</button><button data-nav="back">B</button><button data-nav="buttonX">X</button><button data-nav="buttonY">Y</button>
      <button data-nav="tabPrev">LB</button><button data-nav="tabNext">RB</button>
    </div>
    <div class="say"></div>
    <div class="log"></div>
  </div>
</div>`;
    const $ = (k) => root.querySelector('[data-k="' + k + '"]');
    const head = root.querySelector('.head b');
    head.textContent = 'Inventory preview: ' + (RENDERER || "whip's own");
    const sceneSel = $('scene');
    for (const [id, label] of SCENES) {
        const o = document.createElement('option');
        o.value = id; o.textContent = label;
        sceneSel.appendChild(o);
    }
    sceneSel.value = prefs.scene;
    $('ping').value = String(prefs.ping);

    // The choices live in the address, so the reload after you save brings them back.
    const keep = () => {
        const p = new URLSearchParams(location.search);
        p.set('scene', prefs.scene);
        p.set('bg', prefs.night ? 'night' : 'day');
        p.set('dev', prefs.dev ? '1' : '0');
        p.set('ping', String(prefs.ping));
        if (prefs.at) p.set('bar', prefs.at); else p.delete('bar');
        if (prefs.folded) p.set('fold', '1'); else p.delete('fold');
        p.delete('changed');
        history.replaceState(null, '', location.pathname + '?' + p.toString());
    };
    const applyLook = () => {
        document.documentElement.classList.toggle('pv-night', prefs.night);
        document.documentElement.classList.toggle('pv-day', !prefs.night);
        post('devModeState', undefined, { on: prefs.dev });
    };

    sceneSel.addEventListener('change', () => {
        prefs.scene = sceneSel.value; keep();
        if (core.inv.open) closeNow();
        setTimeout(openScene, 60);
    });
    $('ping').addEventListener('change', () => { prefs.ping = Number($('ping').value); keep(); });
    $('open').addEventListener('click', () => { if (!core.inv.open) openScene(); });
    $('close').addEventListener('click', () => { if (core.inv.open) closeNow(); });
    $('night').addEventListener('click', () => { prefs.night = !prefs.night; keep(); applyLook(); api.status(); });
    $('dev').addEventListener('click', () => { prefs.dev = !prefs.dev; keep(); applyLook(); api.status(); });
    $('refuse').addEventListener('click', () => { refuseNext = !refuseNext; api.status(); });
    const fold = (on) => { prefs.folded = on; root.querySelector('.bar').classList.toggle('min', on); };
    fold(prefs.folded);
    $('min').addEventListener('click', () => { fold(!prefs.folded); keep(); });
    const place = (x, y) => {
        host.style.left = Math.max(0, Math.min(x, innerWidth - 60)) + 'px';
        host.style.top = Math.max(0, Math.min(y, innerHeight - 30)) + 'px';
        host.style.bottom = 'auto';
    };
    if (prefs.at) { const [x, y] = prefs.at.split(',').map(Number); if (x >= 0 && y >= 0) place(x, y); }
    let padOn = false;
    for (const b of root.querySelectorAll('[data-nav]')) {
        b.addEventListener('click', () => {
            if (!padOn) { padOn = true; post('controllerDevice', undefined, { pad: true }); }
            post('navInput', undefined, { nav: b.dataset.nav, rb: false, held: 0 });
        });
    }
    // The mouse again: whip's page goes back to its keyboard-and-mouse look.
    window.addEventListener('pointerdown', (e) => {
        if (padOn && e.target !== host) { padOn = false; post('controllerDevice', undefined, { pad: false }); }
    }, true);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F9') { host.hidden = !host.hidden; e.preventDefault(); }
    }, true);

    // Drag it by its title.
    const head0 = root.querySelector('.head');
    head0.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        const r = host.getBoundingClientRect();
        const dx = e.clientX - r.left, dy = e.clientY - r.top;
        const move = (ev) => place(ev.clientX - dx, ev.clientY - dy);
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            const r2 = host.getBoundingClientRect();
            prefs.at = Math.round(r2.left) + ',' + Math.round(r2.top);
            keep();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    });

    let sayTimer = 0;
    const api = {
        status() {
            $('night').classList.toggle('on', prefs.night);
            $('dev').classList.toggle('on', prefs.dev);
            $('refuse').classList.toggle('on', refuseNext);
            $('open').disabled = core.inv.open;
            $('close').disabled = !core.inv.open;
        },
        say(text) {
            const s = root.querySelector('.say');
            s.textContent = text;
            clearTimeout(sayTimer);
            sayTimer = setTimeout(() => { s.textContent = ''; }, 4000);
        },
        log() {
            const lines = sent.slice(0, 12).map((c) => {
                const t = c.at.toTimeString().slice(0, 8);
                const b = JSON.stringify(c.body);
                return t + '  ' + c.name + (b && b !== '{}' ? ' ' + b : '');
            });
            root.querySelector('.log').textContent = lines.join('\n');
        },
        keep, applyLook,
    };
    document.body.appendChild(host);
    return api;
})();

// For a test or a script driving the preview (preview.js --run): the toolbar's levers.
window.__pv = {
    scene(id) { prefs.scene = id; bar.keep(); if (core.inv.open) closeNow(); setTimeout(openScene, 60); },
    open: () => { if (!core.inv.open) openScene(); },
    close: () => { if (core.inv.open) closeNow(); },
    refuseNext: () => { refuseNext = true; bar.status(); },
    nav: (nav) => post('navInput', undefined, { nav, rb: false, held: 0 }),
    sent: () => sent.map((c) => ({ name: c.name, body: c.body })),
    renderer: () => (core.defaultSeated() ? null : RENDERER),
};

// ---- start ----

for (const c of window.__whipPreview.early) record(c.name, c.body);
bar.applyLook();
bar.status();
bar.keep();
const changed = params.get('changed');

// As client/ready.lua does: name the UI, then open once it is seated (or has failed, and whip's own draws).
let opened = false;
const start = () => {
    if (opened) return;
    opened = true;
    openScene();
    if (changed) bar.say('Saved ' + changed + ': reloaded');
};
if (RENDERER) {
    const off = core.events.on('renderer-changed', () => { off(); setTimeout(start, 0); });
    setTimeout(() => {
        off();
        if (!opened) bar.say("Your UI did not load: whip's own is drawing. The terminal says why.");
        start();
    }, 5000);
    post('setInventoryRenderer', undefined, { resource: RENDERER });
} else {
    post('setInventoryRenderer', undefined, { resource: null });
    setTimeout(start, 50);
}
