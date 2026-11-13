// The HUD black skin's minimap frame, baked into one texture per minimap shape (cheaper on client CPU than drawing it).
//
//   node dev/map_tiles/hud_frame.js
//
// Writes whip_core/stream/whipframe_<rounded|square|circle>.ytd, one texture 'frame' each. client/hud_skin.lua draws it
// with ONE DrawSprite a frame, under GTA's HUD; it used to draw the frame from three filled rounded rectangles (a cross
// of two DrawRects and four corner discs each: 18 draws and their checks, every frame), which a profile capture put at
// most of the controls loop's time. The vector way is kept for while /radardebug is open, so tuning stays live.
//
// THE GEOMETRY IS client/hud_skin.lua's, at full safe zone on a 16:9 screen: change `frame`, BANDS or MASK_CORNERS
// there and bake again. The outer box (the map's box grown by all three bands) is the texture; inside it, from the map's
// edge out: a black line, the white, a black edge, and the middle filled black (the map covers it). Corners are the
// mask's, stretched over the box: ellipses. Baked at 1440p, 4 x 4 samples a pixel; packed DXT5 by C:\Tools\whip\ytdpack.
//
// THE RING, too (the black behind the map's see-through-ness, its strength a player's own choice):
//
//   node dev/map_tiles/hud_frame.js ring
//
// writes whip_core/stream/whipring_<shape>.ytd, texture 'ring': the same bands with the middle left clear. hud_skin.lua
// draws the whole frame at the player's strength and the ring over it at full, so only the middle fades. No argument
// bakes both.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const YTDPACK = 'C:/Tools/whip/ytdpack/bin/Release/net10.0-windows/ytdpack.exe';
const OUT = path.resolve(__dirname, '..', '..', 'stream');

// ---- client/hud_skin.lua's numbers ----
const FRAME = { sizeX: 0.1720, sizeY: 0.1655 };                 // the map's box: fractions of a 16:9 screen
const BANDS = { inner: 0.0012, white: 0.0034, outer: 0.0018 };  // screen heights, from the map's edge out
const MASK_CORNERS = { rounded: [46 / 512, 46 / 396], square: [0, 0], circle: [0.5, 0.5] };

const H = 1440, W = H * 16 / 9;                                 // bake resolution
const SS = 4;                                                   // samples a side, per pixel

/** Is (x, y) inside a box of half sizes (hx, hy) round the origin with elliptical corners (rx, ry)? */
function inside(x, y, hx, hy, rx, ry) {
    const ax = Math.abs(x), ay = Math.abs(y);
    if (ax > hx || ay > hy) return false;
    const cx = hx - rx, cy = hy - ry;                           // the corner ellipse's centre
    if (ax <= cx || ay <= cy || rx <= 0 || ry <= 0) return true;
    const dx = (ax - cx) / rx, dy = (ay - cy) / ry;
    return dx * dx + dy * dy <= 1;
}

/** `kind`: 'frame' (the middle filled black) or 'ring' (the middle left clear). */
function bake(shape, kind) {
    const fw = FRAME.sizeX * W, fh = FRAME.sizeY * H;           // the map's box, px
    const [kx, ky] = MASK_CORNERS[shape];
    const cx = Math.min(fw / 2, kx * fw), cy = Math.min(fh / 2, ky * fh);
    const e1 = BANDS.inner * H, e2 = e1 + BANDS.white * H, e3 = e2 + BANDS.outer * H;
    const boxW = fw + 2 * e3, boxH = fh + 2 * e3;
    // DXT wants multiples of 4; the sprite is drawn at the box's own size, so the rounding is a 0.5% stretch at most.
    const TW = Math.ceil(boxW / 4) * 4, TH = Math.ceil(boxH / 4) * 4;
    const px = Buffer.alloc(TW * TH * 4);
    const layer = (x, y, e) => inside(x, y, fw / 2 + e, fh / 2 + e, cx + e, cy + e);
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
        let white = 0, cover = 0;
        for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
            // the sample, in box px from its centre
            const x = ((tx + (sx + 0.5) / SS) / TW - 0.5) * boxW, y = ((ty + (sy + 0.5) / SS) / TH - 0.5) * boxH;
            if (!layer(x, y, e3)) continue;
            if (kind === 'ring' && layer(x, y, 0)) continue;        // the ring: the map's own box stays clear
            cover++;
            if (!layer(x, y, e1) && layer(x, y, e2)) white++;    // the white band; the rest inside is black
        }
        const i = (ty * TW + tx) * 4, n = SS * SS;
        // straight alpha: the colour of what is covered (white over black, mixed), coverage as alpha
        const v = cover ? Math.round(255 * white / cover) : 0;
        px[i] = px[i + 1] = px[i + 2] = v;
        px[i + 3] = Math.round(255 * cover / n);
    }
    const prefix = kind === 'ring' ? 'whipring_' : 'whipframe_';
    const tmp = path.join(os.tmpdir(), prefix + shape + '_' + process.pid + '.rgba');
    fs.writeFileSync(tmp, px);
    const out = execFileSync(YTDPACK, ['pack', tmp, String(TW), String(TH), kind,
        path.join(OUT, prefix + shape + '.ytd'), 'bc3'], { encoding: 'utf8' });
    fs.unlinkSync(tmp);
    process.stdout.write(kind + ' ' + shape + ': ' + out);
    return { TW, TH, boxW, boxH };
}

if (!fs.existsSync(YTDPACK)) { console.error('no ' + YTDPACK + ' (dotnet build -c Release in C:\\Tools\\whip\\ytdpack)'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const kinds = process.argv[2] === 'ring' ? ['ring'] : process.argv[2] === 'frame' ? ['frame'] : ['frame', 'ring'];
for (const kind of kinds) for (const shape of Object.keys(MASK_CORNERS)) bake(shape, kind);
