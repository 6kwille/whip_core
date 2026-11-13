// The atlas map → whip's dark map, one pixel at a time. Shared by the preview page and the baker.
// Atlas colours (measured): green land 192,216,128 / 160,176,104; sea 136,192,216 family; roads
// 248 white; buildings 192 grey; urban ground 208-216 grey; motorways 248,248,216 cream; labels
// dark grey. The look: near-black ground, lighter blocks, light grey roads.
(function (root) {
    const C = {
        land:  [17, 20, 25],
        hill:  [23, 27, 33],
        sea:   [10, 18, 29],
        sea2:  [14, 25, 39],
        ground:[25, 29, 36],
        sand:  [37, 36, 34],
        build: [43, 48, 58],
        road:  [126, 134, 147],
        hwy:   [164, 172, 186],
        text:  [176, 184, 197],
    };
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

    // Greys by lightness: dark labels → light text; buildings; urban ground; roads.
    const GREY = [
        [0.00, C.text], [0.40, C.text], [0.58, C.build], [0.77, C.build],
        [0.81, C.ground], [0.87, C.ground], [0.96, C.road], [1.00, C.road],
    ];
    function grey(L) {
        for (let i = 1; i < GREY.length; i++) {
            if (L <= GREY[i][0]) {
                const [l0, c0] = GREY[i - 1], [l1, c1] = GREY[i];
                return mix(c0, c1, (L - l0) / (l1 - l0 || 1));
            }
        }
        return C.road;
    }

    function pixel(r, g, b) {
        const L = (r + g + b) / 765;
        if (b > r + 25 && b >= g - 6) return mix(C.sea, C.sea2, clamp((L - 0.55) / 0.3));          // sea 136,192,216
        if (g > b + 40 && g > r + 8) return mix(C.land, C.hill, clamp((0.78 - L) / 0.2));          // land 192,216,128
        if (r > 238 && g > 234 && b > 190 && r - b > 10)                                           // motorway 252,248,216
            return mix(C.road, C.hwy, clamp((r - b - 10) / 24));
        if (r > 190 && g > 175 && r - b > 50) return mix(C.sand, C.ground, clamp((r - 236) / 16)); // sand 236,224,144
        if (r > g + 10 && r - b > 25 && L < 0.75) return C.build;                                    // piers 156,132,120
        return grey(L);
    }

    function whipify(data) {
        for (let k = 0; k < data.length; k += 4) {
            const [r, g, b] = pixel(data[k], data[k + 1], data[k + 2]);
            data[k] = r; data[k + 1] = g; data[k + 2] = b;
        }
        return data;
    }

    root.whipify = whipify;
})(typeof window !== 'undefined' ? window : globalThis);
