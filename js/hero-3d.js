// Ale Floors — home hero: a walk along a curved path through three showroom rooms,
// each one a real use of a floor: living room (metallic epoxy), garage (epoxy flake,
// the color can be changed live), pool area (polished concrete deck around a pool).
//
// Scrolling through the tall hero moves the camera along the curve (js/home.js uses
// the same progress for captions). Hotspots are pinned to each floor.
// Three.js 0.170.0 is served from js/vendor/ and only loaded on capable devices;
// otherwise still renders of the rooms are shown (see index.html).
// URL options: ?no3d shows the stills; ?shot=0|1|2 freezes a room (used to make the stills);
// ?old builds the rooms from boxes like before (to compare); ?tier=low|mid|high forces a quality level.
//
// v2: each room's walls, ceiling and furniture come from Blender (assets/3d/room-{a,b,c}.glb) with
// light and shadows baked into one texture per room (already tone mapped, so it skips three's tone
// mapping). The floors keep their live materials (metallic, flake with live color, polished deck)
// and get a baked light map. Live on top: reflections, the turning floor sample with a real shadow,
// the water with ripples and caustics, dust, beams, photos and the logo.
// The Blender scripts live in the ALEFLOORS-blender work folder (see docs/redesign/2026-11-09-home-3d-v2.md).

const canvas = document.getElementById('heroCanvas');
const hero = document.getElementById('showroom');
const params = new URLSearchParams(window.location.search);
const SHOT = params.has('shot') ? Math.min(2, Math.max(0, parseInt(params.get('shot'), 10) || 0)) : null;
const OLD = params.has('old') || params.has('oldA');
const FORCED_TIER = ['low', 'mid', 'high'].includes(params.get('tier')) ? params.get('tier') : null;
const MODELS = 'assets/3d/';
const FLOOR_LIGHT_GAIN = 4;      // floor light maps are stored at 1/4 so bright spots don't clip

// real colors of six flake blends (from the catalog swatches): [color, share]
const FLAKES = {
    Outback: [['#b79771', 0.31], ['#f0e3cc', 0.25], ['#352a22', 0.21], ['#e0ccb1', 0.14], ['#f6f0e4', 0.09]],
    Wombat: [['#6b6d6d', 0.4], ['#7f8181', 0.17], ['#b7b8b8', 0.16], ['#313233', 0.15], ['#d3d4d4', 0.12]],
    Domino: [['#c8c8c2', 0.31], ['#060706', 0.29], ['#e3e3e0', 0.17], ['#ebebe8', 0.14], ['#8d8c87', 0.09]],
    Marlin: [['#c6cbc6', 0.32], ['#324c64', 0.29], ['#d6d7d4', 0.16], ['#e5e8e5', 0.13], ['#9ba4a3', 0.09]],
    'Slate Stone': [['#c3c2b9', 0.25], ['#adaca1', 0.24], ['#4f524f', 0.22], ['#d1d0ca', 0.14], ['#dfdfd9', 0.14]],
    Cherokee: [['#4c1c09', 0.41], ['#1e0b05', 0.18], ['#cfac88', 0.16], ['#f1dec2', 0.15], ['#7b533c', 0.09]],
};

function canUse3D() {
    if (!canvas || !hero) return false;
    if (params.has('no3d')) return false;
    if (SHOT !== null) return true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const connection = navigator.connection;
    if (connection && connection.saveData) return false;
    const cores = navigator.hardwareConcurrency || 8;
    const memory = navigator.deviceMemory || 8;   // Chromium only
    if (cores <= 4 && memory <= 4) return false;
    try {
        return !!document.createElement('canvas').getContext('webgl2');
    } catch (error) {
        return false;
    }
}

function whenIdle(callback) {
    const run = () => ('requestIdleCallback' in window ? window.requestIdleCallback(callback, { timeout: 1500 }) : window.setTimeout(callback, 200));
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run, { once: true });
}

if (canUse3D()) {
    whenIdle(() => {
        performance.mark('hero3d:idle');
        Promise.all([import('./vendor/three.module.min.js'), import('./vendor/RoomEnvironment.js'), import('./vendor/Reflector.js'), import('./vendor/GLTFLoader.js'), import('./hero/index.js')])
            .then(([THREE, env, refl, gltf, hero3d]) => start(THREE, env.RoomEnvironment, refl.Reflector, gltf.GLTFLoader, hero3d.default))
            .catch((error) => console.warn('3D hero disabled:', error));
    });
}

function start(THREE, RoomEnvironment, Reflector, GLTFLoader, modules) {
    const ctx = { THREE, RoomEnvironment, Reflector, GLTFLoader, canvas, hero, params, SHOT, OLD, FORCED_TIER, MODELS, FLOOR_LIGHT_GAIN, FLAKES };
    modules.forEach((build) => build(ctx));
    const { mobile, renderer, scene, camera, pmrem, roomEnv, envMap, geometries, materials, textures, load, photos, metallicMat, flakeMat, reflectorSize, mirror, onFlake, dust, sample, spot, sampleLayers, layerLabels, layerPoint, flame, bakedMats, loadRooms, hideLoader, causticLayers, rippleNormal, pathPos, pathLook, smooth, curveAt, roomAt, spotEls, anchors, projected, measureCopy, overCopy } = ctx;
    let { pixelRatio, explode, sampleSpin, idle } = ctx;      // changed by the loop below (pixelRatio is mirrored back to ctx)
    // ---------- state + loop ----------
    const pointer = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };
    let progress = SHOT !== null ? [0, 0.5, 1][SHOT] : 0;
    let smoothProgress = progress;
    let running = false;
    let frame = 0;
    let lastTime = performance.now();
    let startTime = performance.now();
    let firstFrame = true;
    let slowFrames = 0;
    let frameCount = 0;
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
    const clamp01 = (v) => Math.min(1, Math.max(0, v));

    function readProgress() {
        if (SHOT !== null) return;
        const range = hero.offsetHeight - window.innerHeight;
        progress = range > 0 ? clamp01(-hero.getBoundingClientRect().top / range) : 0;
    }

    function resize() {
        const width = hero.clientWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = camera.aspect < 0.8 ? 64 : camera.aspect < 1.2 ? 56 : 50;
        camera.updateProjectionMatrix();
        const [w, h] = reflectorSize();
        mirror.getRenderTarget().setSize(w, h);
        measureCopy();
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureCopy);

    // ---------- quality levels: high = everything; mid = lower resolution; low = also no mirror,
    // dust or live shadow (floors become opaque). Starts at mid on phones; drops on its own when slow.
    const TIERS = ['low', 'mid', 'high'];
    const floorOpacity = new Map([[metallicMat, metallicMat.opacity], [flakeMat, flakeMat.opacity]]);
    let tier = 'high';
    function applyTier(next) {
        tier = next;
        const low = tier === 'low';
        mirror.visible = !low;
        floorOpacity.forEach((opacity, m) => { m.opacity = low ? 1 : opacity; });
        dust.visible = !low;
        if (spot.castShadow === low) {           // recompiles the few materials that receive it, once
            spot.castShadow = !low;
            renderer.shadowMap.needsUpdate = true;
        }
        const cap = tier === 'high' ? (mobile ? 1.5 : 2) : tier === 'mid' ? 1.25 : 1;
        if (pixelRatio > cap) {
            pixelRatio = cap;
            ctx.pixelRatio = pixelRatio;
            renderer.setPixelRatio(pixelRatio);
            resize();
        }
    }
    applyTier(FORCED_TIER || (mobile ? 'mid' : 'high'));
    function render(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        // keep it fluid: if frames stay slow (~under 40 fps for a second and a half), step down:
        // first the resolution, then the quality level
        if (SHOT === null && !FORCED_TIER && (pixelRatio > 1 || tier !== 'low')) {
            frameCount++;
            if (dt > 0.026) slowFrames++;
            if (frameCount >= 90) {
                if (slowFrames > 45) {
                    if (pixelRatio > 1) {
                        pixelRatio = Math.max(1, pixelRatio - 0.25);
                        ctx.pixelRatio = pixelRatio;
                        renderer.setPixelRatio(pixelRatio);
                        resize();
                    } else {
                        applyTier(TIERS[TIERS.indexOf(tier) - 1]);
                    }
                }
                frameCount = 0;
                slowFrames = 0;
            }
        }
        lastTime = now;
        const t = (now - startTime) / 1000;

        tilt.x = damp(tilt.x, pointer.x, 4, dt);
        tilt.y = damp(tilt.y, pointer.y, 4, dt);
        smoothProgress = SHOT !== null ? progress : damp(smoothProgress, progress, 8, dt);

        const u = curveAt(smoothProgress);
        pathPos.getPoint(u, camPos);
        pathLook.getPoint(u, camLook);
        // opening: the camera glides in from further back and a little higher while the light comes up
        // (2.4 s, strong ease-out: fast at first, settling gently)
        const intro = SHOT !== null ? 1 : 1 - Math.pow(1 - clamp01(t / 2.4), 4);
        renderer.toneMappingExposure = 0.3 + 0.7 * (SHOT !== null ? 1 : 1 - Math.pow(1 - clamp01(t / 1.6), 3));
        bakedMats.forEach((m) => m.color.setScalar(renderer.toneMappingExposure));
        // idle: when the visitor stops scrolling, the camera breathes a little more (decorative, very small)
        idle = damp(idle, Math.abs(progress - smoothProgress) < 0.002 ? 1 : 0, 1.5, dt);
        const still = SHOT !== null ? 0 : 1;
        const swayX = still * (0.035 + 0.035 * idle) * Math.sin(t * 0.27);
        const swayY = still * idle * 0.02 * Math.sin(t * 0.41);
        camera.position.set(
            camPos.x + tilt.x * 0.22 + swayX,
            camPos.y - tilt.y * 0.1 + swayY + (1 - intro) * 0.35,
            camPos.z + (1 - intro) * 2.2,
        );
        // portrait screens: in the living room, look further right so the sample and the glass wall are
        // in frame (on landscape they already are); fades out as the camera heads to the garage
        const portrait = clamp01((0.9 - camera.aspect) / 0.4);
        camLook.x += portrait * 3.2 * (1 - smooth(clamp01(u / 0.35)));
        camLook.x += tilt.x * 0.5 + still * idle * 0.06 * Math.sin(t * 0.19);
        camLook.y -= tilt.y * 0.25;
        camera.lookAt(camLook);

        // exploded view of the sample: opens a little after the opening, fully as you scroll the
        // first room, closes again as the camera leaves it
        const opened = SHOT !== null ? 0.8 : Math.max(
            0.3 * smooth(clamp01((t - 1.8) / 1.2)),
            smooth(clamp01(smoothProgress / 0.13)),
        ) * (1 - smooth(clamp01((smoothProgress - 0.18) / 0.08)));
        explode = damp(explode, opened, 6, dt);
        sampleSpin += dt * 0.25 * (1 - 0.75 * explode);       // turns slower while open, to read the layers
        sample.rotation.y = -0.5 + sampleSpin;
        sampleLayers.forEach((m) => {
            const { restY, i } = m.userData;
            m.position.y = restY + i * (0.006 + 0.2 * explode) + (i ? 0.003 * Math.sin(t * 0.9 + i) : 0);
        });
        rippleNormal.offset.set(t * 0.02, t * 0.013);
        causticLayers[0].offset.set(t * 0.03, t * 0.017);
        causticLayers[1].offset.set(-t * 0.022, t * 0.028);
        if (flame) {                     // flicker: two slow sines and a faster one, never fully off
            flame.opacity = 0.55 + 0.18 * Math.sin(t * 3.1) * Math.sin(t * 1.7) + 0.08 * Math.sin(t * 11.3);
            flame.map.offset.x = t * 0.04;
        }
        dust.rotation.y = Math.sin(t * 0.05) * 0.02;
        dust.position.y = Math.sin(t * 0.2) * 0.05;

        // the sample's shadow only needs redrawing while the living room is on screen
        const room = roomAt(smoothProgress);
        if (spot.castShadow && room === 0) renderer.shadowMap.needsUpdate = true;

        if (firstFrame) performance.mark('hero3d:render');
        renderer.render(scene, camera);

        // pin the active room's hotspot; hide it when behind the camera or off screen
        const width = hero.clientWidth;
        const height = window.innerHeight;
        spotEls.forEach((el, i) => {
            projected.copy(anchors[i]).project(camera);
            const x = (projected.x * 0.5 + 0.5) * width;
            const y = (-projected.y * 0.5 + 0.5) * height;
            const on = SHOT === null && i === room && projected.z < 1 && Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.9 && !overCopy(i, x, y, el.classList.contains('is-on'));
            el.classList.toggle('is-on', on);
            if (!on) return;
            el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            const card = document.getElementById(el.getAttribute('aria-controls'));
            if (card && !card.hidden) {
                const cx = Math.min(Math.max(16, x + 26), width - card.offsetWidth - 16);
                const cy = Math.min(Math.max(80, y - card.offsetHeight / 2), height - card.offsetHeight - 16);
                const pos = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
                card.style.transform = pos;
                card.style.setProperty('--spot-pos', pos);
            }
        });

        // layer labels: each one sits to the right of its layer and appears in turn as the sample opens
        layerLabels.forEach((el, k) => {
            const layer = sampleLayers[k + 1];
            layerPoint.set(0.5, layer.position.y, 0.33);
            sample.localToWorld(layerPoint).project(camera);
            const x = (layerPoint.x * 0.5 + 0.5) * width;
            const y = (-layerPoint.y * 0.5 + 0.5) * height;
            const on = SHOT === null && room === 0 && explode > 0.45 + k * 0.1 && layerPoint.z < 1
                && x > 0 && x < width - 120 && y > 60 && y < height - 60 && !overCopy(0, x, y, el.classList.contains('is-on'));
            el.classList.toggle('is-on', on);
            if (on) el.style.transform = `translate(${(x + 18).toFixed(1)}px, ${(y - 9).toFixed(1)}px)`;
        });

        if (firstFrame) {
            firstFrame = false;
            performance.mark('hero3d:first-frame');
            document.documentElement.classList.add('has-3d');
            loadPhotos();
        }
    }

    let photosLoaded = false;
    function loadPhotos() {
        if (photosLoaded) return;
        photosLoaded = true;
        photos.forEach(({ url, mat }) => load(url, [1, 1], (t) => {
            t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
            mat.map = t;
            mat.color.set(0xffffff);
            mat.needsUpdate = true;
            // upload now, while the visitor is still reading the hero: otherwise it happens the
            // first time the photo comes into view, mid-scroll, as a dropped frame
            renderer.initTexture(t);
        }));
    }

    // one animation loop for the page: GSAP's ticker (it also drives Lenis, see js/home.js);
    // plain requestAnimationFrame when GSAP isn't there
    const ticker = window.gsap && window.gsap.ticker;
    const tick = () => render(performance.now());
    function loop(now) {
        if (!running) return;
        render(now);
        frame = window.requestAnimationFrame(loop);
    }
    let ready = false;   // set once the floor texture and the rooms are loaded (see the end of start)
    function play() {
        if (running || document.hidden || !ready) return;
        running = true;
        lastTime = performance.now();
        if (firstFrame) performance.mark('hero3d:play');
        if (ticker) ticker.add(tick);
        else frame = window.requestAnimationFrame(loop);
    }
    function pause() {
        running = false;
        if (ticker) ticker.remove(tick);
        else window.cancelAnimationFrame(frame);
    }

    let heroVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        if (heroVisible) play();
        else pause();
    });
    observer.observe(hero);
    const onVisibility = () => (document.hidden ? pause() : heroVisible && play());
    document.addEventListener('visibilitychange', onVisibility);
    const onPointerMove = (e) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', readProgress, { passive: true });

    function dispose() {
        pause();
        observer.disconnect();
        resizeObserver.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('scroll', readProgress);
        window.removeEventListener('ale:flake', onFlake);
        document.removeEventListener('visibilitychange', onVisibility);
        new Set(geometries).forEach((g) => g.dispose());
        new Set(materials).forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
        mirror.dispose();
        envMap.dispose();
        pmrem.dispose();
        renderer.dispose();
    }
    window.addEventListener('pagehide', (e) => { if (!e.persisted) dispose(); });
    roomEnv.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });

    resize();
    readProgress();
    smoothProgress = progress;
    if (SHOT !== null) loadPhotos();
    // start once the floors and the Blender rooms are in, and every shader is compiled. Compiling
    // up front and in parallel (compileAsync) matters: done by the first render it froze the page
    // for ~4.5 s on an Intel UHD 630. If anything fails, the still images stay.
    Promise.all([
        // metallic floor: pearl and charcoal veins, with a normal and a roughness map for the clearcoat
        load(MODELS + (mobile ? 'floor-metallic-m.webp' : 'floor-metallic.webp'), [1, 1], (t) => { metallicMat.map = t; metallicMat.needsUpdate = true; }),
        load(MODELS + 'floor-metallic-normal.webp', [1, 1], (t) => {
            t.colorSpace = THREE.NoColorSpace;
            metallicMat.normalMap = t;
            metallicMat.normalScale.set(0.35, 0.35);
            metallicMat.clearcoatNormalMap = t;
            metallicMat.clearcoatNormalScale.set(0.08, 0.08);
            metallicMat.needsUpdate = true;
        }),
        load(MODELS + 'floor-metallic-rough.webp', [1, 1], (t) => {
            t.colorSpace = THREE.NoColorSpace;
            metallicMat.roughnessMap = t;
            metallicMat.needsUpdate = true;
        }),
        loadRooms(),
    ]).then(() => {
        performance.mark('hero3d:loaded');
        // the floor mirror draws the scene into a render target, where three uses other shader
        // variants (no tone mapping, linear output): compile those too, or the first frame
        // compiles them and freezes the page (~1.7 s measured)
        const screen = renderer.compileAsync(scene, camera);
        renderer.setRenderTarget(mirror.getRenderTarget());
        const reflected = renderer.compileAsync(scene, camera);
        renderer.setRenderTarget(null);
        return Promise.all([screen, reflected]);
    }).then(() => {
        performance.mark('hero3d:compiled');
        textures.forEach((t) => renderer.initTexture(t));
        hideLoader();
        ready = true;
        startTime = performance.now();
        if (heroVisible) play();
    }).catch((error) => {
        console.warn('3D hero disabled:', error);
        hideLoader();
        dispose();
    });
}
