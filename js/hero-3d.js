// Ale Floors — home hero 3D scene.
// An "exploded" floor sample with the four real layers of an epoxy flake floor
// (prepared concrete, primer, base & flake layer, topcoat). The layers drop in one
// by one on load, follow the mouse a little, and close together as the visitor scrolls.
//
// Three.js 0.170.0 is served from js/vendor/ and only downloaded when the device can
// run it well. Otherwise the static image in the hero (hero-fallback.webp) stays.
// Add ?no3d to the URL to see the fallback.

const canvas = document.getElementById('heroCanvas');
const hero = canvas ? canvas.closest('.hero') : null;

function canUse3D() {
    if (!canvas || !hero) return false;
    if (new URLSearchParams(window.location.search).has('no3d')) return false;
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
        Promise.all([import('./vendor/three.module.min.js'), import('./vendor/RoomEnvironment.js')])
            .then(([THREE, env]) => start(THREE, env.RoomEnvironment))
            .catch((error) => console.warn('3D hero disabled:', error));
    });
}

function start(THREE, RoomEnvironment) {
    const labels = Array.from(document.querySelectorAll('#heroLayers li'));
    const reducedQuality = window.innerWidth < 768;

    // ---------- renderer, scene, camera ----------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !reducedQuality, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reducedQuality ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    // soft studio reflections (generated once, no image download)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envMap = pmrem.fromScene(room, 0.04).texture;
    scene.environment = envMap;

    const key = new THREE.DirectionalLight(0xfff3e6, 1.6);
    key.position.set(-3, 6, 4);
    scene.add(key);
    // brand coral as a faint rim light from behind
    const rim = new THREE.PointLight(0xff6b6b, 6, 12, 2);
    rim.position.set(3.6, 1.2, -3.4);
    scene.add(rim);

    // ---------- textures ----------
    const loader = new THREE.TextureLoader();
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const pending = [];
    const loadTexture = (url, repeat) => {
        let texture;
        // one download per texture; the scene starts once every texture has arrived
        pending.push(new Promise((resolve) => {
            texture = loader.load(url, resolve, undefined, resolve);
        }));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat[0], repeat[1]);
        texture.anisotropy = anisotropy;
        return texture;
    };
    const flakeMap = loadTexture('assets/images/hero/flake.webp', [1.7, 1.15]);
    const concreteMap = loadTexture('assets/images/hero/concrete.webp', [2.2, 1.5]);
    // same image, different tiling for the thin sides (a clone shares the download)
    const concreteSide = concreteMap.clone();
    concreteSide.repeat.set(2.2, 0.4);

    // ---------- the floor sample ----------
    const W = 3.4;   // width (x)
    const D = 2.3;   // depth (z)
    const sample = new THREE.Group();
    scene.add(sample);

    const side = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
    // BoxGeometry material order: +x, -x, +y (top), -y, +z, -z
    const faces = (top, sides) => [sides, sides, top, sides, sides, sides];

    const layerDefs = [
        {   // prepared concrete
            h: 0.62,
            material: faces(
                new THREE.MeshStandardMaterial({ map: concreteMap, roughness: 0.92 }),
                new THREE.MeshStandardMaterial({ map: concreteSide, roughness: 0.95, color: 0xd8d5cf }),
            ),
        },
        {   // primer: thin amber coat that soaks into the concrete
            h: 0.05,
            material: new THREE.MeshPhysicalMaterial({
                color: 0xc89a55, roughness: 0.3, clearcoat: 0.6, transparent: true, opacity: 0.85,
            }),
        },
        {   // base coat + decorative flakes (real "Outback" swatch)
            h: 0.13,
            material: faces(
                new THREE.MeshPhysicalMaterial({
                    map: flakeMap, roughness: 0.48, envMapIntensity: 0.6, clearcoat: 0.3, clearcoatRoughness: 0.35,
                }),
                side(0xc9b79c, { roughness: 0.5 }),
            ),
        },
        {   // clear topcoat: glossy, slightly see-through
            h: 0.06,
            material: new THREE.MeshPhysicalMaterial({
                color: 0xffffff, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
                transparent: true, opacity: 0.12, envMapIntensity: 1.5, depthWrite: false,
            }),
            glassEdges: true,
        },
    ];

    const layers = layerDefs.map((def, i) => {
        const geometry = new THREE.BoxGeometry(W, def.h, D);
        const mesh = new THREE.Mesh(geometry, def.material);
        mesh.renderOrder = i;
        // the clear topcoat reads as glass thanks to thin bright edges
        if (def.glassEdges) {
            const edges = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }),
            );
            mesh.add(edges);
        }
        sample.add(mesh);
        return { mesh, h: def.h };
    });

    // soft contact shadow (a blurred radial gradient, much cheaper than shadow maps)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0,0,0,0.75)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(W * 1.9, D * 2.1),
        new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    // ---------- state ----------
    let startTime = performance.now();
    const pointer = { x: 0, y: 0 };      // target, -1..1
    const tilt = { x: 0, y: 0 };         // smoothed
    let scrollProgress = 0;              // 0 at top of the page, 1 when the hero has scrolled away
    let smoothScroll = 0;
    let layout = { x: 0, y: 0, scale: 1, labels: false };
    let running = false;
    let frame = 0;
    let lastTime = performance.now();
    let firstFrame = true;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

    function resize() {
        const width = hero.clientWidth;
        const height = hero.clientHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        const desktop = width >= 1024;
        const aspect = width / height;
        // half the visible width (world units) at the sample's distance from the camera (~9.7)
        const halfWidth = Math.tan(THREE.MathUtils.degToRad((desktop ? 30 : 36) / 2)) * 9.7 * aspect;
        // desktop: sample centered at 67% of the screen width, about a third of it wide,
        // leaving room for the layer labels on its right; phones/tablets: centered on top
        layout = desktop
            ? width < 1200
                ? { x: 0.28 * halfWidth, y: 0.15, scale: 0.37 * aspect, labels: true }
                : { x: 0.34 * halfWidth, y: 0.15, scale: Math.min(0.8, 0.4 * aspect), labels: true }
            // narrow screens: shrink with the aspect ratio so the sample never touches the edges
            : { x: 0, y: 1.0, scale: Math.min(0.8, Math.max(0.5, (width / height) * 1.05)), labels: false };
        camera.fov = desktop ? 30 : 36;
        camera.position.set(0, 3.1, 9.2);
        camera.lookAt(0, 0.35, 0);
        camera.updateProjectionMatrix();
    }

    function onPointerMove(event) {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    }

    function onScroll() {
        scrollProgress = clamp01(window.scrollY / (hero.offsetHeight * 0.75));
    }

    const projected = new THREE.Vector3();

    function render(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        const t = (now - startTime) / 1000;

        tilt.x = damp(tilt.x, pointer.x, 3.5, dt);
        tilt.y = damp(tilt.y, pointer.y, 3.5, dt);
        smoothScroll = damp(smoothScroll, scrollProgress, 6, dt);

        // explode: 1 = layers apart, 0 = assembled. Scrolling closes the sample.
        const explode = 1 - easeOutCubic(smoothScroll);
        const gap = 0.42 * explode;

        sample.position.set(layout.x, layout.y - smoothScroll * 0.6, 0);
        sample.scale.setScalar(layout.scale);
        sample.rotation.set(
            0.08 + tilt.y * 0.08,
            -0.62 + Math.sin(t * 0.25) * 0.06 + tilt.x * 0.18 + smoothScroll * 0.7,
            0,
        );

        // intro: layers drop in from above, bottom layer first ("built layer by layer")
        let y = 0;
        layers.forEach((layer, i) => {
            const intro = easeOutCubic(clamp01((t - 0.15 - i * 0.22) / 0.9));
            const restY = y + layer.h / 2 + i * gap;
            layer.mesh.position.y = restY + (1 - intro) * 2.6;
            layer.mesh.visible = intro > 0.001;
            layer.restY = restY;
            layer.intro = intro;
            y += layer.h;
        });

        shadow.position.set(layout.x, layout.y - smoothScroll * 0.6 - 0.02, 0);
        shadow.scale.setScalar(layout.scale);
        shadow.material.opacity = 0.55 + 0.3 * (1 - explode);

        renderer.render(scene, camera);

        // labels next to each layer (top layer first in the list)
        if (layout.labels && labels.length === layers.length) {
            sample.updateMatrixWorld();
            const width = hero.clientWidth;
            const height = hero.clientHeight;
            layers.forEach((layer, i) => {
                const label = labels[layers.length - 1 - i];
                // anchor to whichever right-hand corner is furthest right on screen
                let sx = -Infinity;
                let sy = 0;
                [D / 2, -D / 2].forEach((z) => {
                    projected.set(W / 2, layer.restY, z).applyMatrix4(sample.matrixWorld).project(camera);
                    const x = (projected.x * 0.5 + 0.5) * width;
                    if (x > sx) {
                        sx = x;
                        sy = (-projected.y * 0.5 + 0.5) * height;
                    }
                });
                sx += 14;
                label.style.transform = `translate(${sx.toFixed(1)}px, ${(sy - 8).toFixed(1)}px)`;
                // fade out early, before the closing layers bring the labels together
                label.style.opacity = String((clamp01((explode - 0.55) / 0.45) * layer.intro).toFixed(3));
            });
        }

        if (firstFrame) {
            firstFrame = false;
            document.documentElement.classList.add('has-3d');
        }
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

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    // free GPU memory when the page is left
    function dispose() {
        pause();
        observer.disconnect();
        resizeObserver.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('scroll', onScroll);
        document.removeEventListener('visibilitychange', onVisibility);
        scene.traverse((object) => {
            if (!object.geometry) return;   // meshes and the topcoat's edge lines
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => {
                if (material.map) material.map.dispose();
                material.dispose();
            });
        });
        [flakeMap, concreteMap, concreteSide, shadowTexture, envMap].forEach((texture) => texture.dispose());
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
    onScroll();
    // start only when the textures are ready, so the layers never appear blank
    Promise.all(pending).then(() => {
        startTime = performance.now();
        play();
    });
}
