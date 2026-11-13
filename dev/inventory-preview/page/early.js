// whip inventory preview (dev/inventory-preview/preview.js): put first in the page's <head>.
//
// In the game, the page's callbacks (fetch to https://whip_core/<name>) go to whip_core's client Lua. Here
// fixture.js answers them, as the game and the server would. It loads after whip's own modules, so a call
// made before then is kept and answered {}.
(function () {
    var real = window.fetch.bind(window);
    var CB = 'https://whip_core/';
    window.__whipPreview = { early: [], onCall: null };
    window.fetch = function (url, opts) {
        var u = String((url && url.url) || url);
        if (u.indexOf(CB) === 0) {
            var name = u.slice(CB.length);
            var body = null;
            try { body = JSON.parse((opts && opts.body) || 'null'); } catch (_) { body = null; }
            var on = window.__whipPreview.onCall;
            if (on) {
                return Promise.resolve(on(name, body)).then(function (answer) {
                    return new Response(JSON.stringify(answer === undefined ? {} : answer));
                });
            }
            window.__whipPreview.early.push({ name: name, body: body });
            return Promise.resolve(new Response('{}'));
        }
        return real(url, opts);
    };
    if (typeof window.GetParentResourceName !== 'function') {
        window.GetParentResourceName = function () { return 'whip_core'; };
    }
})();
