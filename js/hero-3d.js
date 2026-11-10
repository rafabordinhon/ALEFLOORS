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
        Promise.all([import('./vendor/three.module.min.js'), import('./vendor/RoomEnvironment.js'), import('./vendor/Reflector.js'), import('./vendor/GLTFLoader.js')])
            .then(([THREE, env, refl, gltf]) => start(THREE, env.RoomEnvironment, refl.Reflector, gltf.GLTFLoader))
            .catch((error) => console.warn('3D hero disabled:', error));
    });
}

function start(THREE, RoomEnvironment, Reflector, GLTFLoader) {
    performance.mark('hero3d:start');   // marks: idle -> start -> loaded -> first-frame (see DevTools > Performance)
    const mobile = window.innerWidth < 768;
    const IMG = 'assets/images/';
    const H = 3.6;            // ceiling height
    const DOOR_W = 3.4;
    const DOOR_H = 3;

    // ---------- renderer, scene, camera ----------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // one real-time shadow: the turning floor sample under its spot (the rooms' shadows are baked).
    // The shadow map is only redrawn while the living room is on screen.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x17130f);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envMap = pmrem.fromScene(roomEnv, 0.04).texture;
    scene.environment = envMap;

    // ---------- bookkeeping for dispose() ----------
    const geometries = [];
    const materials = [];
    const textures = [];
    const keep = (geometry, material) => {
        if (geometry) geometries.push(geometry);
        (Array.isArray(material) ? material : [material]).forEach((m) => m && materials.push(m));
    };
    const mesh = (geometry, material, x, y, z, parent = scene) => {
        const m = new THREE.Mesh(geometry, material);
        m.position.set(x, y, z);
        parent.add(m);
        keep(geometry, material);
        return m;
    };
    const box = (w, h, d, material, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
    const loader = new THREE.TextureLoader();
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const load = (url, repeat, onReady) => new Promise((resolve) => {
        const t = loader.load(url, () => { if (onReady) onReady(t); resolve(t); }, undefined, () => resolve(t));
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
        t.anisotropy = anisotropy;
        textures.push(t);
    });
    const canvasTexture = (w, h, draw) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        draw(c.getContext('2d'), c);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        textures.push(t);
        return t;
    };

    // ---------- materials ----------
    const M = {
        plaster: new THREE.MeshStandardMaterial({ color: 0xb0a592, roughness: 0.92 }),
        ceiling: new THREE.MeshStandardMaterial({ color: 0x241e19, roughness: 0.95 }),
        charcoal: new THREE.MeshStandardMaterial({ color: 0x2b241e, roughness: 0.6 }),
        walnut: new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.55 }),
        fabric: new THREE.MeshStandardMaterial({ color: 0x8b8279, roughness: 0.95 }),
        fabricLight: new THREE.MeshStandardMaterial({ color: 0xa39a8f, roughness: 0.95 }),
        stone: new THREE.MeshStandardMaterial({ color: 0xe2dcd2, roughness: 0.35 }),
        metal: new THREE.MeshStandardMaterial({ color: 0xc9c6c0, roughness: 0.45, metalness: 0.4 }),
        graphite: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.2 }),
        gap: new THREE.MeshBasicMaterial({ color: 0x0f0c09 }),
        led: new THREE.MeshBasicMaterial({ color: 0xffd9a3 }),
        stripe: new THREE.MeshStandardMaterial({ color: 0xe2b33b, roughness: 0.4 }),
    };
    Object.values(M).forEach((m) => materials.push(m));
    load(IMG + 'hero/plaster.webp', [4, 1.5], (t) => { M.plaster.map = t; M.plaster.needsUpdate = true; });

    // ---------- walls with optional doorways ----------
    // axis 'x': wall runs along x at z = at; axis 'z': wall runs along z at x = at
    function wall(axis, from, to, at, door) {
        const hasDoor = door !== undefined;
        const segs = hasDoor ? [[from, door - DOOR_W / 2], [door + DOOR_W / 2, to]] : [[from, to]];
        segs.forEach(([a, b]) => {
            if (b - a < 0.01) return;
            const len = b - a;
            const mid = (a + b) / 2;
            if (axis === 'x') {
                box(len, H, 0.2, M.plaster, mid, H / 2, at);
                box(len, 0.07, 0.24, M.gap, mid, 0.035, at);
            } else {
                box(0.2, H, len, M.plaster, at, H / 2, mid);
                box(0.24, 0.07, len, M.gap, at, 0.035, mid);
            }
        });
        if (!hasDoor) return;
        const lintel = H - DOOR_H;
        if (axis === 'x') {
            box(DOOR_W, lintel, 0.2, M.plaster, door, DOOR_H + lintel / 2, at);
            box(0.14, DOOR_H, 0.36, M.charcoal, door - DOOR_W / 2 + 0.07, DOOR_H / 2, at);
            box(0.14, DOOR_H, 0.36, M.charcoal, door + DOOR_W / 2 - 0.07, DOOR_H / 2, at);
            box(DOOR_W, 0.14, 0.36, M.charcoal, door, DOOR_H - 0.07, at);
        } else {
            box(0.2, lintel, DOOR_W, M.plaster, at, DOOR_H + lintel / 2, door);
            box(0.36, DOOR_H, 0.14, M.charcoal, at, DOOR_H / 2, door - DOOR_W / 2 + 0.07);
            box(0.36, DOOR_H, 0.14, M.charcoal, at, DOOR_H / 2, door + DOOR_W / 2 - 0.07);
            box(0.36, 0.14, DOOR_W, M.charcoal, at, DOOR_H - 0.07, door);
        }
    }
    const ceilingOver = (x0, x1, z0, z1) => box(x1 - x0, 0.2, z1 - z0, M.ceiling, (x0 + x1) / 2, H + 0.1, (z0 + z1) / 2);

    // Layout (top view): A = living room, B = garage (west of A), C = pool area (north of B)
    //   C: x -13.5..-4.5, z -13.5..-4.5
    //   B: x -13.5..-4.5, z  -4.5.. 4.5     A: x -4.5..4.5, z -4.5..7 (open to the south)
    if (OLD) {                                  // otherwise all of these come baked in room-{a,b,c}.glb
        wall('x', -4.5, 4.5, -4.5);             // A north
        wall('z', -4.5, 7, 4.5);                // A east
        wall('z', -4.5, 7, -4.5, 0);            // A west, door to B
        ceilingOver(-4.5, 4.5, -4.5, 7);
        wall('z', -4.5, 4.5, -13.5);            // B west
        wall('x', -13.5, -4.5, 4.5);            // B south
        wall('x', -13.5, -4.5, -4.5, -9);       // B north, door to C
        wall('z', -13.5, -4.5, -13.5);          // C west
        wall('z', -13.5, -4.5, -4.5);           // C east
        wall('x', -13.5, -4.5, -13.5);          // C north
        ceilingOver(-13.5, -4.5, -4.5, 4.5);
        ceilingOver(-13.5, -4.5, -13.5, -4.5);
    }

    // ---------- floors ----------
    const floorMat = (opacity, roughness, metalness = 0) => new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness, metalness, clearcoat: 1, clearcoatRoughness: 0.08, transparent: opacity < 1, opacity, envMapIntensity: 0.35,
    });
    const flat = (w, d, material, x, z, y = 0) => {
        const m = mesh(new THREE.PlaneGeometry(w, d), material, x, y, z);
        m.rotation.x = -Math.PI / 2;
        return m;
    };
    const metallicMat = floorMat(0.8, OLD ? 0.16 : 0.5, OLD ? 0.35 : 0.6);   // v2+: the roughness map sets the gloss per vein
    if (!OLD) { metallicMat.clearcoatRoughness = 0.04; metallicMat.envMapIntensity = 0.6; }
    const flakeMat = floorMat(0.82, 0.3);
    const deckMat = floorMat(1, 0.24);
    flat(9, 11.5, metallicMat, 0, 1.25);
    flat(9, 9, flakeMat, -9, 0);

    // shared mirror under rooms A and B gives the glossy reflections
    const reflectorSize = () => {
        const s = (mobile ? 0.35 : 0.45) * pixelRatio;
        return [Math.round(hero.clientWidth * s), Math.round(window.innerHeight * s)];
    };
    const [rw, rh] = reflectorSize();
    const mirrorGeometry = new THREE.PlaneGeometry(18, 11.5);
    const mirror = new Reflector(mirrorGeometry, { textureWidth: rw, textureHeight: rh, color: 0x8c857c, clipBias: 0.003 });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(-4.5, -0.002, 1.25);
    scene.add(mirror);
    geometries.push(mirrorGeometry);

    // garage floor: flake painted in the browser from the chosen blend (no download)
    const flakeCanvas = document.createElement('canvas');
    flakeCanvas.width = flakeCanvas.height = 512;
    const flakeTexture = new THREE.CanvasTexture(flakeCanvas);
    flakeTexture.colorSpace = THREE.SRGBColorSpace;
    flakeTexture.wrapS = flakeTexture.wrapT = THREE.RepeatWrapping;
    flakeTexture.repeat.set(5, 5);
    flakeTexture.anisotropy = anisotropy;
    textures.push(flakeTexture);
    function paintFlake(name) {
        const palette = FLAKES[name] || FLAKES.Outback;
        const ctx = flakeCanvas.getContext('2d');
        const size = 512;
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        ctx.fillStyle = palette[0][0];
        ctx.fillRect(0, 0, size, size);
        const pick = () => { let r = rnd(); for (const [c, w] of palette) { if ((r -= w) <= 0) return c; } return palette[0][0]; };
        for (let i = 0; i < 9000; i++) {
            const cx = rnd() * size;
            const cy = rnd() * size;
            const r = 4 + rnd() * 6;
            const n = 4 + Math.floor(rnd() * 3);
            const pts = [];
            for (let k = 0; k < n; k++) {
                const a = (k / n) * Math.PI * 2 + (rnd() - 0.5);
                const rr = r * (0.5 + rnd() * 0.6);
                pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
            }
            ctx.fillStyle = pick();
            // wrapped copies only near the edges, so the texture tiles seamlessly
            const offsX = [0].concat(cx < r ? [size] : cx > size - r ? [-size] : []);
            const offsY = [0].concat(cy < r ? [size] : cy > size - r ? [-size] : []);
            offsX.forEach((ox) => offsY.forEach((oy) => {
                ctx.beginPath();
                pts.forEach(([px, py], k) => (k ? ctx.lineTo(cx + px + ox, cy + py + oy) : ctx.moveTo(cx + px + ox, cy + py + oy)));
                ctx.fill();
            }));
        }
        flakeTexture.needsUpdate = true;
    }
    paintFlake('Outback');
    flakeMat.map = flakeTexture;
    const onFlake = (event) => paintFlake(event.detail);
    window.addEventListener('ale:flake', onFlake);

    // ---------- light: soft fill, one warm light per room, downlights with beams ----------
    // v2: the rooms' light is baked; the hemisphere only lifts the live floors and objects a little
    scene.add(new THREE.HemisphereLight(0xffe7cc, 0x2a2018, OLD ? 0.45 : 0.3));
    if (OLD) [[0, 0.5], [-9, 0], [-9, -9]].forEach(([x, z]) => {
        const light = new THREE.PointLight(0xffcf96, 28, 11, 2);
        light.position.set(x, H - 1.1, z);
        scene.add(light);
    });
    const floorPool = new THREE.MeshBasicMaterial({
        map: canvasTexture(128, 128, (c) => {
            const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, 'rgba(255,210,150,0.9)');
            g.addColorStop(1, 'rgba(255,200,140,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, 128, 128);
        }),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.2,
    });
    // beam: a faint vertical gradient on an open cone = light catching dust in the air
    const beamMat = new THREE.MeshBasicMaterial({
        map: canvasTexture(4, 128, (c) => {
            const g = c.createLinearGradient(0, 0, 0, 128);
            g.addColorStop(0, 'rgba(255,214,160,0.55)');
            g.addColorStop(1, 'rgba(255,214,160,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, 4, 128);
        }),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.09,
    });
    const discGeo = new THREE.CircleGeometry(0.09, 20);
    const poolGeo = new THREE.PlaneGeometry(2.2, 2.2);
    const beamGeo = new THREE.ConeGeometry(0.85, H - 0.05, 20, 1, true);
    keep(discGeo, floorPool);
    keep(poolGeo, beamMat);
    keep(beamGeo);
    // baked = the fitting and its light on the floor are already in room-a.glb; only the beam is added
    const downlight = (x, z, beam = true, baked = false) => {
        if (!baked) {
            const d = new THREE.Mesh(discGeo, M.led);
            d.rotation.x = Math.PI / 2;
            d.position.set(x, H - 0.005, z);
            scene.add(d);
            const p = new THREE.Mesh(poolGeo, floorPool);
            p.rotation.x = -Math.PI / 2;
            p.position.set(x, 0.006, z);
            scene.add(p);
        }
        if (beam) {
            const b = new THREE.Mesh(beamGeo, beamMat);
            b.position.set(x, (H - 0.05) / 2, z);
            scene.add(b);
        }
    };
    [[-2.6, -2.2], [2.6, -2.2], [-2.6, 2.8], [2.6, 2.8]].forEach(([x, z]) => downlight(x, z, true, !OLD));
    // garage (v2: LED battens baked in room-b.glb) and pool area (spots baked in room-c.glb)
    if (OLD) [[-11.4, -2.2], [-6.6, -2.2], [-11.4, 2.4], [-6.6, 2.4]].forEach(([x, z]) => downlight(x, z));
    if (OLD) [[-11.6, -6.6], [-6.4, -6.6], [-11.6, -12], [-6.4, -12]].forEach(([x, z]) => downlight(x, z, false));

    // dust drifting in the air (very light)
    const DUST = mobile ? 160 : 320;
    const dustPos = new Float32Array(DUST * 3);
    const dustBox = [[-4.3, 4.3, -4.3, 6], [-13.3, -4.7, -4.3, 4.3], [-13.3, -4.7, -13.3, -4.7]];
    for (let i = 0; i < DUST; i++) {
        const [x0, x1, z0, z1] = dustBox[i % 3];
        dustPos.set([x0 + Math.random() * (x1 - x0), Math.random() * H, z0 + Math.random() * (z1 - z0)], i * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0xffe2b8, size: 0.018, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    keep(dustGeo, dustMat);
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // ---------- framed project photos, each under a soft wash of light ----------
    const washMat = new THREE.MeshBasicMaterial({
        map: canvasTexture(128, 256, (c) => {
            c.setTransform(1, 0, 0, 2, 0, 0);
            const g = c.createRadialGradient(64, 6, 2, 64, 14, 62);
            g.addColorStop(0, 'rgba(255,214,160,0.95)');
            g.addColorStop(0.4, 'rgba(255,196,130,0.4)');
            g.addColorStop(1, 'rgba(255,190,120,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, 128, 128);
        }),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
    });
    const washGeo = new THREE.PlaneGeometry(1.8, 3.4);
    keep(washGeo, washMat);
    const photos = [];
    // axis 'x': wall along x at z = at (dir +1 faces +z); axis 'z': wall along z at x = at (dir +1 faces +x)
    // withFrame = false when the frame itself is baked in room-a.glb (the photo stays live)
    function framed(url, axis, at, along, dir, w, h, withFrame = true) {
        const g = new THREE.Group();
        g.rotation.y = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        if (axis === 'x') g.position.set(along, 1.75, at + dir * 0.11);
        else g.position.set(at + dir * 0.11, 1.75, along);
        scene.add(g);
        if (withFrame) box(w + 0.12, h + 0.12, 0.05, M.charcoal, 0, 0, 0, g);
        const mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.55 });
        mesh(new THREE.PlaneGeometry(w, h), mat, 0, 0, 0.03, g);
        photos.push({ url, mat });
        const wash = new THREE.Mesh(washGeo, washMat);
        wash.position.set(0, 0.1, 0.005);
        g.add(wash);
    }

    // ---------- room A: living room ----------
    // sofa against the north wall, coffee table, slat wall + LED, plant, pendant, plinth with the sample.
    // The Blender version (room-a.glb) has all of these; only the animated sample stays here.
    if (OLD) {
        box(2.8, 0.42, 0.95, M.fabric, -1.2, 0.21, -3.7);
        box(2.8, 0.55, 0.22, M.fabric, -1.2, 0.69, -4.1);
        box(0.22, 0.6, 0.95, M.fabric, -2.49, 0.3, -3.7);
        box(0.22, 0.6, 0.95, M.fabric, 0.09, 0.3, -3.7);
        box(1.15, 0.14, 0.8, M.fabricLight, -1.82, 0.49, -3.62);
        box(1.15, 0.14, 0.8, M.fabricLight, -0.58, 0.49, -3.62);
        box(1.2, 0.32, 0.62, M.walnut, -1.2, 0.16, -2.2);
        box(1.28, 0.04, 0.7, M.stone, -1.2, 0.34, -2.2);
        // pendant over the table
        box(0.012, 1.1, 0.012, M.charcoal, -1.2, H - 0.55, -2.2);
        mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.24, 24, 1, true), M.charcoal, -1.2, H - 1.2, -2.2);
        const bulb = mesh(new THREE.CircleGeometry(0.2, 24), M.led, -1.2, H - 1.32, -2.2);
        bulb.rotation.x = Math.PI / 2;
        const pendantPool = new THREE.Mesh(poolGeo, floorPool);
        pendantPool.rotation.x = -Math.PI / 2;
        pendantPool.position.set(-1.2, 0.365, -2.2);
        scene.add(pendantPool);
    }
    // walnut slats behind the sofa and on the pool area's west wall (one draw call)
    const slatGeo = new THREE.BoxGeometry(0.07, H - 0.25, 0.06);
    const slatAt = [];
    if (OLD) for (let x = -3.6; x <= 1.2; x += 0.13) slatAt.push([x, -4.36, false]);
    if (OLD) for (let z = -12.6; z <= -5.4; z += 0.13) slatAt.push([-13.36, z, true]);
    const slats = new THREE.InstancedMesh(slatGeo, M.walnut, slatAt.length);
    const mtx = new THREE.Matrix4();
    slatAt.forEach(([a, b, side], i) => {
        if (side) mtx.makeRotationY(Math.PI / 2).setPosition(a, (H - 0.25) / 2 + 0.12, b);
        else mtx.makeTranslation(a, (H - 0.25) / 2 + 0.12, b);
        slats.setMatrixAt(i, mtx);
    });
    scene.add(slats);
    keep(slatGeo);
    if (OLD) box(4.9, 0.03, 0.05, M.led, -1.2, 0.1, -4.32);
    if (OLD) box(0.05, 0.03, 7.3, M.led, -13.32, 0.1, -9);
    // plant: dark pot with crossed leaf cards
    if (OLD) {
        mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.75, 24), M.charcoal, 3.6, 0.375, -3.5);
        const leafMat = new THREE.MeshStandardMaterial({
            map: canvasTexture(128, 256, (c) => {
                for (let i = 0; i < 9; i++) {
                    c.save();
                    c.translate(64, 250);
                    c.rotate((i - 4) * 0.2);
                    c.beginPath();
                    c.ellipse(0, -120, 16, 120, 0, 0, Math.PI * 2);
                    c.fillStyle = i % 2 ? '#3d5c35' : '#2b4426';
                    c.fill();
                    c.restore();
                }
            }),
            transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8,
        });
        const leafGeo = new THREE.PlaneGeometry(1.0, 1.9);
        keep(leafGeo, leafMat);
        for (let i = 0; i < 4; i++) {
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set(3.6, 1.6, -3.5);
            leaf.rotation.y = (i / 4) * Math.PI;
            scene.add(leaf);
        }
    }
    // plinth with the layered floor sample, under its own spot (baked in room-a.glb; kept as the spot's target)
    const plinth = box(1.2, 0.78, 1.2, M.charcoal, 2.3, 0.39, -0.8);
    plinth.visible = OLD;
    const sample = new THREE.Group();
    sample.position.set(2.3, 0.86, -0.8);
    scene.add(sample);
    const spot = new THREE.SpotLight(0xffe0b8, 40, 7, 0.36, 0.7, 2);
    spot.position.set(2.0, H - 0.1, 0.2);
    spot.target = plinth;
    // the sample's shadow on top of the plinth: a small, soft shadow map (only redrawn in room A)
    spot.castShadow = true;
    spot.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    spot.shadow.camera.near = 1.5;
    spot.shadow.camera.far = 4.5;
    spot.shadow.bias = -0.0004;
    spot.shadow.radius = 4;
    scene.add(spot);
    if (!OLD) {
        const shadowMat = new THREE.ShadowMaterial({ opacity: 0.45 });
        const catcher = mesh(new THREE.PlaneGeometry(1.2, 1.2), shadowMat, 2.3, 0.782, -0.8);
        catcher.rotation.x = -Math.PI / 2;
        catcher.receiveShadow = true;
    }
    // the floor sample: the real metallic system, layer by layer. It opens into an exploded view as
    // you scroll the first room (tied to "built layer by layer"); labels in .layer-labels follow it.
    const sampleMats = [
        new THREE.MeshStandardMaterial({ color: 0xa9a49c, roughness: 0.9 }),                                  // concrete slab
        new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 0.7 }),                                  // primer
        new THREE.MeshPhysicalMaterial({ color: 0x2a2826, roughness: 0.45, clearcoat: 0.3 }),                 // base coat
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.55, clearcoat: 0.6 }), // metallic
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.22, depthWrite: false }), // top coat
    ];
    let stackY = 0;
    const sampleLayers = [0.2, 0.02, 0.025, 0.035, 0.02].map((h, i) => {
        const m = box(0.95, h, 0.66, sampleMats[i], 0, 0, 0, sample);
        m.userData = { restY: stackY + h / 2, i, h };
        m.castShadow = i < 4;            // the clear top coat doesn't cast
        stackY += h;
        return m;
    });
    const layerLabels = Array.from(hero.querySelectorAll('.layer-labels li'));   // primer, base coat, metallic, top coat
    const layerPoint = new THREE.Vector3();
    let explode = 0;
    let sampleSpin = 0;
    let idle = 0;
    load(IMG + 'hero/concrete.webp', [1.4, 1], (t) => { sampleMats[0].map = t; sampleMats[0].color.set(0xffffff); sampleMats[0].needsUpdate = true; });
    framed(IMG + '1-home/finishedServices/FS5.webp', 'z', 4.5, 0.6, -1, 1.5, 1.1, OLD);
    framed(IMG + '1-home/finishedServices/FS8.webp', 'z', 4.5, 3.6, -1, 1.5, 1.1, OLD);
    framed(IMG + '1-home/finishedServices/FS7.webp', 'z', -4.5, 3.8, 1, 1.3, 1.1, OLD);

    // ---------- the three rooms from Blender: one mesh each, colors and light baked into one texture ----------
    // The textures already have Blender's look (AgX tone mapping), so they skip three's tone mapping;
    // render() fades their color with the intro exposure instead. Progress shows in .hero-loader.
    const bakedMats = [];
    const loaderEl = hero.querySelector('.hero-loader');
    function loadRooms() {
        if (OLD) return Promise.resolve();
        const manager = new THREE.LoadingManager();
        if (loaderEl) loaderEl.hidden = false;
        manager.onProgress = (url, done, total) => {
            if (!loaderEl) return;
            const p = total ? done / total : 0;
            loaderEl.style.setProperty('--load', p.toFixed(3));
            loaderEl.querySelector('.hero-loader-pct').textContent = Math.round(p * 100) + '%';
        };
        const texLoader = new THREE.TextureLoader(manager);
        const gltfLoader = new GLTFLoader(manager);
        const tex = (url, flipY) => new Promise((resolve, reject) => {
            const t = texLoader.load(url, () => resolve(t), undefined, reject);
            t.flipY = flipY;                 // glTF UVs expect flipY = false
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = anisotropy;
            textures.push(t);
        });
        // each floor keeps its live material; its UVs (uv for A/B, uv1 for the pool deck) match the bake
        const floors = { a: [metallicMat, 0], b: [flakeMat, 0], c: [deckMat, 1] };
        const size = mobile ? '-m' : '';         // phones get the 1024 px textures (a quarter of the bytes)
        // the models come gzipped (less than half the bytes; the host doesn't compress .glb) and are
        // unpacked here; browsers without DecompressionStream load the plain .glb
        const model = (url) => {
            if (!('DecompressionStream' in window)) return gltfLoader.loadAsync(url);
            manager.itemStart(url);
            return fetch(url + '.gz')
                .then((res) => {
                    if (!res.ok) throw new Error(res.status + ' ' + url);
                    return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
                })
                .then((buffer) => gltfLoader.parseAsync(buffer, MODELS))
                .finally(() => manager.itemEnd(url));
        };
        // pieces baked on their own (a continuous UV for curved cloth): model + atlas, no floor
        const extras = ['b-cover'].map((r) => Promise.all([
            model(MODELS + `room-${r}.glb`),
            tex(MODELS + `room-${r}-atlas${size}.webp`, false),
        ]).then(([gltf, atlas]) => {
            const baked = new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false });
            materials.push(baked);
            bakedMats.push(baked);
            gltf.scene.traverse((o) => {
                if (!o.isMesh) return;
                o.material = baked;
                geometries.push(o.geometry);
            });
            scene.add(gltf.scene);
        }));
        return Promise.all(extras.concat(['a', 'b', 'c'].map((r) => Promise.all([
            model(MODELS + `room-${r}.glb`),
            tex(MODELS + `room-${r}-atlas${size}.webp`, false),
            tex(MODELS + `room-${r}-floor-light${size}.webp`, true),
        ]).then(([gltf, atlas, floorLight]) => {
            const baked = new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false });
            materials.push(baked);
            bakedMats.push(baked);
            gltf.scene.traverse((o) => {
                if (!o.isMesh) return;
                o.material = baked;
                geometries.push(o.geometry);
            });
            scene.add(gltf.scene);
            const [mat, channel] = floors[r];
            floorLight.channel = channel;
            mat.lightMap = floorLight;
            mat.lightMapIntensity = FLOOR_LIGHT_GAIN;
            mat.needsUpdate = true;
        }))));
    }
    function hideLoader() {
        if (!loaderEl || loaderEl.hidden) return;
        loaderEl.classList.add('is-done');
        window.setTimeout(() => { loaderEl.hidden = true; }, 400);
    }

    // ---------- room B: garage ----------
    // v2: door, cabinets, shelves, workbench, covered car, tires and bike are in room-b.glb
    if (OLD) {
        // sectional garage door (west wall) with a light strip above, cabinets, parking stripes
        box(0.08, 2.7, 4.6, M.metal, -13.36, 1.35, 0);
        for (let i = 1; i < 5; i++) box(0.1, 0.025, 4.6, M.gap, -13.3, i * 0.54, 0);
        box(0.06, 0.03, 4.4, M.led, -13.32, 2.9, 0);
        for (let i = 0; i < 3; i++) {
            box(0.8, 2.0, 0.5, M.graphite, -12.95 + i * 0.83, 1.0, -4.15);
            box(0.02, 0.5, 0.02, M.metal, -12.62 + i * 0.83, 1.15, -3.89);
        }
        [-11.2, -7].forEach((x) => flat(0.12, 4.6, M.stripe, x, 0.6, 0.007));
    }
    framed(IMG + '2-service/homeServices/garage.webp', 'x', -4.5, -6.05, 1, 1.5, 1.14, OLD);
    framed(IMG + '1-home/generalServices/epoxyGarageFloor.webp', 'x', 4.5, -9, -1, 1.9, 1.42, OLD);

    // ---------- room C: pool area ----------
    // polished concrete deck around a sunken, glowing pool; stone coping; lounger; backlit logo
    const pool = { x0: -11.3, x1: -6.3, z0: -11.6, z1: -8.8 };
    // the deck's baked light map covers the whole room: uv1 = position in the room (x -13.5..-4.5,
    // z from -4.5 at the bottom of the image to -13.5 at the top), same as scripts/bake_room.py
    const roomUV1 = (m, x0, x1, zS, zN) => {
        m.updateMatrixWorld();
        const pos = m.geometry.attributes.position;
        const uv1 = new Float32Array(pos.count * 2);
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
            uv1[i * 2] = (v.x - x0) / (x1 - x0);
            uv1[i * 2 + 1] = (zS - v.z) / (zS - zN);
        }
        m.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    };
    [
        flat(9, 1.9, deckMat, -9, -12.55),                                    // north strip
        flat(9, 4.3, deckMat, -9, -6.65),                                     // south strip
        flat(pool.x0 + 13.5, 2.8, deckMat, (pool.x0 - 13.5) / 2, -10.2),      // west strip
        flat(-4.5 - pool.x1, 2.8, deckMat, (pool.x1 - 4.5) / 2, -10.2),       // east strip
    ].forEach((m) => roomUV1(m, -13.5, -4.5, -4.5, -13.5));
    load(IMG + 'hero/polished.webp', [3, 3], (t) => { deckMat.map = t; deckMat.needsUpdate = true; });
    const pw = pool.x1 - pool.x0;
    const pd = pool.z1 - pool.z0;
    const pcx = (pool.x0 + pool.x1) / 2;
    const pcz = (pool.z0 + pool.z1) / 2;
    const tile = new THREE.MeshStandardMaterial({ color: 0x7cc7d3, emissive: 0x0f6f7f, emissiveIntensity: 0.7, roughness: 0.4 });
    materials.push(tile);
    box(pw, 0.05, pd, tile, pcx, -1.2, pcz);
    box(pw, 1.2, 0.05, tile, pcx, -0.6, pool.z0);
    box(pw, 1.2, 0.05, tile, pcx, -0.6, pool.z1);
    box(0.05, 1.2, pd, tile, pool.x0, -0.6, pcz);
    box(0.05, 1.2, pd, tile, pool.x1, -0.6, pcz);
    if (OLD) {                           // v2: the stone coping is in room-c.glb
        box(pw + 0.6, 0.06, 0.3, M.stone, pcx, 0.03, pool.z0 - 0.15);
        box(pw + 0.6, 0.06, 0.3, M.stone, pcx, 0.03, pool.z1 + 0.15);
        box(0.3, 0.06, pd, M.stone, pool.x0 - 0.15, 0.03, pcz);
        box(0.3, 0.06, pd, M.stone, pool.x1 + 0.15, 0.03, pcz);
    }
    // caustics: two layers of a bright web pattern drifting over the pool floor (additive, very cheap)
    const caustic = canvasTexture(256, 256, (c) => {
        c.fillStyle = '#000';
        c.fillRect(0, 0, 256, 256);
        c.strokeStyle = 'rgba(190,245,255,0.85)';
        c.lineCap = 'round';
        let seed = 3;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 70; i++) {          // wavy closed loops, wrapped so the texture tiles
            const cx = rnd() * 256;
            const cy = rnd() * 256;
            const r = 10 + rnd() * 22;
            c.lineWidth = 1 + rnd() * 2.2;
            [-256, 0, 256].forEach((ox) => [-256, 0, 256].forEach((oy) => {
                c.beginPath();
                for (let k = 0; k <= 24; k++) {
                    const a = (k / 24) * Math.PI * 2;
                    const rr = r * (1 + 0.25 * Math.sin(a * 3 + i));
                    const px = cx + ox + Math.cos(a) * rr;
                    const py = cy + oy + Math.sin(a) * rr;
                    if (k) c.lineTo(px, py); else c.moveTo(px, py);
                }
                c.stroke();
            }));
        }
    });
    caustic.colorSpace = THREE.SRGBColorSpace;
    caustic.wrapS = caustic.wrapT = THREE.RepeatWrapping;
    const causticLayers = [[1.6, 0.95, 0.35], [2.3, 1.4, 0.25]].map(([rx, ry, opacity]) => {
        const t = caustic.clone();
        t.repeat.set(rx, ry);
        t.needsUpdate = true;
        textures.push(t);
        const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x9fe8f5 });
        materials.push(m);
        flat(pw - 0.06, pd - 0.06, m, pcx, pcz, -1.17);
        return t;
    });
    // water: ripple normals painted once, scrolled every frame
    const rippleNormal = canvasTexture(256, 256, (c) => {
        const img = c.createImageData(256, 256);
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
                const a = (x / 256) * Math.PI * 2;
                const b = (y / 256) * Math.PI * 2;
                const nx = Math.sin(a * 3 + Math.sin(b * 2) * 1.5) * 0.5 + Math.sin(a * 7 + b * 5) * 0.2;
                const ny = Math.cos(b * 4 + Math.sin(a * 3) * 1.2) * 0.5 + Math.cos(b * 9 - a * 2) * 0.2;
                const i = (y * 256 + x) * 4;
                img.data[i] = 128 + nx * 90;
                img.data[i + 1] = 128 + ny * 90;
                img.data[i + 2] = 255;
                img.data[i + 3] = 255;
            }
        }
        c.putImageData(img, 0, 0);
    });
    rippleNormal.colorSpace = THREE.NoColorSpace;
    rippleNormal.wrapS = rippleNormal.wrapT = THREE.RepeatWrapping;
    rippleNormal.repeat.set(2, 1.2);
    const water = new THREE.MeshPhysicalMaterial({
        color: 0x2bb3c4, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.72,
        normalMap: rippleNormal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.2,
    });
    flat(pw, pd, water, pcx, pcz, -0.12);
    const poolLight = new THREE.PointLight(0x6fd3e0, 6, 6, 2);
    poolLight.position.set(pcx, 0.3, pcz);
    scene.add(poolLight);
    if (OLD) {                           // v2: three teak loungers, umbrella, plants etc. are in room-c.glb
        box(0.7, 0.3, 1.9, M.stone, -11.6, 0.15, -6.4);
        const loungerBack = box(0.7, 0.06, 0.8, M.fabricLight, -11.6, 0.55, -7.15);
        loungerBack.rotation.x = 0.7;
    }
    framed(IMG + '2-service/homeServices/pool-600.webp', 'z', -4.5, -7.6, -1, 1.9, 1.42, OLD);
    framed(IMG + '1-home/generalServices/polyAsparticPoolDeck.webp', 'z', -4.5, -11.4, -1, 1.8, 1.15, OLD);
    // waterline: a band of dark mosaic along the top of the pool walls; the water sits in its middle
    const mosaic = canvasTexture(256, 32, (c) => {
        for (let x = 0; x < 256; x += 8) {
            for (let y = 0; y < 32; y += 8) {
                const v = 70 + ((x * 7 + y * 13) % 5) * 9;
                c.fillStyle = `rgb(${v * 0.35 | 0},${v * 0.75 | 0},${v | 0})`;
                c.fillRect(x + 0.5, y + 0.5, 7, 7);
            }
        }
    });
    mosaic.wrapS = THREE.RepeatWrapping;
    const bandMat = new THREE.MeshStandardMaterial({ map: mosaic, roughness: 0.25, emissive: 0x0b3f4a, emissiveIntensity: 0.35 });
    materials.push(bandMat);
    [[pw, 0.16, 0.02, pcx, pool.z0 + 0.035, 'x'], [pw, 0.16, 0.02, pcx, pool.z1 - 0.035, 'x'],
        [0.02, 0.16, pd, pool.x0 + 0.035, pcz, 'z'], [0.02, 0.16, pd, pool.x1 - 0.035, pcz, 'z']].forEach(([w, h, d, x, z, axis]) => {
        const m = box(w, h, d, bandMat, x, -0.08, z);
        m.userData.axis = axis;
    });
    mosaic.repeat.set(6, 1);

    // living room (v3): the view through the glass wall, the glass itself and the fireplace's flames
    let flame = null;
    if (!OLD) {
        const viewMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
        materials.push(viewMat);
        load(MODELS + 'view-sunset.webp', [1, 1], (t) => {
            t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
            viewMat.map = t;
            viewMat.needsUpdate = true;
        });
        mesh(new THREE.PlaneGeometry(11, 5.5), viewMat, 3, 1.25, -8);
        const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 1, transparent: true, opacity: 0.08, depthWrite: false, envMapIntensity: 1.6 });
        mesh(new THREE.PlaneGeometry(3.0, 3.07), glass, 2.95, 1.685, -4.47);
        const flameTex = canvasTexture(256, 64, (c) => {
            for (let i = 0; i < 18; i++) {
                const x = 8 + i * 14 + (i % 3) * 3;
                const g = c.createRadialGradient(x, 60, 1, x, 46, 26);
                g.addColorStop(0, 'rgba(255,230,160,0.95)');
                g.addColorStop(0.35, 'rgba(255,140,50,0.75)');
                g.addColorStop(1, 'rgba(255,90,20,0)');
                c.fillStyle = g;
                c.beginPath();
                c.ellipse(x, 48, 7, 18 + (i % 4) * 3, 0, 0, Math.PI * 2);
                c.fill();
            }
        });
        flameTex.wrapS = THREE.RepeatWrapping;
        flame = new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        materials.push(flame);
        mesh(new THREE.PlaneGeometry(1.4, 0.34), flame, 0.15, 0.6, -4.16);
    }

    // backlit logo on the north wall: the end of the walk
    const logoTexture = canvasTexture(1024, 256, () => {});
    const drawLogo = () => {
        const c = logoTexture.image.getContext('2d');
        c.clearRect(0, 0, 1024, 256);
        c.fillStyle = '#2b241e';   // dark letters, lit from behind by the halo
        c.textBaseline = 'middle';
        const sans = '700 150px "Schibsted Grotesk", sans-serif';
        const serif = 'italic 500 160px "Newsreader", serif';
        c.font = sans;
        const wAle = c.measureText('Ale ').width;
        c.font = serif;
        const wFloors = c.measureText('Floors').width;
        const x0 = (1024 - wAle - wFloors) / 2;
        c.font = sans;
        c.fillText('Ale ', x0, 128);
        c.font = serif;
        c.fillText('Floors', x0 + wAle, 132);
        logoTexture.needsUpdate = true;
    };
    drawLogo();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLogo);
    const haloMat = floorPool.clone();
    haloMat.opacity = 0.9;
    materials.push(haloMat);
    const halo = new THREE.Mesh(poolGeo, haloMat);
    halo.scale.set(2.2, 0.9, 1);
    halo.position.set(-9, 2.45, -13.38);
    scene.add(halo);
    mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true, depthWrite: false }), -9, 2.45, -13.37);

    // ---------- the camera's curve through the rooms ----------
    // 7 points; rooms are viewed at points 0, 3 and 6. A second curve gives where it looks.
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const pathPos = new THREE.CatmullRomCurve3([
        V(2.2, 1.55, 5.8), V(0.8, 1.55, 2.2), V(-4.5, 1.55, 0.4),
        V(-6.4, 1.55, 2.4), V(-9.4, 1.55, -1.6), V(-9.2, 1.55, -5.4), V(-10.9, 1.6, -6.2),
    ], false, 'centripetal');
    const pathLook = new THREE.CatmullRomCurve3([
        V(-0.9, 1.0, -3.4), V(-4.5, 1.2, -0.4), V(-10, 1.2, 0),
        V(-12.4, 1.1, -2.2), V(-9, 1.2, -8), V(-8.2, 1.0, -11), V(-7.4, 0.5, -11.8),
    ], false, 'centripetal');
    // progress -> place on the curve: hold at each room, glide in between
    const smooth = (t) => t * t * (3 - 2 * t);
    const curveAt = (p) => {
        if (p <= 0.1) return 0;
        if (p < 0.42) return 0.5 * smooth((p - 0.1) / 0.32);
        if (p <= 0.58) return 0.5;
        if (p < 0.9) return 0.5 + 0.5 * smooth((p - 0.58) / 0.32);
        return 1;
    };
    const roomAt = (p) => (p >= 0.68 ? 2 : p >= 0.24 ? 1 : 0);   // same thresholds as js/home.js

    // ---------- hotspots (HTML), pinned to points on each floor ----------
    const spotEls = Array.from(hero.querySelectorAll('.hotspot'));
    const anchors = [V(1.1, 0.05, -1.7), V(-10.2, 0.05, -1.0), V(-10.6, 0.08, -8.4)];
    const projected = new THREE.Vector3();
    // each room's text block (stage coordinates, padded): a hotspot that would land on the text is
    // hidden, so it never covers copy or steals a tap from a button. Measured on resize only.
    const copyEls = [hero.querySelector('.hero-copy'), ...hero.querySelectorAll('.room-caption')];
    let copyRects = [];
    const measureCopy = () => {
        const stage = hero.querySelector('.hero-stage').getBoundingClientRect();
        copyRects = copyEls.map((el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { l: r.left - stage.left, r: r.right - stage.left, t: r.top - stage.top, b: r.bottom - stage.top };
        });
    };
    // hysteresis: hides within 24 px of the text, shows again only beyond 48 px (no flicker at the edge)
    const overCopy = (i, x, y, wasOn) => {
        const c = copyRects[i];
        const pad = wasOn ? 24 : 48;
        return !!c && x > c.l - pad && x < c.r + pad && y > c.t - pad && y < c.b + pad;
    };

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
