// grava scrollY por quadro durante 2.5 s; window.__rec = resumo
(() => {
    const ys = [];
    const t0 = performance.now();
    window.__rec = null;
    const f = () => {
        ys.push([performance.now() - t0, window.scrollY]);
        if (performance.now() - t0 < 2500) requestAnimationFrame(f);
        else {
            const y0 = ys[0][1];
            const v = [];
            for (let i = 1; i < ys.length; i++) v.push(ys[i][1] - ys[i - 1][1]);
            const moving = v.map((d, i) => [i, d]).filter(([, d]) => Math.abs(d) > 0.01);
            const first = moving.length ? moving[0][0] : -1;
            const peak = v.reduce((m, d, i) => (Math.abs(d) > Math.abs(v[m]) ? i : m), 0);
            const back = v.some((d) => d < -0.01) && v.some((d) => d > 0.01);
            // after the peak, speed should only go down (allow tiny float noise)
            // speed in px/ms (frame times vary): after the peak it should only decrease (>8% rise = bump)
            const sp = v.map((d, i) => Math.abs(d) / Math.max(1, ys[i + 1][0] - ys[i][0]));
            let bumps = 0;
            for (let i = peak + 1; i < sp.length; i++) if (sp[i] > 0.02 && sp[i] > sp[i - 1] * 1.08) bumps++;
            const lastMove = moving.length ? ys[moving[moving.length - 1][0] + 1][0] : 0;
            const endY = ys[ys.length - 1][1];
            const yAt = (ms) => (ys.find(([t]) => t >= ms) || ys[ys.length - 1])[1];
            window.__rec = JSON.stringify({
                start: Math.round(y0), end: Math.round(endY), moved: Math.round(endY - y0),
                firstStepPx: first >= 0 ? +v[first].toFixed(1) : 0, peakStepPx: +v[peak].toFixed(1), peakFrame: peak - Math.max(first, 0),
                reversed: back, speedBumpsAfterPeak: bumps,
                settledMs: Math.round(lastMove), driftAfter2s: +(endY - yAt(2000)).toFixed(2),
            });
        }
    };
    requestAnimationFrame(f);
    return 'rec';
})()
