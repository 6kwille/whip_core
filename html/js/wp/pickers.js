// ========================================
// /whip PICKERS — the NPC picker and the item list, as panel components
//
// Made for the shop set-up wizard (wp/shops.js), and free for any section:
//
//   pedPicker   the world builder's NPCs (builder-peds.js: every ped with a picture in
//               whip_assets/img/peds — the list the Director's World tab places from), with its
//               search and categories, the pictures as tiles, and the one picked shown large.
//   itemList    the Item Browser's list (wp/items.js): a resource filter, a search, a row per item
//               with its icon. Rows are picked and unpicked; the caller keeps what is picked.
//   pedPortrait an NPC's picture, large (the picker's side; a shop's page).
//   propPicker  the furnisher's props (Furnisher.catalog), the NPC picker's way: a chip per
//               category, the pictures as tiles (whip_assets/img/props), the one picked large; and
//   propPortrait  a prop's picture, large (a container's page; the container wizard).
//   personSearch / avatar   find a character by name; their initials in a disc (the job wizard).
//   vehiclePicker / vehiclePortrait   every vehicle the catalog has, a chip per class, wide pictures (the
//               new-vehicle wizard).
//   itemTiles   every item as a picture, searchable, with chips for groups of them (the Item Log's
//               Economy: moved today / this week / this month).
//   BLIP_COLOURS / blipTintFilter   a map blip's colours, and the filter that tints a blip's picture
//               the map's way (the shop and garage wizards' Map steps; moved here from wp/shops.js).
//
// Both keep their search and filter per id across redraws, so a wizard going Back and Next finds
// them as it left them. Clicks are wired here, not through the section's actions, so a section
// using one adds nothing to its action map.
// ========================================

import { WP } from '../whip-panel.js';
import { nuiCallback, pedImageUrl, itemImageUrl, propImageUrl, vehicleImageUrl } from '../utils.js';
import { PED_CATEGORIES, PEDS } from '../builder-peds.js';
import { GLYPHS } from '../furnisher-data.js';

const PED_OF = {};
for (const p of PEDS) PED_OF[p.model] = p;

/** A ped's readable name ("Shopkeeper Male #1"), or its model when the list does not have it. */
export function pedName(model) {
    const p = PED_OF[model];
    return p ? p.name : String(model || '');
}

/** A person's outline: the glyph a tile shows when its picture is missing. A fixed icon, no data. */
const PERSON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'
    + '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21c0-4 3.1-7 7-7s7 3 7 7"/></svg>';

/** The search box the panel's toolbars have (WP.toolbar's, magnifier and all), standing alone.
 *  `.wp-section-search` so '/' and the pad's Y find it while it is on screen. */
function searchBox(placeholder, value, onInput) {
    const bar = WP.toolbar({ search: { placeholder } });
    const wrap = bar.querySelector('.wp-search');
    const input = wrap.querySelector('input');
    input.classList.add('wp-section-search');
    input.value = value || '';
    input.addEventListener('input', () => onInput(input.value));
    return wrap;
}

/** A picture that may not load: the tile (or hero) gets .wp-noimg and its glyph shows instead. */
function picture(url, holder, cls) {
    const img = document.createElement('img');
    if (cls) img.className = cls;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => holder.classList.add('wp-noimg'));
    img.src = url;
    return img;
}

/** An NPC's full-length picture, large: the picker's side, or a shop's page. Its glyph if none. */
export function pedPortrait(model) {
    const hero = WP.el('div', 'wp-pick-hero');
    if (model) hero.appendChild(picture(pedImageUrl(model), hero));
    else hero.classList.add('wp-noimg');
    const art = WP.el('span', 'wp-tile-art');
    art.innerHTML = PERSON_ICON;
    hero.appendChild(art);
    return hero;
}

// ---- the NPC picker ----

const pedState = new Map();   // id -> { chip, search }

/**
 *   const pick = pedPicker({
 *       id: 'sw-peds',                  // unique in the panel (the chips are a WP.tabs)
 *       value: 'mp_m_shopkeep_01',      // the one picked, or ''
 *       suggested: ['mp_m_shopkeep_01', ...], suggestedLabel: 'Shop staff',   // optional first chip
 *       side: [el, ...],                // under the large picture: the caller's buttons
 *       onPick(model),
 *   });
 *   body.appendChild(pick.root);
 *   pick.visible()   the people shown right now, in order: [{ model, name }]
 */
export function pedPicker(opts) {
    const suggested = (opts.suggested || []).filter((m) => PED_OF[m]);
    const chips = [];
    if (suggested.length) chips.push({ key: 'suggested', label: opts.suggestedLabel || 'Suggested' });
    for (const c of PED_CATEGORIES) chips.push({ key: c.key, label: c.label });
    chips.push({ key: 'all', label: 'Everyone' });

    const state = pedState.get(opts.id) || { chip: chips[0].key, search: '' };
    pedState.set(opts.id, state);
    let value = opts.value || '';
    let shown = [];

    const root = WP.el('div', 'wp-pick');
    const main = WP.el('div', 'wp-pick-main');
    const side = WP.el('div', 'wp-pick-col');
    root.appendChild(main);
    root.appendChild(side);

    const tabs = WP.tabs({ id: opts.id + '-chips', inline: true, active: state.chip, tabs: chips,
        onChange: (k) => { state.chip = k; draw(); } });
    main.appendChild(searchBox('Search everyone…', state.search, (q) => { state.search = q; draw(); }));
    main.appendChild(tabs.root);
    const count = WP.el('div', 'wp-list-count wp-flush');
    main.appendChild(count);
    const scroll = WP.el('div', 'wp-pick-scroll');
    const grid = WP.el('div', 'wp-tiles wp-tiles-tall');
    scroll.appendChild(grid);
    main.appendChild(scroll);

    let hero = pedPortrait(value);
    side.appendChild(hero);
    const name = WP.el('div', 'wp-pick-name');
    side.appendChild(name);
    const sub = WP.el('div', 'wp-item-sub');
    side.appendChild(sub);
    for (const el of opts.side || []) side.appendChild(el);

    function list() {
        const q = state.search.trim().toLowerCase();
        // A search reaches across everyone, whatever chip is open (the world builder's rule: "sofa"
        // finding nothing because you were looking at Lighting reads as "we have none").
        if (q) return PEDS.filter((p) => (p.model + ' ' + p.name).toLowerCase().indexOf(q) >= 0);
        if (state.chip === 'suggested') return suggested.map((m) => PED_OF[m]);
        if (state.chip === 'all') return PEDS;
        return PEDS.filter((p) => p.category === state.chip);
    }

    function tile(p) {
        const b = WP.el('button', 'wp-tile' + (p.model === value ? ' active' : ''));
        b.type = 'button';
        b.title = p.model;
        b.dataset.model = p.model;
        b.appendChild(picture(pedImageUrl(p.model), b, 'wp-tile-img'));
        const art = WP.el('span', 'wp-tile-art');
        art.innerHTML = PERSON_ICON;
        b.appendChild(art);
        b.appendChild(WP.el('span', 'wp-tile-name', p.name));
        return b;
    }

    function drawHero() {
        const next = pedPortrait(value);
        hero.replaceWith(next);
        hero = next;
        name.textContent = value ? pedName(value) : 'Nobody picked yet';
        sub.textContent = value || 'Pick someone from the pictures';
    }

    function draw() {
        shown = list();
        // A search is across everyone: the chips stand back while one is typed.
        tabs.root.style.opacity = state.search.trim() ? '0.4' : '';
        grid.innerHTML = '';
        for (const p of shown) grid.appendChild(tile(p));
        if (!shown.length) grid.appendChild(WP.empty('Nobody matches that'));
        count.textContent = shown.length + (shown.length === 1 ? ' person' : ' people');
    }

    grid.addEventListener('click', (e) => {
        const b = e.target.closest('.wp-tile');
        if (!b || !grid.contains(b)) return;
        value = b.dataset.model;
        for (const t of grid.children) t.classList.toggle('active', t === b);
        drawHero();
        if (opts.onPick) opts.onPick(value);
    });

    draw();
    drawHero();
    // The one picked, in view: it may be well down the list.
    const picked = value && grid.querySelector('.wp-tile.active');
    if (picked) setTimeout(() => picked.scrollIntoView({ block: 'nearest' }), 0);

    return {
        root,
        visible: () => shown.map((p) => ({ model: p.model, name: p.name })),
    };
}

// ---- the prop picker ----

const propState = new Map();   // id -> { chip, search }

/** A prop's picture, large: the picker's side, or a container's page. The category's glyph if none. */
export function propPortrait(model, hasImage, glyph) {
    const hero = WP.el('div', 'wp-pick-hero wp-hero-square');
    if (model && hasImage !== false) hero.appendChild(picture(propImageUrl(model), hero));
    else hero.classList.add('wp-noimg');
    const art = WP.el('span', 'wp-tile-art');
    art.innerHTML = GLYPHS[glyph] || GLYPHS.box;
    hero.appendChild(art);
    return hero;
}

/**
 *   const pick = propPicker({
 *       id: 'cw-props',                 // unique in the panel (the chips are a WP.tabs)
 *       catalog: { categories, props }, // the furnisher's (Furnisher.catalog, via a section's call)
 *       value: 'prop_box_wood02a',      // the one picked, or ''
 *       first: 'crates',                // the chip it opens on, the first time
 *       side: [el, ...],                // under the large picture: the caller's buttons
 *       onPick(model),
 *   });
 *
 * The NPC picker's way with props: a search across everything, a chip per category, the pictures as tiles, the one
 * picked shown large. A model the catalog does not list can still be typed under the picture.
 */
export function propPicker(opts) {
    const cat = opts.catalog || {};
    const props = Array.isArray(cat.props) ? cat.props : Object.values(cat.props || {});
    const cats = Array.isArray(cat.categories) ? cat.categories : Object.values(cat.categories || {});
    const byModel = {};
    for (const p of props) byModel[p.model] = p;
    const glyphOf = {};
    for (const c of cats) glyphOf[c.key] = c.glyph;

    const chips = cats.filter((c) => props.some((p) => p.category === c.key)).map((c) => ({ key: c.key, label: c.label }));
    chips.push({ key: 'all', label: 'Everything' });
    const firstChip = chips.some((c) => c.key === opts.first) ? opts.first : chips[0].key;
    const state = propState.get(opts.id) || { chip: firstChip, search: '' };
    propState.set(opts.id, state);
    let value = opts.value || '';
    let shown = [];

    const root = WP.el('div', 'wp-pick');
    const main = WP.el('div', 'wp-pick-main');
    const side = WP.el('div', 'wp-pick-col');
    root.appendChild(main);
    root.appendChild(side);

    const tabs = WP.tabs({ id: opts.id + '-chips', inline: true, active: state.chip, tabs: chips,
        onChange: (k) => { state.chip = k; draw(); } });
    main.appendChild(searchBox('Search props…', state.search, (q) => { state.search = q; draw(); }));
    main.appendChild(tabs.root);
    const count = WP.el('div', 'wp-list-count wp-flush');
    main.appendChild(count);
    const scroll = WP.el('div', 'wp-pick-scroll');
    const grid = WP.el('div', 'wp-tiles');
    scroll.appendChild(grid);
    main.appendChild(scroll);

    let hero = null;
    const heroSlot = WP.el('div');
    side.appendChild(heroSlot);
    const name = WP.el('div', 'wp-pick-name');
    side.appendChild(name);
    const sub = WP.el('div', 'wp-item-sub');
    side.appendChild(sub);

    // Not in the catalog? Typed here: any model the game has (the server checks the name's shape,
    // and the world step says plainly if it will not load).
    const typed = WP.input({ placeholder: 'or type a model name', value: byModel[value] ? '' : value });
    typed.addEventListener('change', () => {
        const m = typed.value.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,80}$/.test(m)) return;
        value = m;
        for (const t of grid.children) t.classList.toggle('active', t.dataset && t.dataset.model === m);
        drawHero();
        if (opts.onPick) opts.onPick(value);
    });
    side.appendChild(WP.field('Model', typed, true));
    for (const el of opts.side || []) side.appendChild(el);

    function list() {
        const q = state.search.trim().toLowerCase();
        // A search reaches across everything, whatever chip is open (the world builder's rule).
        if (q) return props.filter((p) => (p.model + ' ' + (p.name || '')).toLowerCase().indexOf(q) >= 0);
        if (state.chip === 'all') return props;
        return props.filter((p) => p.category === state.chip);
    }

    function tile(p) {
        const b = WP.el('button', 'wp-tile' + (p.model === value ? ' active' : ''));
        b.type = 'button';
        b.title = p.model;
        b.dataset.model = p.model;
        if (p.hasImage !== false) b.appendChild(picture(propImageUrl(p.model), b, 'wp-tile-img'));
        else b.classList.add('wp-noimg');
        const art = WP.el('span', 'wp-tile-art');
        art.innerHTML = GLYPHS[glyphOf[p.category]] || GLYPHS.box;
        b.appendChild(art);
        b.appendChild(WP.el('span', 'wp-tile-name', p.name || p.model));
        return b;
    }

    function drawHero() {
        const p = byModel[value];
        const next = propPortrait(value, p ? p.hasImage : true, p && glyphOf[p.category]);
        if (hero) hero.replaceWith(next); else heroSlot.appendChild(next);
        hero = next;
        name.textContent = value ? (p && p.name) || value : 'Nothing picked yet';
        sub.textContent = value || 'Pick one from the pictures';
    }

    // DRAWN IN CHUNKS AS IT SCROLLS (the furnisher's way): every prop in the game is in the catalog (some 16,500), and
    // Everything as one grid of pictures would build them all at once. The one picked is always drawn.
    const TILE_CHUNK = 200;
    let drawn = 0;
    function more(upTo) {
        const end = Math.min(shown.length, Math.max(drawn + TILE_CHUNK, upTo || 0));
        for (let i = drawn; i < end; i++) grid.appendChild(tile(shown[i]));
        drawn = end;
    }
    scroll.addEventListener('scroll', () => {
        if (drawn < shown.length && scroll.scrollTop + scroll.clientHeight > scroll.scrollHeight - 400) more();
    });

    function draw() {
        shown = list();
        tabs.root.style.opacity = state.search.trim() ? '0.4' : '';
        grid.innerHTML = '';
        drawn = 0;
        if (shown.length) {
            const at = value ? shown.findIndex((p) => p.model === value) : -1;
            more(at + 1);
        }
        if (!shown.length) grid.appendChild(WP.empty(props.length ? 'Nothing matches that' : 'The prop list has not arrived yet'));
        count.textContent = shown.length + (shown.length === 1 ? ' prop' : ' props');
    }

    grid.addEventListener('click', (e) => {
        const b = e.target.closest('.wp-tile');
        if (!b || !grid.contains(b)) return;
        value = b.dataset.model;
        typed.value = '';
        for (const t of grid.children) t.classList.toggle('active', t === b);
        drawHero();
        if (opts.onPick) opts.onPick(value);
    });

    draw();
    drawHero();
    const picked = value && grid.querySelector('.wp-tile.active');
    if (picked) setTimeout(() => picked.scrollIntoView({ block: 'nearest' }), 0);

    return { root };
}

// ---- the vehicle picker ----

/** GTA's vehicle classes, by the number the catalog keeps (GET_VEHICLE_CLASS). */
export const VEHICLE_CLASSES = ['Compacts', 'Sedans', 'SUVs', 'Coupes', 'Muscle', 'Sports Classics', 'Sports', 'Super',
    'Motorcycles', 'Off-road', 'Industrial', 'Utility', 'Vans', 'Cycles', 'Boats', 'Helicopters', 'Planes', 'Service',
    'Emergency', 'Military', 'Commercial', 'Trains', 'Open Wheel'];

const vehState = new Map();   // id -> { chip, search }

/** whip's car (js/glyphs.js: the head-on one the car prompts and the garage rows wear), the furnisher's if that
 *  script is missing. */
function carGlyph() {
    const g = window.WhipGlyphs && window.WhipGlyphs.glyphs;
    return (g && g.car) || GLYPHS.car;
}

/** A vehicle's picture, large and wide (whip_assets' snapshots): the picker's side. The car glyph if none. */
export function vehiclePortrait(model, hasImage) {
    const hero = WP.el('div', 'wp-pick-hero wp-hero-wide');
    if (model && hasImage !== false) hero.appendChild(picture(vehicleImageUrl(model), hero));
    else hero.classList.add('wp-noimg');
    const art = WP.el('span', 'wp-tile-art');
    art.innerHTML = carGlyph();
    hero.appendChild(art);
    return hero;
}

/** One vehicle as a picture tile over its name (c: a vmCatalog row, { model, name, img, url }): the wizard's picker
 *  and the Vehicle Adjustments page. The car glyph where it has no picture. */
export function vehicleTile(c) {
    const b = WP.el('button', 'wp-tile');
    b.type = 'button';
    b.title = c.model;
    b.dataset.model = c.model;
    if (c.img !== false) b.appendChild(picture(c.url || vehicleImageUrl(c.model), b, 'wp-tile-img'));
    else b.classList.add('wp-noimg');
    const art = WP.el('span', 'wp-tile-art');
    art.innerHTML = carGlyph();
    b.appendChild(art);
    b.appendChild(WP.el('span', 'wp-tile-name', c.name || c.model));
    return b;
}

/** The vehicle tiles' narrowest width (px): as many as fit across the grid at this, stretched to fill the row. */
const VEHICLE_TILE_MIN = 200;

/**
 *   const pick = vehiclePicker({
 *       id: 'vw-cars',
 *       state: {},                               // optional: the chip and the search, kept by the caller (else
 *                                                //   by id, for as long as the page lives)
 *       vehicles: [{ model, name, cls, img }],   // the catalog (vmCatalog)
 *       value: 'adder',                          // the one picked, or ''
 *       side: [el, ...],                         // under the picture: the caller's
 *       onPick(model),
 *   });
 *
 * The prop picker's way with vehicles (the new-vehicle wizard): a search across every model, the pictures as big
 * tiles filling the row, and beside them the one picked large, the Model box, and small chips per class under it
 * (All first, and open). A model the catalog does not list (an add-on car) can still be typed in the Model box: the
 * server says if the game cannot load it.
 */
export function vehiclePicker(opts) {
    const cars = opts.vehicles || [];
    const byModel = {};
    for (const c of cars) byModel[c.model] = c;
    const present = new Set(cars.map((c) => c.cls));
    const chips = [{ key: 'all', label: 'All' }].concat(
        VEHICLE_CLASSES.map((label, i) => ({ key: String(i), label })).filter((c) => present.has(Number(c.key))));
    const state = opts.state || vehState.get(opts.id) || {};
    if (typeof state.chip !== 'string' || !chips.some((c) => c.key === state.chip)) state.chip = 'all';
    if (typeof state.search !== 'string') state.search = '';
    if (!opts.state) vehState.set(opts.id, state);
    let value = opts.value || '';
    let shown = [];

    const root = WP.el('div', 'wp-pick');
    const main = WP.el('div', 'wp-pick-main');
    const side = WP.el('div', 'wp-pick-col');
    root.appendChild(main);
    root.appendChild(side);

    // The class chips: small, wrapping, under the Model box (Josh, 1 Nov: across the top they ran off the screen).
    const tabs = WP.tabs({ id: opts.id + '-chips', inline: true, active: state.chip, tabs: chips,
        onChange: (k) => { state.chip = k; draw(); } });
    tabs.root.classList.add('wp-tabs-small');
    main.appendChild(searchBox('Search vehicles…', state.search, (q) => { state.search = q; draw(); }));
    const count = WP.el('div', 'wp-list-count wp-flush');
    main.appendChild(count);
    const scroll = WP.el('div', 'wp-pick-scroll');
    const grid = WP.el('div', 'wp-tiles wp-tiles-wide');
    scroll.appendChild(grid);
    main.appendChild(scroll);

    // THE TILES FILL THE ROW: as many columns as fit at VEHICLE_TILE_MIN, each as wide as shares the row out. Worked
    // out here because the tiles are flex-wrap, not a grid (.wp-tiles: CEF's hit-testing in a zoomed grid).
    const fitTiles = () => {
        const w = grid.clientWidth;
        if (!w) return;
        const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
        const cols = Math.max(1, Math.floor((w + gap) / (VEHICLE_TILE_MIN + gap)));
        grid.style.setProperty('--wp-tile-w', Math.floor((w - gap * (cols - 1)) / cols - 0.5) + 'px');
    };
    if (window.ResizeObserver) new ResizeObserver(fitTiles).observe(grid);

    let hero = null;
    const heroSlot = WP.el('div');
    side.appendChild(heroSlot);
    const name = WP.el('div', 'wp-pick-name');
    side.appendChild(name);
    const sub = WP.el('div', 'wp-item-sub');
    side.appendChild(sub);
    const typed = WP.input({ placeholder: 'or type a model name', value: byModel[value] ? '' : value });
    typed.addEventListener('change', () => {
        const m = typed.value.trim().toLowerCase();
        if (!/^[a-z0-9_-]{2,60}$/.test(m)) return;
        value = m;
        for (const t of grid.children) t.classList.toggle('active', t.dataset && t.dataset.model === m);
        drawHero();
        if (opts.onPick) opts.onPick(value);
    });
    side.appendChild(WP.field('Model', typed, true));
    side.appendChild(tabs.root);
    for (const el of opts.side || []) side.appendChild(el);

    function list() {
        const q = state.search.trim().toLowerCase();
        if (q) return cars.filter((c) => (c.model + ' ' + (c.name || '')).toLowerCase().indexOf(q) >= 0);
        if (state.chip === 'all') return cars;
        return cars.filter((c) => String(c.cls) === state.chip);
    }

    function tile(c) {
        const b = vehicleTile(c);
        if (c.model === value) b.classList.add('active');
        return b;
    }

    function drawHero() {
        const c = byModel[value];
        const next = vehiclePortrait(value, c ? c.img : true);
        if (hero) hero.replaceWith(next); else heroSlot.appendChild(next);
        hero = next;
        name.textContent = value ? (c && c.name) || value : 'Nothing picked yet';
        sub.textContent = value ? value + (c && VEHICLE_CLASSES[c.cls] ? '  ·  ' + VEHICLE_CLASSES[c.cls] : '') : 'Pick one from the pictures';
    }

    function draw() {
        shown = list();
        tabs.root.style.opacity = state.search.trim() ? '0.4' : '';
        grid.innerHTML = '';
        for (const c of shown) grid.appendChild(tile(c));
        if (!shown.length) grid.appendChild(WP.empty(cars.length ? 'Nothing matches that' : 'The vehicle list has not arrived yet'));
        count.textContent = shown.length + (shown.length === 1 ? ' vehicle' : ' vehicles');
    }

    grid.addEventListener('click', (e) => {
        const b = e.target.closest('.wp-tile');
        if (!b || !grid.contains(b)) return;
        value = b.dataset.model;
        typed.value = '';
        for (const t of grid.children) t.classList.toggle('active', t === b);
        drawHero();
        if (opts.onPick) opts.onPick(value);
    });

    draw();
    drawHero();
    const picked = value && grid.querySelector('.wp-tile.active');
    if (picked) setTimeout(() => picked.scrollIntoView({ block: 'nearest' }), 0);

    return { root };
}

// ---- the item pictures ----

/**
 *   const pick = itemTiles({
 *       id: 'il-items',
 *       items: { key: { name, img } },          // every item (the Item Log's alSetup list)
 *       value: 'food',                          // the one picked now, or ''
 *       groups: [{ key, label, load }],         // chips before "All": load() → Promise of
 *                                               //   [{ key, n }] busiest first (null: not read),
 *                                               //   asked the first time its chip is shown
 *       first: 'week',                          // the chip it opens on
 *       onPick(key),
 *   });
 *   pane.appendChild(pick.root);
 *
 * The NPC picker's way with items: a search across everything, a few chips, and the pictures; a
 * group's tiles carry how many times each was counted. A click picks one.
 */
export function itemTiles(opts) {
    const items = opts.items || {};
    const groups = opts.groups || [];
    const label = (k) => (items[k] && items[k].name) || k;
    const chips = groups.map((g) => ({ key: g.key, label: g.label })).concat([{ key: 'all', label: 'All' }]);
    let chip = chips.some((c) => c.key === opts.first) ? opts.first : chips[0].key;
    let search = '';
    const loaded = {};   // group key -> [{ key, n }] | 'loading' | 'failed'

    const root = WP.el('div', 'wp-pick-main');
    const tabs = WP.tabs({ id: opts.id + '-chips', inline: true, active: chip, tabs: chips,
        onChange: (k) => { chip = k; draw(); } });
    const box = searchBox('Search every item…', '', (q) => { search = q; draw(); });
    box.style.flex = '0 0 auto';
    root.appendChild(box);
    root.appendChild(tabs.root);
    const count = WP.el('div', 'wp-list-count wp-flush');
    root.appendChild(count);
    const grid = WP.el('div', 'wp-tiles');
    root.appendChild(grid);

    /** A group's list, asked for the first time it is wanted. */
    function groupList(key) {
        if (loaded[key] === undefined) {
            const g = groups.find((x) => x.key === key);
            loaded[key] = 'loading';
            Promise.resolve(g && g.load ? g.load() : null).catch(() => null).then((list) => {
                loaded[key] = Array.isArray(list) ? list.filter((x) => x && x.key) : 'failed';
                if (chip === key) draw();
            });
        }
        return loaded[key];
    }

    /** The keys to show, or a sentence saying why there are none. */
    function list() {
        const q = search.trim().toLowerCase();
        // A search reaches across every item, whatever chip is open (the NPC picker's rule).
        if (q) {
            return Object.keys(items).filter((k) => k.toLowerCase().includes(q) || label(k).toLowerCase().includes(q))
                .sort((a, b) => label(a).localeCompare(label(b)));
        }
        if (chip === 'all') return Object.keys(items).sort((a, b) => label(a).localeCompare(label(b)));
        const g = groupList(chip);
        if (g === 'loading') return 'Reading the log…';
        if (g === 'failed') return 'The log could not be read for that: try a shorter one, or All';
        return g.map((x) => x.key);
    }

    /** How many times each was counted, in the group whose chip is open. */
    function counts() {
        const g = chip !== 'all' && Array.isArray(loaded[chip]) ? loaded[chip] : [];
        const out = {};
        for (const x of g) out[x.key] = x.n;
        return out;
    }

    function tile(k, n) {
        const b = WP.el('button', 'wp-tile' + (k === opts.value ? ' active' : ''));
        b.type = 'button';
        b.dataset.key = k;
        b.title = k;
        const img = document.createElement('img');
        img.className = 'wp-tile-img';
        img.alt = '';
        img.loading = 'lazy';
        img.dataset.itemImg = '';   // the item icon's own two-step fallback (utils.js)
        img.dataset.itemKey = k;
        img.src = itemImageUrl(k, items[k] && items[k].img);
        b.appendChild(img);
        b.appendChild(WP.el('span', 'wp-tile-name', label(k)));
        if (n) {
            const badge = WP.el('span', 'wp-tile-badge', n.toLocaleString('en-US'));
            badge.title = 'moved ' + n + ' time' + (n === 1 ? '' : 's');
            b.appendChild(badge);
        }
        return b;
    }

    function draw() {
        const keys = list();
        tabs.root.style.opacity = search.trim() ? '0.4' : '';
        grid.innerHTML = '';
        if (typeof keys === 'string') {
            grid.appendChild(WP.empty(keys));
            count.textContent = '';
            return;
        }
        const n = counts();
        for (const k of keys) grid.appendChild(tile(k, n[k]));
        if (!keys.length) {
            const c = chips.find((x) => x.key === chip);
            grid.appendChild(WP.empty(search.trim() ? 'No item matches that'
                : 'Nothing ' + (c ? c.label.replace(/^Moved /, 'moved ') : 'here') + '. Try a longer time, or All.'));
        }
        count.textContent = keys.length + (keys.length === 1 ? ' item' : ' items');
    }

    grid.addEventListener('click', (e) => {
        const b = e.target.closest('.wp-tile');
        if (b && grid.contains(b) && opts.onPick) opts.onPick(b.dataset.key);
    });

    draw();
    return { root, focus: () => { const i = box.querySelector('input'); if (i) i.focus(); } };
}

// ---- finding a person ----

// ---- a person's face ----
//
// THEIR PORTRAIT: GTA's headshot of the character, taken in game and kept by the server
// (server/portraits.lua). Asked for in batches — every avatar drawn in one go joins one request — and
// kept here a few minutes; a character with none keeps their initials.

const PORTRAIT_TTL_MS = 5 * 60 * 1000;
const PORTRAIT_PAGE = 20;            // server/portraits.lua answers at most this many at once
const portraitCache = new Map();     // charId -> { url: string|null, at }
const portraitWaiting = new Map();   // charId -> [avatar elements to fill]
const portraitFlying = new Set();    // charIds asked for and not answered yet: never asked twice
let portraitAsk = null;              // the ids gathered for the next request

function fillPortrait(el, url) {
    if (!url || el.querySelector('.wp-avatar-img')) return;
    const img = document.createElement('img');
    img.className = 'wp-avatar-img';
    img.alt = '';
    img.src = url;
    el.insertBefore(img, el.firstChild);
    el.classList.add('has-portrait');
}

async function askPortraits() {
    const ids = Array.from(portraitAsk || []);
    portraitAsk = null;
    for (const id of ids) portraitFlying.add(id);
    // A page at a time, each after the last is answered: a long Players list is many pages, and the
    // server's rate limit refuses a burst of them.
    for (let i = 0; i < ids.length; i += PORTRAIT_PAGE) {
        const page = ids.slice(i, i + PORTRAIT_PAGE);
        let res = null;
        try { res = await nuiCallback('wpPortraits', { charIds: page }); } catch (e) { res = null; }
        const answered = res && res.ok === true;   // {} is a call that failed: asked again next time
        const got = (answered && res.portraits) || {};
        for (const id of page) {
            portraitFlying.delete(id);
            const url = got[String(id)] || null;
            if (answered) portraitCache.set(id, { url, at: Date.now() });
            const waiting = portraitWaiting.get(id) || [];
            portraitWaiting.delete(id);
            for (const el of waiting) fillPortrait(el, url);
        }
    }
}

function wantPortrait(charId, el) {
    const id = Number(charId);
    if (!(id > 0)) return;
    const hit = portraitCache.get(id);
    if (hit && Date.now() - hit.at < PORTRAIT_TTL_MS) { fillPortrait(el, hit.url); return; }
    if (!portraitWaiting.has(id)) portraitWaiting.set(id, []);
    portraitWaiting.get(id).push(el);
    if (portraitFlying.has(id)) return;   // already asked: filled when that answer lands
    if (!portraitAsk) {
        portraitAsk = new Set();
        setTimeout(askPortraits, 0);
    }
    portraitAsk.add(id);
}

/** A person's face in a disc: their portrait when `charId` is given and they have one, their initials
 *  until then (and for good without one), with an on-duty dot when `onDuty` is given. `large` for a
 *  page's head. */
export function avatar(name, onDuty, charId, large) {
    const words = String(name || '?').trim().split(/\s+/);
    const el = WP.el('span', 'wp-avatar' + (large ? ' wp-avatar-lg' : ''));
    el.appendChild(WP.el('span', 'wp-avatar-initials',
        ((words[0] || '?')[0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()));
    if (onDuty !== undefined) {
        const dot = WP.el('span', 'wp-dot' + (onDuty ? ' wp-dot-ok' : ''));
        dot.title = onDuty ? 'On duty' : 'Off duty';
        el.appendChild(dot);
    }
    if (charId) wantPortrait(charId, el);
    return el;
}

/**
 *   const find = personSearch({ placeholder, onPick({ charId, name, online }), skip: (charId) => bool });
 *   step.appendChild(find.root);
 *
 * A name (or a character id) typed, the characters who match listed under it (the panel's own
 * character search, wpCharSearch: online first, living characters only); a click picks one.
 */
export function personSearch(opts) {
    const root = WP.el('div');
    const results = WP.el('div', 'wp-list wp-flush');
    let timer = null;
    const box = searchBox(opts.placeholder || 'Type a name or a character id…', '', (text) => {
        const q = text.trim();
        if (timer) clearTimeout(timer);
        if (q.length < 1 || (q.length < 2 && !/^\d+$/.test(q))) { results.innerHTML = ''; return; }
        timer = setTimeout(() => {
            nuiCallback('wpCharSearch', { q }).then((list) => {
                if (input.value.trim() !== q) return;   // they kept typing
                draw(Array.isArray(list) ? list : []);
            });
        }, 250);
    });
    const input = box.querySelector('input');
    input.classList.remove('wp-section-search');   // '/' is for a step's main search, not this one

    function draw(list) {
        results.innerHTML = '';
        const shown = list.filter((p) => p && p.charId && !(opts.skip && opts.skip(Number(p.charId))));
        for (const p of shown) {
            const row = WP.listItem({ title: p.name || 'Character #' + p.charId,
                sub: '#' + p.charId + (p.online ? ' · online now' : ''), pill: 'Pick', pillClass: 'wp-pill-accent' });
            row.addEventListener('click', () => {
                results.innerHTML = '';
                input.value = '';
                opts.onPick({ charId: Number(p.charId), name: p.name || 'Character #' + p.charId, online: !!p.online });
            });
            results.appendChild(row);
        }
        if (!shown.length) results.appendChild(WP.empty(list.length ? 'Everyone found is already here' : 'Nobody by that name'));
    }

    root.appendChild(box);
    root.appendChild(results);
    return { root, focus: () => input.focus() };
}

// ---- the item list ----

const listState = new Map();   // id -> { search, resource }

/**
 *   const list = itemList({
 *       id: 'sw-items',
 *       items: { key: { name, type, weight, resource, img } },   // the Item Browser's (ibBuildItemList)
 *       picked: (key) => true | false,
 *       pill: (key) => 'text' | null,     // optional: what a picked row says (its price)
 *       onToggle(key),
 *   });
 *   col.appendChild(list.root);   list.refresh()   (after the picked set changed)
 */
export function itemList(opts) {
    const items = opts.items || {};
    const state = listState.get(opts.id) || { search: '', resource: '' };
    listState.set(opts.id, state);

    const root = WP.el('div', 'wp-pick-col');
    root.appendChild(searchBox('Search items…', state.search, (q) => { state.search = q; draw(); }));

    const resources = [...new Set(Object.keys(items).map((k) => items[k].resource || 'whip_core'))].sort();
    if (state.resource && resources.indexOf(state.resource) < 0) state.resource = '';
    const res = WP.select([{ value: '', label: 'All resources' }].concat(resources.map((r) => ({ value: r, label: r }))));
    res.value = state.resource;
    res.addEventListener('change', () => { state.resource = res.value; draw(); });
    root.appendChild(res);

    const count = WP.el('div', 'wp-list-count wp-flush');
    root.appendChild(count);
    const scroll = WP.el('div', 'wp-pick-scroll');
    root.appendChild(scroll);

    function keys() {
        const q = state.search.trim().toLowerCase();
        return Object.keys(items).filter((k) => {
            const it = items[k];
            if (state.resource && (it.resource || 'whip_core') !== state.resource) return false;
            return !q || k.toLowerCase().indexOf(q) >= 0 || String(it.name || '').toLowerCase().indexOf(q) >= 0;
        }).sort((a, b) => String(items[a].name || a).toLowerCase().localeCompare(String(items[b].name || b).toLowerCase()));
    }

    function row(k) {
        const it = items[k];
        const r = WP.listItem({ title: it.name || k, sub: k + (it.type ? ' · ' + it.type : '') });
        r.dataset.key = k;
        const img = document.createElement('img');
        img.width = 32;
        img.height = 32;
        img.dataset.itemImg = '';
        img.dataset.itemKey = k;
        img.src = itemImageUrl(k, it.img);
        r.firstChild.insertBefore(img, r.firstChild.firstChild);
        paint(r);
        return r;
    }

    /** A row as picked or not: the chosen card, and a pill saying so. In place, so the list keeps
     *  its scroll when a pick changes. */
    function paint(r) {
        const k = r.dataset.key;
        const on = !!opts.picked(k);
        r.classList.toggle('active', on);
        const top = r.firstChild;
        const old = top.querySelector('.wp-pill');
        if (old) old.remove();
        if (on) top.appendChild(WP.el('span', 'wp-pill wp-pill-ok', (opts.pill && opts.pill(k)) || 'Picked'));
    }

    function draw() {
        const list = keys();
        scroll.innerHTML = '';
        for (const k of list) scroll.appendChild(row(k));
        if (!list.length) scroll.appendChild(WP.empty(state.search || state.resource ? 'No items match' : 'No items'));
        count.textContent = list.length + ' of ' + Object.keys(items).length;
    }

    scroll.addEventListener('click', (e) => {
        const r = e.target.closest('.wp-list-item');
        if (r && scroll.contains(r) && opts.onToggle) opts.onToggle(r.dataset.key);
    });

    draw();
    return {
        root,
        refresh: () => { for (const r of scroll.querySelectorAll('.wp-list-item')) paint(r); },
    };
}

// ========================================
// A MAP BLIP'S COLOUR (the shop and garage wizards' Map steps)
// ========================================

/** Blip colours by GTA colour id, with roughly how the map draws them. */
export const BLIP_COLOURS = [
    [2, 'Green', '#72cc72'], [0, 'White', '#f0f0f0'], [1, 'Red', '#e03232'], [3, 'Blue', '#5db6e5'],
    [5, 'Yellow', '#eec64e'], [17, 'Orange', '#f08c3c'], [27, 'Purple', '#a05ad2'], [8, 'Pink', '#f0a0c8'],
    [25, 'Dark green', '#3c8c3c'], [38, 'Dark blue', '#2c6ed1'], [40, 'Grey', '#8a8a8a'],
];

/** The map's own way of colouring a blip (pause-map.js tint): the white icon's brightness times the
 *  colour, as an SVG filter (#wp-blip-tint) the icons name. A CSS mask would be simpler and draws nothing in
 *  the game: whip_assets is another origin, and a mask needs an image it is allowed to read. */
export function blipTintFilter(hex) {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const row = (c) => [0.2126 * c, 0.7152 * c, 0.0722 * c, 0, 0].map((v) => v.toFixed(4)).join(' ');
    const holder = WP.el('div');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = '<svg width="0" height="0"><filter id="wp-blip-tint" color-interpolation-filters="sRGB">'
        + '<feColorMatrix type="matrix" values="' + row(rgb[0]) + ' ' + row(rgb[1]) + ' ' + row(rgb[2]) + ' 0 0 0 1 0"/>'
        + '</filter></svg>';
    return holder;
}
