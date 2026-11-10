(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // espera a cena 3D (classe has-3d) por até 15 s
    let has3d = false;
    for (let i = 0; i < 60; i++) {
        if (document.documentElement.classList.contains('has-3d')) { has3d = true; break; }
        await sleep(250);
    }
    const t3d = has3d ? Math.round(performance.now()) : null;
    await sleep(500);
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    const size = (r) => r.transferSize || r.encodedBodySize || 0;
    const bytes = res.reduce((a, r) => a + size(r), 0) + size(nav);
    const byType = {};
    res.forEach((r) => {
        const ext = (r.name.split('?')[0].match(/\.(\w+)$/) || [, r.initiatorType])[1];
        byType[ext] = (byType[ext] || 0) + size(r);
    });
    Object.keys(byType).forEach((k) => { byType[k] = Math.round(byType[k] / 1024); });
    const fps = async (ms, during) => {
        let n = 0, run = true, worst = 0, last = performance.now();
        const f = (t) => { n++; worst = Math.max(worst, t - last); last = t; if (run) requestAnimationFrame(f); };
        requestAnimationFrame(f);
        const st = performance.now();
        if (during) during();
        await sleep(ms);
        run = false;
        return { fps: Math.round(n * 1000 / (performance.now() - st)), worstFrameMs: Math.round(worst) };
    };
    const idle = await fps(3000);
    const hero = document.getElementById('showroom');
    const end = hero ? hero.offsetHeight - innerHeight : 1500;
    const scroll = await fps(4000, () => {
        const st = performance.now();
        const step = () => {
            const p = Math.min(1, (performance.now() - st) / 3800);
            scrollTo(0, end * p);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
    const gl = document.createElement('canvas').getContext('webgl2');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return JSON.stringify({
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        scene3dReadyMs: t3d, has3d,
        initialKB: Math.round(bytes / 1024), requests: res.length + 1, kbByType: byType,
        idle, scroll,
        viewport: innerWidth + 'x' + innerHeight + '@' + devicePixelRatio,
        gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
    });
})()
