// Assets: loads the baked rooms (gzipped GLB + atlas + floor light map) with a progress bar.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE, GLTFLoader, hero, OLD, MODELS, FLOOR_LIGHT_GAIN, mobile, scene, geometries, materials, textures, anisotropy, metallicMat, flakeMat, deckMat } = ctx;
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

    Object.assign(ctx, { bakedMats, loadRooms, hideLoader });
}
