// Ale Floors — home hero, video version: a photoreal walk living room -> kitchen -> pool deck
// (AI video made in Higgsfield, assets/video/). Scrolling through the tall hero scrubs the video;
// js/home.js keeps doing the rest with the same progress (captions, room bar, arrow, skip).
//
// It holds on each room (where the floor card shows) and moves between them:
//   p 0.00-0.10 living room | 0.10-0.42 walk to the kitchen | 0.42-0.58 kitchen
//   p 0.58-0.90 out to the pool | 0.90-1.00 pool deck
// The video is encoded with a keyframe every few frames so seeking is instant (see tools/make-hero-video.sh).
// Without it (reduced motion, data saver, error) the still images stay, as before.
// URL options: ?3d brings back the old Three.js tour (js/hero-3d.js); ?novideo shows the stills.
(() => {
    'use strict';

    const hero = document.getElementById('showroom');
    const video = hero && hero.querySelector('.hero-video');
    if (!video) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('3d') || params.has('novideo')) { video.remove(); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { video.remove(); return; }
    if (navigator.connection && navigator.connection.saveData) { video.remove(); return; }

    const V = '?v=20261118';
    const small = window.matchMedia('(max-width: 1023px)').matches;
    const url = (small ? video.dataset.srcMobile : video.dataset.src) + V;
    video.muted = true;
    // Load the whole file and play it from memory: scrubbing needs a seekable video, and a video
    // streamed from a server without Range support (python -m http.server, some CDNs) can't seek.
    // The file is small (2-7 MB) and the hero needs all of it anyway. If fetch fails, stream it.
    fetch(url)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then((blob) => URL.createObjectURL(blob))
        .catch(() => url)
        .then((src) => { video.src = src; video.load(); });

    // scroll progress -> video time (in parts of the video: 0 = start, 1 = end)
    const KEYS = [[0, 0], [0.10, 0], [0.42, 2 / 3], [0.58, 2 / 3], [0.90, 1], [1, 1]];
    const ease = (t) => t * t * (3 - 2 * t);
    const partAt = (p) => {
        for (let i = 1; i < KEYS.length; i++) {
            const [p1, v1] = KEYS[i];
            const [p0, v0] = KEYS[i - 1];
            if (p <= p1) return v0 + (v1 - v0) * ease((p - p0) / (p1 - p0 || 1));
        }
        return 1;
    };
    // the floor card shows while the camera holds on a room (not at the very top: the title is there)
    const HOLDS = [[0.02, 0.09], [0.44, 0.56], [0.91, 1]];
    const floorCards = Array.from(hero.querySelectorAll('.floor-card'));

    const progress = () => {
        const range = hero.offsetHeight - window.innerHeight;
        if (range <= 0) return 0;
        return Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / range));
    };

    let ready = false;
    let shown = 0;          // smoothed time, seconds
    let running = false;
    let raf = 0;

    const frame = () => {
        raf = 0;
        if (!running) return;
        const p = progress();
        const target = partAt(p) * Math.max(0, video.duration - 0.05);
        shown += (target - shown) * 0.18;
        if (Math.abs(target - shown) < 0.004) shown = target;
        if (!video.seeking && Math.abs(video.currentTime - shown) > 0.02) video.currentTime = shown;

        let card = -1;
        HOLDS.forEach(([a, b], i) => { if (p >= a && p <= b) card = i; });
        floorCards.forEach((el) => el.classList.toggle('is-on', Number(el.dataset.room) === card));
        hero.classList.toggle('is-floor-moment', card >= 0);

        raf = window.requestAnimationFrame(frame);
    };
    const play = () => { if (ready && !running) { running = true; raf = window.requestAnimationFrame(frame); } };
    const stop = () => { running = false; if (raf) window.cancelAnimationFrame(raf); raf = 0; };

    video.addEventListener('loadeddata', () => {
        if (ready) return;
        ready = true;
        video.pause();
        shown = partAt(progress()) * Math.max(0, video.duration - 0.05);
        video.currentTime = shown;
        document.documentElement.classList.add('has-video');
        play();
    }, { once: true });
    video.addEventListener('error', () => { stop(); video.remove(); });

    // only work while the hero is on screen
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : stop())).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));
})();
