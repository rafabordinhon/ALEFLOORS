// Ale Floors — home hero: a walk through a warm-lit, three-room showroom.
// The floor is the star of each room: metallic epoxy, epoxy flake ("Outback"),
// polished concrete. Real project photos hang on the walls, and the layered
// floor sample stands on a plinth in the first room.
//
// Scrolling through the tall hero moves the camera from room to room (the same
// progress js/home.js uses for the captions). The mouse adds a little parallax.
//
// Three.js 0.170.0 is served from js/vendor/ and only downloaded when the device
// can run it well. Otherwise still renders of the rooms are shown (see index.html).
// URL options: ?no3d shows the stills; ?shot=0|1|2 freezes a room (used to make the stills).

const canvas = document.getElementById('heroCanvas');
const hero = document.getElementById('showroom');
const params = new URLSearchParams(window.location.search);
const SHOT = params.has('shot') ? Math.min(2, Math.max(0, parseInt(params.get('shot'), 10) || 0)) : null;

function canUse3D() {
    if (!canvas || !hero) return false;
    if (params.has('no3d')) return false;
    if (SHOT !== null) return true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const connection = navigator.connection;
    if (connection && connection.saveData) return false;
    // weak device: few cores AND little memory (deviceMemory exists only in Chromium)
    const cores = navigator.hardwareConcurrency || 8;
    const memory = navigator.deviceMemory || 8;
    if (cores <= 4 && memory <= 4) return false;
    try {
        return !!document.createElement('canvas').getContext('webgl2');
    } catch (error) {
        return false;
    }
}

// Load after the page is ready so the 3D never competes with the first paint.
function whenIdle(callback) {
    const run = () => ('requestIdleCallback' in window ? window.requestIdleCallback(callback, { timeout: 1500 }) : window.setTimeout(callback, 200));
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run, { once: true });
}

if (canUse3D()) {
    whenIdle(() => {
        Promise.all([
            import('./vendor/three.module.min.js'),
            import('./vendor/RoomEnvironment.js'),
            import('./vendor/Reflector.js'),
        ])
            .then(([THREE, env, refl]) => start(THREE, env.RoomEnvironment, refl.Reflector))
            .catch((error) => console.warn('3D hero disabled:', error));
    });
}

function start(THREE, RoomEnvironment, Reflector) {
    const mobile = window.innerWidth < 768;
    const IMG = 'assets/images/';

    // ---------- renderer, scene, camera ----------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT !== null });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x17130f);
    scene.fog = new THREE.Fog(0x17130f, 12, 30);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envMap = pmrem.fromScene(room, 0.04).texture;
    scene.environment = envMap;

    // ---------- textures (room 1 first; rooms 2-3 load after the first frame) ----------
    const loader = new THREE.TextureLoader();
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const textures = [];
    const load = (url, repeat = [1, 1], onReady) => new Promise((resolve) => {
        const texture = loader.load(url, () => {
            if (onReady) onReady(texture);
            resolve(texture);
        }, undefined, () => resolve(texture));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat[0], repeat[1]);
        texture.anisotropy = anisotropy;
        textures.push(texture);
    });

    // ---------- the building: three rooms in a row along -z ----------
    const W = 9;      // room width (x)
    const H = 3.6;    // ceiling height
    const D = 9;      // room depth (z)
    const ROOMS = 3;
    const LENGTH = D * ROOMS;
    const FRONT = 6;                          // extra floor in front of room 1, where the walk starts
    const SPAN = LENGTH + FRONT;              // full length of walls, ceiling and mirror
    const MID = (FRONT - LENGTH) / 2;         // their center on z
    const geometries = [];
    const materials = [];
    const track = (geometry, material) => {
        geometries.push(geometry);
        (Array.isArray(material) ? material : [material]).forEach((m) => materials.push(m));
    };
    const box = (w, h, d, material, x, y, z, parent = scene) => {
        const geometry = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        track(geometry, material);
        return mesh;
    };

    const plaster = new THREE.MeshStandardMaterial({ color: 0xb0a592, roughness: 0.92 });
    const ceiling = new THREE.MeshStandardMaterial({ color: 0x241e19, roughness: 0.95 });
    const charcoal = new THREE.MeshStandardMaterial({ color: 0x2b241e, roughness: 0.6 });
    const walnut = new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.55 });
    const shadowGap = new THREE.MeshBasicMaterial({ color: 0x0f0c09 });
    const ledMaterial = new THREE.MeshBasicMaterial({ color: 0xffd9a3 });
    materials.push(plaster, ceiling, charcoal, walnut, shadowGap, ledMaterial);
    load(IMG + 'hero/plaster.webp', [5, 1.6], (t) => { plaster.map = t; plaster.needsUpdate = true; });

    // side walls, ceiling and back wall
    box(0.2, H, SPAN, plaster, -W / 2 - 0.1, H / 2, MID);
    box(0.2, H, SPAN, plaster, W / 2 + 0.1, H / 2, MID);
    box(W + 0.4, 0.2, SPAN, ceiling, 0, H + 0.1, MID);
    box(W + 0.4, H, 0.2, plaster, 0, H / 2, -LENGTH - 0.1);

    // partition walls between rooms, each with a wide opening
    const OPEN_W = 4.2;
    const OPEN_H = 3;
    for (let i = 1; i < ROOMS; i++) {
        const z = -i * D;
        const side = (W - OPEN_W) / 2;
        box(side, H, 0.3, plaster, -W / 2 + side / 2, H / 2, z);
        box(side, H, 0.3, plaster, W / 2 - side / 2, H / 2, z);
        box(OPEN_W, H - OPEN_H, 0.3, plaster, 0, OPEN_H + (H - OPEN_H) / 2, z);
    }

    // dark frames around the openings give the doorways depth
    for (let i = 1; i < ROOMS; i++) {
        const z = -i * D;
        box(0.14, OPEN_H, 0.42, charcoal, -OPEN_W / 2 + 0.07, OPEN_H / 2, z);
        box(0.14, OPEN_H, 0.42, charcoal, OPEN_W / 2 - 0.07, OPEN_H / 2, z);
        box(OPEN_W, 0.14, 0.42, charcoal, 0, OPEN_H - 0.07, z);
    }

    // warm cove light along both sides of the ceiling (no real light: a glowing strip)
    box(0.06, 0.04, SPAN, ledMaterial, -W / 2 + 0.05, H - 0.02, MID);
    box(0.06, 0.04, SPAN, ledMaterial, W / 2 - 0.05, H - 0.02, MID);

    // shadow gap where the walls meet the floor (an architectural detail that reads as "finished")
    box(0.03, 0.07, SPAN, shadowGap, -W / 2 + 0.015, 0.035, MID);
    box(0.03, 0.07, SPAN, shadowGap, W / 2 - 0.015, 0.035, MID);

    // walnut slat walls with an LED line at the floor: one each side of the first opening
    // and across the back wall (one InstancedMesh = one draw call)
    const slatGeometry = new THREE.BoxGeometry(0.07, H - 0.25, 0.06);
    const slatSpots = [];
    const slatRun = (x0, x1, z) => { for (let x = x0; x <= x1; x += 0.13) slatSpots.push([x, z]); };
    slatRun(-W / 2 + 0.25, -OPEN_W / 2 - 0.3, -D + 0.2);
    slatRun(OPEN_W / 2 + 0.3, W / 2 - 0.25, -D + 0.2);
    slatRun(-2.6, 2.6, -LENGTH + 0.12);
    const slats = new THREE.InstancedMesh(slatGeometry, walnut, slatSpots.length);
    const slatMatrix = new THREE.Matrix4();
    slatSpots.forEach(([x, z], i) => { slats.setMatrixAt(i, slatMatrix.makeTranslation(x, (H - 0.25) / 2 + 0.12, z)); });
    scene.add(slats);
    track(slatGeometry, walnut);
    box(W / 2 - OPEN_W / 2 - 0.4, 0.03, 0.05, ledMaterial, -(W / 4 + OPEN_W / 4) - 0.05, 0.1, -D + 0.25);
    box(W / 2 - OPEN_W / 2 - 0.4, 0.03, 0.05, ledMaterial, W / 4 + OPEN_W / 4 + 0.05, 0.1, -D + 0.25);
    box(5.4, 0.03, 0.05, ledMaterial, 0, 0.1, -LENGTH + 0.18);

    // recessed downlights in the ceiling, each with a soft pool of light on the floor
    const floorPoolCanvas = document.createElement('canvas');
    floorPoolCanvas.width = floorPoolCanvas.height = 128;
    const fctx = floorPoolCanvas.getContext('2d');
    const fgrad = fctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    fgrad.addColorStop(0, 'rgba(255, 210, 150, 0.9)');
    fgrad.addColorStop(1, 'rgba(255, 200, 140, 0)');
    fctx.fillStyle = fgrad;
    fctx.fillRect(0, 0, 128, 128);
    const floorPoolTexture = new THREE.CanvasTexture(floorPoolCanvas);
    textures.push(floorPoolTexture);
    const floorPoolMaterial = new THREE.MeshBasicMaterial({ map: floorPoolTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22 });
    const floorPoolGeometry = new THREE.PlaneGeometry(2.4, 2.4);
    const downlightGeometry = new THREE.CircleGeometry(0.09, 20);
    track(floorPoolGeometry, floorPoolMaterial);
    track(downlightGeometry, ledMaterial);
    for (let i = 0; i < ROOMS; i++) {
        for (const x of [-2.2, 2.2]) {
            for (const dz of [-2.6, 0, 2.6]) {
                const z = -(i + 0.5) * D + dz;
                const disc = new THREE.Mesh(downlightGeometry, ledMaterial);
                disc.rotation.x = Math.PI / 2;
                disc.position.set(x, H - 0.005, z);
                scene.add(disc);
                const pool = new THREE.Mesh(floorPoolGeometry, floorPoolMaterial);
                pool.rotation.x = -Math.PI / 2;
                pool.position.set(x, 0.004, z);
                scene.add(pool);
            }
        }
    }

    // ---------- floors: one per room, over a shared mirror so they look glossy ----------
    const reflectorSize = () => {
        const scale = (mobile ? 0.35 : 0.5) * renderer.getPixelRatio();
        return [Math.round(hero.clientWidth * scale), Math.round(hero.clientHeight * scale)];
    };
    const [rw, rh] = reflectorSize();
    const mirrorGeometry = new THREE.PlaneGeometry(W, SPAN);
    const mirror = new Reflector(mirrorGeometry, { textureWidth: rw, textureHeight: rh, color: 0x8c857c, clipBias: 0.003 });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(0, -0.002, MID);
    scene.add(mirror);
    geometries.push(mirrorGeometry);

    const floorDefs = [
        { url: 'hero/metallic.webp', repeat: [1, 1], opacity: 0.8, roughness: 0.16, metalness: 0.35 },
        { url: 'hero/flake-floor.webp', repeat: [5, 5], opacity: 0.8, roughness: 0.3, metalness: 0 },
        { url: 'hero/polished.webp', repeat: [3, 3], opacity: 0.8, roughness: 0.2, metalness: 0 },
    ];
    const floors = floorDefs.map((def, i) => {
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, roughness: def.roughness, metalness: def.metalness, clearcoat: 1, clearcoatRoughness: 0.08,
            transparent: true, opacity: def.opacity, envMapIntensity: 0.35,
        });
        // room 1's floor also covers the entrance in front of it
        const depth = i === 0 ? D + FRONT : D;
        const geometry = new THREE.PlaneGeometry(W, depth);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, 0, i === 0 ? (FRONT - D) / 2 : -(i + 0.5) * D);
        scene.add(mesh);
        track(geometry, material);
        return { material, def };
    });

    // ---------- light: soft fill + one warm light per room + light pools on the walls ----------
    scene.add(new THREE.HemisphereLight(0xffe7cc, 0x2a2018, 0.45));
    for (let i = 0; i < ROOMS; i++) {
        const light = new THREE.PointLight(0xffcf96, 28, 11, 2);
        light.position.set(0, H - 1.1, -(i + 0.5) * D);   // lower: lights the floor, not a hot spot on the ceiling
        scene.add(light);
    }

    // a "wall washer": soft cone of light painted on the wall (additive, very cheap)
    const poolCanvas = document.createElement('canvas');
    poolCanvas.width = 128;
    poolCanvas.height = 256;
    const pctx = poolCanvas.getContext('2d');
    // an ellipse (drawn in a stretched context) so the light fades out on every side
    pctx.setTransform(1, 0, 0, 2, 0, 0);
    const grad = pctx.createRadialGradient(64, 6, 2, 64, 14, 62);
    grad.addColorStop(0, 'rgba(255, 214, 160, 0.95)');
    grad.addColorStop(0.4, 'rgba(255, 196, 130, 0.4)');
    grad.addColorStop(1, 'rgba(255, 190, 120, 0)');
    pctx.fillStyle = grad;
    pctx.fillRect(0, 0, 128, 128);
    const poolTexture = new THREE.CanvasTexture(poolCanvas);
    textures.push(poolTexture);
    const poolMaterial = new THREE.MeshBasicMaterial({ map: poolTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
    const poolGeometry = new THREE.PlaneGeometry(1.8, 3.4);
    track(poolGeometry, poolMaterial);
    const lightPool = (x, z, facing) => {
        const mesh = new THREE.Mesh(poolGeometry, poolMaterial);
        mesh.position.set(x, H - 1.75, z);
        mesh.rotation.y = facing;
        scene.add(mesh);
    };

    // framed project photos on the side walls, each under its own light pool
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1d1813, roughness: 0.5 });
    materials.push(frameMaterial);
    const photos = [];
    const framed = (url, side, z, w, h) => {
        const x = side * (W / 2 - 0.04);
        const facing = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        const frame = box(0.06, h + 0.12, w + 0.12, frameMaterial, x - side * 0.02, 1.75, z);
        frame.rotation.y = 0;
        const material = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.55 });
        const geometry = new THREE.PlaneGeometry(w, h);
        const photo = new THREE.Mesh(geometry, material);
        photo.position.set(x - side * 0.06, 1.75, z);
        photo.rotation.y = facing;
        scene.add(photo);
        track(geometry, material);
        photos.push({ url, material });
        lightPool(x - side * 0.08, z, facing);
    };
    // room 1 — metallic floors
    framed(IMG + '1-home/finishedServices/FS5.webp', -1, -3.4, 1.5, 1.1);
    framed(IMG + '1-home/finishedServices/FS8.webp', -1, -6.2, 1.5, 1.1);
    framed(IMG + '1-home/finishedServices/FS7.webp', 1, -6.6, 1.3, 1.1);
    // room 2 — flake / garage floors
    framed(IMG + '2-service/homeServices/garage.webp', -1, -12.2, 1.9, 1.44);
    framed(IMG + '1-home/generalServices/epoxyGarageFloor.webp', 1, -11.6, 1.8, 1.35);
    framed(IMG + '1-home/finishedServices/FS1.webp', 1, -15.4, 1.4, 1.05);
    // room 3 — concrete and pool decks
    framed(IMG + '1-home/generalServices/polishedConcrete-600.webp', -1, -21.4, 1.2, 1.6);
    framed(IMG + '2-service/homeServices/pool-600.webp', 1, -20.8, 1.9, 1.42);
    framed(IMG + '1-home/generalServices/polyAsparticPoolDeck.webp', 1, -24.6, 1.8, 1.15);

    // back wall: a lit niche with an LED line, closes the walk
    box(3.2, 0.04, 0.1, ledMaterial, 0, 2.6, -LENGTH + 0.05);
    lightPool(-2.4, -LENGTH + 0.02, 0);
    lightPool(2.4, -LENGTH + 0.02, 0);

    // ---------- room 1 centerpiece: the layered floor sample on a plinth ----------
    const plinth = box(1.3, 0.78, 1.3, charcoal, 1.7, 0.39, -4.6);
    const sample = new THREE.Group();
    sample.position.set(1.7, 0.86, -4.6);
    scene.add(sample);
    const spot = new THREE.SpotLight(0xffe0b8, 40, 7, 0.36, 0.7, 2);
    spot.position.set(1.4, H - 0.1, -3.6);
    spot.target = plinth;
    scene.add(spot);
    const sampleLayers = [
        { h: 0.2, material: new THREE.MeshStandardMaterial({ color: 0xa9a49c, roughness: 0.9 }) },
        { h: 0.02, material: new THREE.MeshPhysicalMaterial({ color: 0xc89a55, roughness: 0.3, transparent: true, opacity: 0.85 }) },
        { h: 0.045, material: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, clearcoat: 0.4 }) },
        { h: 0.02, material: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.2, depthWrite: false }) },
    ];
    let stackY = 0;
    const sampleMeshes = sampleLayers.map((layer, i) => {
        const mesh = box(1.0, layer.h, 0.7, layer.material, 0, 0, 0, sample);
        mesh.userData.restY = stackY + layer.h / 2;
        mesh.userData.index = i;
        stackY += layer.h;
        return mesh;
    });
    load(IMG + 'hero/concrete.webp', [1.4, 1], (t) => { sampleLayers[0].material.map = t; sampleLayers[0].material.color.set(0xffffff); sampleLayers[0].material.needsUpdate = true; });

    // ---------- camera path: one stop per room ----------
    // stops (position, look-at). Progress 0..1 holds at each stop, then glides to the next.
    const STOPS = [
        { pos: [-1.6, 1.55, 3.2], look: [1.4, 0.9, -5.6] },
        { pos: [1.2, 1.5, -6.4], look: [-1.2, 0.8, -13.8] },
        { pos: [-0.6, 1.5, -17.4], look: [1.2, 0.8, -25.2] },
    ];
    // progress ranges: hold room 1 until 0.12, glide until 0.45, hold, glide 0.6 -> 0.92, hold
    const SEGMENTS = [[0.12, 0.45], [0.6, 0.92]];
    const smooth = (t) => t * t * (3 - 2 * t);
    const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    function pathAt(p) {
        if (p <= SEGMENTS[0][0]) return STOPS[0];
        for (let s = 0; s < SEGMENTS.length; s++) {
            const [a, b] = SEGMENTS[s];
            if (p < a) return STOPS[s];
            if (p <= b) {
                const t = smooth((p - a) / (b - a));
                return { pos: lerp3(STOPS[s].pos, STOPS[s + 1].pos, t), look: lerp3(STOPS[s].look, STOPS[s + 1].look, t) };
            }
        }
        return STOPS[STOPS.length - 1];
    }

    // ---------- state ----------
    const pointer = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };
    let progress = SHOT !== null ? [0, 0.52, 1][SHOT] : 0;
    let smoothProgress = progress;
    let running = false;
    let frame = 0;
    let lastTime = performance.now();
    let startTime = performance.now();
    let firstFrame = true;
    const lookAt = new THREE.Vector3();
    const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

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
        // narrow screens see less sideways: widen the lens a little
        camera.fov = camera.aspect < 0.8 ? 62 : camera.aspect < 1.2 ? 56 : 48;
        camera.updateProjectionMatrix();
        const [w, h] = reflectorSize();
        mirror.getRenderTarget().setSize(w, h);
    }

    function render(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        const t = (now - startTime) / 1000;

        tilt.x = damp(tilt.x, pointer.x, 3, dt);
        tilt.y = damp(tilt.y, pointer.y, 3, dt);
        smoothProgress = SHOT !== null ? progress : damp(smoothProgress, progress, 4, dt);

        const stop = pathAt(smoothProgress);
        // intro: the lights come up and the camera eases in (once, on load)
        const intro = SHOT !== null ? 1 : easeOutCubic(clamp01(t / 1.8));
        renderer.toneMappingExposure = 0.35 + 0.65 * intro;
        const sway = SHOT !== null ? 0 : Math.sin(t * 0.3) * 0.06;
        camera.position.set(
            stop.pos[0] + tilt.x * 0.25 + sway,
            stop.pos[1] - tilt.y * 0.12,
            stop.pos[2] + (1 - intro) * 1.4,
        );
        lookAt.set(stop.look[0] + tilt.x * 0.6, stop.look[1] - tilt.y * 0.3, stop.look[2]);
        camera.lookAt(lookAt);

        // the sample turns slowly and its layers breathe apart a little
        sample.rotation.y = -0.5 + t * 0.25;
        const gap = 0.02 + (SHOT !== null ? 0.03 : 0.03 * (0.5 + 0.5 * Math.sin(t * 0.9)));
        sampleMeshes.forEach((mesh) => { mesh.position.y = mesh.userData.restY + mesh.userData.index * gap; });

        renderer.render(scene, camera);

        if (firstFrame) {
            firstFrame = false;
            document.documentElement.classList.add('has-3d');
            loadLater();
        }
    }

    // rooms 2-3 textures and the photos: after the first frame, so room 1 shows up fast
    let laterLoaded = false;
    function loadLater() {
        if (laterLoaded) return;
        laterLoaded = true;
        floors.forEach(({ material, def }, i) => {
            if (i === 0) return;
            load(IMG + def.url, def.repeat, (tex) => { material.map = tex; material.needsUpdate = true; });
        });
        photos.forEach(({ url, material }) => load(url, [1, 1], (tex) => {
            tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
            material.map = tex;
            material.color.set(0xffffff);
            material.needsUpdate = true;
        }));
    }

    function loop(now) {
        if (!running) return;
        render(now);
        frame = window.requestAnimationFrame(loop);
    }

    function play() {
        if (running || document.hidden) return;
        running = true;
        lastTime = performance.now();
        frame = window.requestAnimationFrame(loop);
    }

    function pause() {
        running = false;
        window.cancelAnimationFrame(frame);
    }

    // pause when the hero is off screen or the tab is hidden
    let heroVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        if (heroVisible) play();
        else pause();
    });
    observer.observe(hero);
    const onVisibility = () => (document.hidden ? pause() : heroVisible && play());
    document.addEventListener('visibilitychange', onVisibility);

    const onPointerMove = (event) => {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const onScroll = () => readProgress();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    // free GPU memory when the page is left
    function dispose() {
        pause();
        observer.disconnect();
        resizeObserver.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('scroll', onScroll);
        document.removeEventListener('visibilitychange', onVisibility);
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        textures.forEach((tex) => tex.dispose());
        mirror.dispose();
        envMap.dispose();
        pmrem.dispose();
        renderer.dispose();
    }
    window.addEventListener('pagehide', (event) => {
        if (!event.persisted) dispose();
    });

    // the room scene was only needed to build the reflections
    room.traverse((object) => {
        if (object.isMesh) {
            object.geometry.dispose();
            object.material.dispose();
        }
    });

    resize();
    readProgress();
    smoothProgress = progress;

    // room 1 needs its floor before the first frame; the rest streams in afterwards
    const firstReady = [load(IMG + floorDefs[0].url, floorDefs[0].repeat, (tex) => {
        floors[0].material.map = tex;
        floors[0].material.needsUpdate = true;
    })];
    if (SHOT !== null) loadLater();
    Promise.all(firstReady).then(() => {
        startTime = performance.now();
        play();
    });
}
