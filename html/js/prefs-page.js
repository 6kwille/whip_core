// ========================================
// SERVER SETTINGS — the pause menu's page of each player's own choices (client/player_prefs.lua), just below
// GTA's own Settings. The menu slides away as it does for Controller; a tab per group (Controller, Vehicles, Map & HUD,
// Minimap, Chat & voice). On the left a row per setting — a switch, a row of choices, or a slider — scrolling, with
// "More below" while there is; on the right what the chosen row does and what the server's default is. Top right,
// "Reset this page to server defaults" puts that tab's rows back (after a yes).
//
// LUA OWNS THE VALUES. Every change goes to client/player_prefs.lua ('prefsSet' / 'prefsReset'), which checks it,
// keeps it on the player's PC (or hands it to the resource that owns the row) and answers with every row as it now
// is; the page only draws what it is told. A row with a dot differs from the server's default.
//
// Keyboard, mouse and pad: up / down choose a row, left / right change it, Enter or A switches or steps a choice,
// Q / E or LB / RB the tabs, R or Y reset the page, Esc or B back to the menu. pause.js hands keys and the pad over in
// this mode, as it does for the Controller screen.
//
// THE MINIMAP TAB has the minimap on the right, big (minimap.js MinimapPreview): every change shows on it at once — a
// slider while it is dragged — through prefs.js setPref, ahead of Lua's answer. Under it, two rows of the page's own,
// not settings (nothing goes to Lua): show it on foot or in a car, and the car's speed. They are rows like the others,
// after the list's, so the keys and the pad reach them the same way.
// ========================================

import { nuiCallback, escapeHtml } from './utils.js';
import { padGlyph } from './pad-glyphs.js';
import { NuiRouter } from './router.js';
import { screenRect } from './pad-cursor.js';
import { setPref } from './prefs.js';
import { MinimapPreview, previewSpeedRange, minimapAspect } from './minimap.js';

/** The group whose tab shows the minimap's preview (client/minimap.lua's rows). */
const MINIMAP_GROUP = 'Minimap';

/** A slider's value as words: "120%", "300 ms". */
function valueText(row, v) {
    if (row.type !== 'slider') return '';
    const n = Number(v);
    const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    if (!row.unit) return s;
    return row.unit === '%' ? s + '%' : s + ' ' + row.unit;
}

/** A row's value as words, for the "server default". */
function valueWords(row, v) {
    if (row.type === 'toggle') return v ? 'On' : 'Off';
    if (row.type === 'choice') return (row.options || []).find((o) => o.value === v)?.label ?? String(v);
    return valueText(row, v);
}

/** A slider's value from where on its track (0-1), in its steps. */
function sliderAt(row, frac) {
    const min = Number(row.min), max = Number(row.max), step = Number(row.step) || 1;
    const raw = min + Math.max(0, Math.min(1, frac)) * (max - min);
    return Math.max(min, Math.min(max, min + Math.round((raw - min) / step) * step));
}

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" '
    + 'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class PrefsPage {
    /** @param {HTMLElement} root  the pause menu's root; @param {() => void} onBack  back to its menu */
    constructor(root, onBack) {
        this.onBack = onBack;
        this.state = null;          // { groups: [{ id, label, rows }], changed }
        this.tab = 0;               // the group shown
        this.sel = 0;               // its row chosen
        this.focus = 'rows';        // 'rows' | 'confirm'
        this.confirmSel = 1;        // Cancel, by default
        this.note = '';             // a refused change or a reset, said where the help is
        this.isOpen = false;
        this.drag = null;           // a slider being dragged: { row, track, value }
        this.seq = 0;               // each change's number: only the newest one's answer is drawn
        this.preview = null;        // the minimap's preview, while the Minimap tab is up
        this.previewMode = 'car';   // its rows: on foot or in a car...
        this.previewSpeed = 60;     // ...and the car's speed, in the dial's unit

        const wrap = document.createElement('section');
        wrap.className = 'pm-prefs';
        wrap.innerHTML = `
            <header class="pl-head">
                <button class="pm-back pl-back" type="button"><span class="pm-back-arrow">&#8592;</span> Menu</button>
                <div class="pl-title">Server Settings</div>
                <nav class="pl-tabs pf-tabs"></nav>
                <div class="pl-side pf-side">
                    <button class="pl-reset pf-reset" type="button">Reset this page to server defaults</button>
                    <div class="pl-confirm">
                        <span class="pl-confirm-q">Reset this page?</span>
                        <button class="pl-cbtn" data-c="0" type="button">Reset</button>
                        <button class="pl-cbtn" data-c="1" type="button">Cancel</button>
                    </div>
                </div>
            </header>
            <div class="pf-body">
                <div class="pf-listwrap">
                    <div class="pf-scroll"><div class="pf-list"></div></div>
                    <button class="pf-more" type="button" tabindex="-1">More below ${CHEVRON}</button>
                </div>
                <aside class="pf-aside">
                    <div class="pf-mm-slot"></div>
                    <div class="pf-mm-status"></div>
                    <div class="pf-mm-rows"></div>
                    <div class="pf-help">
                        <div class="pf-help-name"></div>
                        <div class="pf-help-text"></div>
                        <div class="pf-help-default"></div>
                    </div>
                </aside>
            </div>`;
        root.appendChild(wrap);
        this.wrap = wrap;
        // The preview's own place: in the page's frame, laid over .pf-mm-slot (placePreview), not in the zoomed body —
        // a canvas is drawn in true px.
        this.previewHost = document.createElement('div');
        this.previewHost.className = 'pf-preview';
        wrap.appendChild(this.previewHost);
        this.tabsEl = wrap.querySelector('.pf-tabs');
        this.bodyEl = wrap.querySelector('.pf-body');
        this.listWrap = wrap.querySelector('.pf-listwrap');
        this.scrollEl = wrap.querySelector('.pf-scroll');
        this.listEl = wrap.querySelector('.pf-list');
        this.mmSlot = wrap.querySelector('.pf-mm-slot');
        this.mmStatus = wrap.querySelector('.pf-mm-status');
        this.mmRows = wrap.querySelector('.pf-mm-rows');
        this.helpName = wrap.querySelector('.pf-help-name');
        this.helpText = wrap.querySelector('.pf-help-text');
        this.helpDefault = wrap.querySelector('.pf-help-default');
        this.resetBtn = wrap.querySelector('.pf-reset');
        this.confirmEl = wrap.querySelector('.pl-confirm');
        this.confirmBtns = [...wrap.querySelectorAll('.pl-cbtn')];

        // ---- mouse (on the body: the rows are in the list and, on the Minimap tab, under the preview) ----
        wrap.querySelector('.pl-back').addEventListener('click', () => this.onBack());
        this.tabsEl.addEventListener('click', (e) => {
            const t = e.target.closest('.pl-tab');
            if (t) this.setTab(Number(t.dataset.i));
        });
        // MOUSEMOVE, NOT MOUSEOVER: every draw rebuilds the rows, and Chrome sends a fresh
        // mouseover to the new row under a mouse that never moved — which would take the choice back from the keys and pad.
        this.bodyEl.addEventListener('mousemove', (e) => {
            const r = e.target.closest('.pf-row');
            if (!r || this.focus !== 'rows' || this.drag) return;
            const i = Number(r.dataset.i);
            if (i !== this.sel) { this.sel = i; this.draw(); }
        });
        this.bodyEl.addEventListener('click', (e) => {
            const r = e.target.closest('.pf-row');
            if (!r) return;
            this.sel = Number(r.dataset.i);
            this.focus = 'rows';
            const row = this.row();
            if (!row) return;
            const opt = e.target.closest('.pf-opt');
            if (opt) { this.change(row, row.options[Number(opt.dataset.o)].value); return; }
            if (e.target.closest('.pf-switch') || (row.type === 'toggle' && !e.target.closest('.pf-ctl'))) {
                this.change(row, !row.value);
                return;
            }
            if (row.type === 'slider' && e.target.closest('.pf-step')) {
                this.step(Number(e.target.closest('.pf-step').dataset.d));
                return;
            }
            this.draw();
        });
        // A slider dragged: drawn as it moves, sent once when let go.
        this.bodyEl.addEventListener('pointerdown', (e) => {
            const track = e.target.closest('.pf-track');
            const r = e.target.closest('.pf-row');
            if (!track || !r) return;
            this.sel = Number(r.dataset.i);
            const row = this.row();
            if (!row || row.type !== 'slider' || row.locked) return;
            e.preventDefault();
            this.drag = { row, track, value: row.value };
            track.setPointerCapture?.(e.pointerId);
            this.dragTo(e.clientX);
        });
        this.bodyEl.addEventListener('pointermove', (e) => { if (this.drag) this.dragTo(e.clientX); });
        const endDrag = () => {
            if (!this.drag) return;
            const { row, value } = this.drag;
            this.drag = null;
            if (value !== row.value) this.change(row, value); else this.draw();
        };
        this.bodyEl.addEventListener('pointerup', endDrag);
        this.bodyEl.addEventListener('pointercancel', endDrag);
        this.scrollEl.addEventListener('scroll', () => this.syncMore());
        wrap.querySelector('.pf-more').addEventListener('click', () => {
            this.scrollEl.scrollBy({ top: this.scrollEl.clientHeight * 0.8, behavior: 'smooth' });
        });
        this.resetBtn.addEventListener('click', () => this.askReset());
        this.confirmBtns.forEach((b, i) => {
            b.addEventListener('mouseenter', () => { if (this.focus === 'confirm') { this.confirmSel = i; this.drawReset(); } });
            b.addEventListener('click', () => this.answerReset(i));
        });
        addEventListener('resize', () => {
            if (!this.isOpen) return;
            this.placePreview();
            this.syncMore();
        });
    }

    // ---- open and close ----

    open() {
        this.isOpen = true;
        this.focus = 'rows';
        this.note = '';
        this.draw();
        nuiCallback('prefsState', {}).then((st) => this.setState(st));
    }

    close() {
        this.isOpen = false;
        this.focus = 'rows';
        this.drag = null;
        this.syncPreview();
    }

    /** Every row as Lua has it now. The tab and row chosen stay where they were, found again by name. */
    setState(st) {
        if (!st || !Array.isArray(st.groups)) return;
        const tabId = this.group()?.id;
        const rowKey = this.row()?.key;
        for (const g of st.groups) if (!Array.isArray(g.rows)) g.rows = [];
        this.state = st;
        const t = st.groups.findIndex((g) => g.id === tabId);
        this.tab = t >= 0 ? t : Math.min(this.tab, Math.max(0, st.groups.length - 1));
        const rows = this.rows();
        const r = rows.findIndex((x) => x.key === rowKey);
        this.sel = r >= 0 ? r : Math.min(this.sel, Math.max(0, rows.length - 1));
        if (st.error) this.note = 'Not changed: ' + st.error;
        if (this.isOpen) this.draw();
    }

    group() { return this.state?.groups?.[this.tab] || null; }

    /** The tab's rows: its settings, and on the Minimap tab the preview's own after them. */
    rows() {
        const g = this.group();
        if (!g) return [];
        return g.id === MINIMAP_GROUP && this.isOpen ? g.rows.concat(this.previewRows()) : g.rows;
    }

    row() { return this.rows()[this.sel] || null; }

    /** The preview's rows (`local`: the page's own, nothing goes to Lua). The car's speed only for the car. */
    previewRows() {
        const rows = [{
            key: 'preview.mode', local: true, type: 'choice', label: 'Show it',
            help: 'The preview above as you would see it on foot, or in a car at the speed below. Not a setting: it only '
                + 'shows the minimap here.',
            options: [{ value: 'foot', label: 'On foot' }, { value: 'car', label: 'In a car' }],
            value: this.previewMode,
        }];
        if (this.previewMode === 'car') {
            const r = previewSpeedRange();
            rows.push({
                key: 'preview.speed', local: true, type: 'slider', label: 'Car speed',
                help: 'How fast the preview\'s car goes: watch the zoom and the tilt follow your settings.',
                min: 0, max: r.max, step: r.step, unit: r.unit, value: Math.min(r.max, this.previewSpeed),
            });
        }
        return rows;
    }

    /** A preview row changed: the preview shows it. */
    setLocal(key, value) {
        if (key === 'preview.mode') {
            this.previewMode = value === 'foot' ? 'foot' : 'car';
            this.preview?.setMode(this.previewMode);
        } else if (key === 'preview.speed') {
            this.previewSpeed = Number(value) || 0;
            this.preview?.setSpeed(this.previewSpeed);
        }
    }

    // ---- drawing ----

    draw() {
        const groups = this.state?.groups || [];
        this.wrap.dataset.focus = this.focus;

        // The tabs, LB and RB either side on a pad.
        this.tabsEl.textContent = '';
        const glyph = (g) => {
            const s = document.createElement('span');
            s.className = 'pl-tab-glyph';
            const img = padGlyph(g, 'pl-tab-img');
            if (img) s.appendChild(img);
            return s;
        };
        if (groups.length > 1) this.tabsEl.appendChild(glyph('lb'));
        groups.forEach((g, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'pl-tab' + (i === this.tab ? ' on' : '');
            b.dataset.i = i;
            b.textContent = g.label;
            this.tabsEl.appendChild(b);
        });
        if (groups.length > 1) this.tabsEl.appendChild(glyph('rb'));
        this.tabsEl.classList.toggle('hidden', groups.length === 0);

        // The rows: the settings in the list, the preview's under it (data-i runs on across both).
        const rows = this.rows();
        if (this.sel >= rows.length) this.sel = Math.max(0, rows.length - 1);
        this.listEl.textContent = '';
        this.mmRows.textContent = '';
        if (!this.state) {
            this.listEl.innerHTML = '<div class="pf-empty">Loading…</div>';
        } else if (!(this.group()?.rows?.length)) {
            this.listEl.innerHTML = '<div class="pf-empty">Nothing to set here yet.</div>';
        }
        rows.forEach((row, i) => (row.local ? this.mmRows : this.listEl).appendChild(this.rowEl(row, i)));
        this.listEl.querySelector('.pf-row.on')?.scrollIntoView?.({ block: 'nearest' });
        this.syncPreview();
        this.drawHelp();
        this.drawReset();
        this.syncMore();
        // The pad's strip follows the chosen row and Lua's answer (Reset appears) at once, not on its half-second backstop.
        if (this.isOpen) NuiRouter.hintsChanged();
    }

    rowEl(row, i) {
        const el = document.createElement('div');
        el.className = 'pf-row' + (i === this.sel && this.focus === 'rows' ? ' on' : '') + (row.changed ? ' changed' : '')
            + (row.locked ? ' locked' : '');
        el.dataset.i = i;
        el.dataset.type = row.type;
        // Decided by the server (/whip → Config): greyed, what it is set to still shown, and said so.
        const name = `<div class="pf-name"><span class="pf-label">${escapeHtml(row.label)}</span>`
            + '<span class="pf-dot" aria-label="changed from the server\'s default"></span>'
            + (row.locked ? '<span class="pf-locked">Disabled by server admin</span>' : '') + '</div>';
        let ctl = '';
        if (row.type === 'toggle') {
            ctl = `<button class="pf-switch${row.value ? ' is-on' : ''}" type="button" role="switch" aria-checked="${!!row.value}">`
                + '<span class="pf-knob"></span></button>'
                + `<span class="pf-val">${row.value ? 'On' : 'Off'}</span>`;
        } else if (row.type === 'choice') {
            ctl = '<div class="pf-seg">' + (row.options || []).map((o, k) =>
                `<button class="pf-opt${o.value === row.value ? ' cur' : ''}" type="button" data-o="${k}">${escapeHtml(o.label)}</button>`
            ).join('') + '</div>';
        } else if (row.type === 'slider') {
            const v = this.drag && this.drag.row.key === row.key ? this.drag.value : row.value;
            const frac = (Number(v) - Number(row.min)) / (Number(row.max) - Number(row.min));
            const pct = Math.max(0, Math.min(1, frac)) * 100;
            ctl = '<button class="pf-step" type="button" data-d="-1" aria-label="less">&#8722;</button>'
                + `<div class="pf-track"><div class="pf-fill" style="width:${pct}%"></div><div class="pf-thumb" style="left:${pct}%"></div></div>`
                + '<button class="pf-step" type="button" data-d="1" aria-label="more">+</button>'
                + `<span class="pf-val pf-num">${escapeHtml(valueText(row, v))}</span>`;
        }
        el.innerHTML = name + `<div class="pf-ctl">${ctl}</div>`;
        return el;
    }

    /** What the chosen row does, and the server's default (none for the preview's own rows). */
    drawHelp() {
        const row = this.row();
        this.helpName.textContent = row ? row.label : '';
        this.helpText.textContent = this.note || (row?.help || '');
        this.helpText.classList.toggle('note', !!this.note);
        this.helpDefault.textContent = row && row.locked ? 'Disabled by server admin: set to ' + valueWords(row, row.value) + ' for everyone'
            : row && !row.local && row.default !== null && row.default !== undefined
                ? 'Server default: ' + valueWords(row, row.default) : '';
    }

    /** Reset this page: there only when a row on it differs from the server's default; its question in its place. */
    drawReset() {
        const changed = !!this.group()?.rows?.some((r) => r.changed);
        this.resetBtn.disabled = !changed;
        this.confirmEl.classList.toggle('open', this.focus === 'confirm');
        this.resetBtn.classList.toggle('hidden', this.focus === 'confirm');
        this.confirmBtns.forEach((x, i) => x.classList.toggle('on', i === this.confirmSel));
    }

    /** "More below" while the list goes on past the bottom; its top fades once it is scrolled. */
    syncMore() {
        const s = this.scrollEl;
        this.listWrap.classList.toggle('pf-has-more', s.scrollTop + s.clientHeight < s.scrollHeight - 4);
        this.listWrap.classList.toggle('pf-scrolled', s.scrollTop > 4);
    }

    /** The minimap's preview up while the Minimap tab is, and nowhere else. */
    syncPreview() {
        const want = this.isOpen && this.group()?.id === MINIMAP_GROUP;
        this.wrap.classList.toggle('pf-mm', want);
        if (!want) {
            if (this.preview) { this.preview.destroy(); this.preview = null; }
            this.mmStatus.textContent = '';
            return;
        }
        this.mmSlot.style.aspectRatio = String(minimapAspect());
        if (!this.preview) {
            this.preview = new MinimapPreview(this.previewHost, this.mmStatus);
            this.preview.setMode(this.previewMode);
            this.preview.setSpeed(this.previewSpeed);
        }
        this.placePreview();
    }

    /** The preview laid over its place in the aside, in true px: the aside is zoomed, the preview is not. */
    placePreview() {
        if (!this.preview) return;
        const slot = screenRect(this.mmSlot), frame = this.wrap.getBoundingClientRect();
        if (!(slot.width > 0)) return;
        const s = this.previewHost.style;
        s.left = Math.round(slot.left - frame.left) + 'px';
        s.top = Math.round(slot.top - frame.top) + 'px';
        s.width = Math.round(slot.width) + 'px';
        this.preview.layout();
    }

    dragTo(clientX) {
        const d = this.drag;
        if (!d) return;
        // In screen pixels, as clientX is: the track is in the zoomed list, which FiveM's Chromium 103 can measure
        // unzoomed.
        const box = screenRect(d.track);
        const v = sliderAt(d.row, box.width > 0 ? (clientX - box.left) / box.width : 0);
        if (v === d.value) return;
        d.value = v;
        // What reads it (the minimap's preview) follows the drag.
        if (d.row.local) this.setLocal(d.row.key, v); else setPref(d.row.key, v);
        // Only this row's slider moves while dragging: the list is not rebuilt under the pointer.
        const pct = Math.max(0, Math.min(1, (v - Number(d.row.min)) / (Number(d.row.max) - Number(d.row.min)))) * 100;
        const rowEl = d.track.closest('.pf-row');
        rowEl.querySelector('.pf-fill').style.width = pct + '%';
        rowEl.querySelector('.pf-thumb').style.left = pct + '%';
        rowEl.querySelector('.pf-num').textContent = valueText(d.row, v);
    }

    // ---- doing ----

    async change(row, value) {
        this.note = '';
        if (row.locked) { this.note = 'Disabled by server admin'; this.draw(); return; }
        if (value === row.value) { this.draw(); return; }
        if (row.local) { this.setLocal(row.key, value); this.draw(); return; }
        row.value = value;          // drawn at once; Lua's answer replaces it
        setPref(row.key, value);    // ...and read at once by what reads it (the minimap's preview)
        this.draw();
        // ONLY THE NEWEST ANSWER IS DRAWN: a key held on a slider sends a step before the last one's answer is
        // back, and that older answer would put the number back.
        const seq = ++this.seq;
        const st = await nuiCallback('prefsSet', { key: row.key, value });
        if (seq !== this.seq) return;
        if (st && Array.isArray(st.groups)) this.setState(st);
        else this.draw();
    }

    /** Left / right on the chosen row. */
    step(d) {
        const row = this.row();
        if (!row) return;
        if (row.type === 'toggle') this.change(row, d > 0);
        else if (row.type === 'choice') {
            const opts = row.options || [];
            const i = opts.findIndex((o) => o.value === row.value);
            const next = opts[Math.max(0, Math.min(opts.length - 1, (i < 0 ? 0 : i) + d))];
            if (next) this.change(row, next.value);
        } else if (row.type === 'slider') {
            const step = Number(row.step) || 1;
            const v = Math.max(Number(row.min), Math.min(Number(row.max), Number(row.value) + d * step));
            this.change(row, Math.round(v * 1000) / 1000);
        }
    }

    /** Enter or A on the chosen row: a switch flips, a choice steps on (round to the first). */
    press() {
        const row = this.row();
        if (!row) return;
        if (row.type === 'toggle') this.change(row, !row.value);
        else if (row.type === 'choice') {
            const opts = row.options || [];
            const i = opts.findIndex((o) => o.value === row.value);
            this.change(row, opts[(i + 1) % opts.length].value);
        }
    }

    setTab(i) {
        const n = this.state?.groups?.length || 0;
        if (!n) return;
        this.tab = ((i % n) + n) % n;
        this.sel = 0;
        this.focus = 'rows';
        this.note = '';
        this.scrollEl.scrollTop = 0;
        this.draw();
    }

    move(d) {
        const n = this.rows().length;
        if (!n) return;
        this.sel = (this.sel + d + n) % n;
        this.note = '';
        this.draw();
    }

    askReset() {
        if (!this.group()?.rows?.some((r) => r.changed)) return;
        this.focus = 'confirm';
        this.confirmSel = 1;
        this.draw();
    }

    /** Yes (0): this page's rows back to the server's defaults; Cancel (1). */
    async answerReset(i) {
        this.focus = 'rows';
        if (i === 0) {
            ++this.seq;             // an answer to a change still on its way is older than this
            const st = await nuiCallback('prefsReset', { group: this.group()?.id });
            if (st && Array.isArray(st.groups)) this.setState(st);
            this.note = 'This page is back to the server\'s defaults';
        }
        this.draw();
    }

    // ---- keys and the pad (pause.js hands them over in this mode) ----

    /** A key. Answers false when it was "back" out of the page (pause.js goes to its menu). */
    onKey(e) {
        if (e.type && e.type !== 'keydown') return true;
        const k = e.key.toLowerCase();
        if (k === 'arrowup' || k === 'w') return this.nav('up');
        if (k === 'arrowdown' || k === 's') return this.nav('down');
        if (k === 'arrowleft' || k === 'a') return this.nav('left');
        if (k === 'arrowright' || k === 'd') return this.nav('right');
        if (k === 'enter' || k === ' ') return this.nav('select');
        if (k === 'escape' || k === 'backspace') return this.nav('back');
        if (k === 'q') return this.nav('tabPrev');
        if (k === 'e' || k === 'tab') { e.preventDefault?.(); return this.nav('tabNext'); }
        if (k === 'r') return this.nav('buttonY');
        return true;
    }

    /** A pad (or key) intent. Answers false for "back" out of the page. */
    nav(n) {
        if (this.focus === 'confirm') {
            if (n === 'left' || n === 'right') { this.confirmSel = 1 - this.confirmSel; this.drawReset(); }
            else if (n === 'select') this.answerReset(this.confirmSel);
            else if (n === 'back') { this.focus = 'rows'; this.draw(); }
            return true;
        }
        if (n === 'up') this.move(-1);
        else if (n === 'down') this.move(1);
        else if (n === 'left') this.step(-1);
        else if (n === 'right') this.step(1);
        else if (n === 'select') this.press();
        else if (n === 'tabPrev') this.setTab(this.tab - 1);
        else if (n === 'tabNext') this.setTab(this.tab + 1);
        else if (n === 'buttonY') this.askReset();
        else if (n === 'back') return false;
        return true;
    }

    /** The pad's hint strip (controller.js). */
    hints() {
        if (this.focus === 'confirm') return [['dpad', 'Choose'], ['a', 'Select'], ['b', 'Cancel']];
        const row = this.row();
        const h = [['dpad', 'Choose / change']];
        if (row && row.type !== 'slider') h.push(['a', row.type === 'toggle' ? 'Switch' : 'Next']);
        if ((this.state?.groups?.length || 0) > 1) h.push(['lb', ''], ['rb', 'Tab']);
        if (this.group()?.rows?.some((r) => r.changed)) h.push(['y', 'Reset page']);
        h.push(['b', 'Back']);
        return h;
    }
}
