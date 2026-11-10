// Renderer, scene, camera, environment, bookkeeping for dispose(), mesh helpers and base materials.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE, RoomEnvironment, canvas, ASSET_V } = ctx;
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
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);   // far enough for the outdoor sky dome
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
        const t = loader.load(url + ASSET_V, () => { if (onReady) onReady(t); resolve(t); }, undefined, () => resolve(t));
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

    Object.assign(ctx, { mobile, IMG, H, DOOR_W, DOOR_H, renderer, pixelRatio, scene, camera, pmrem, roomEnv, envMap, geometries, materials, textures, keep, mesh, box, anisotropy, load, canvasTexture, M });
}
