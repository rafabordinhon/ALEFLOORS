// Floors: live floor materials, the floor mirror and the live flake texture.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE, Reflector, hero, OLD, FLAKES, mobile, pixelRatio, scene, geometries, textures, mesh, anisotropy, load } = ctx;
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
    // kitchen (tour-casa): polished concrete, light grey with a satin shine (flake moves to the pool deck)
    const concreteMat = floorMat(0.86, 0.32);
    concreteMat.clearcoat = 0.45;
    concreteMat.clearcoatRoughness = 0.22;
    concreteMat.color.set(0xeceae6);
    if (!OLD) load('assets/images/hero/polished.webp', [2.2, 2.2], (t) => { concreteMat.map = t; concreteMat.needsUpdate = true; });
    flat(9, 11.5, metallicMat, 0, 1.25);
    flat(9, 9, OLD ? flakeMat : concreteMat, -9, 0);

    // shared mirror under rooms A and B gives the glossy reflections
    const reflectorSize = () => {
        const s = (mobile ? 0.35 : 0.45) * ctx.pixelRatio;    // current value (the loop lowers it when slow)
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
    // outdoor deck (tour-casa): the same live flake (the color chips repaint it), opaque (no mirror
    // outside), with a polyaspartic gloss; its strips get world-scaled UVs in scenes/outdoor.js
    const deckFlakeMat = floorMat(1, 0.38);
    deckFlakeMat.clearcoat = 0.7;
    deckFlakeMat.clearcoatRoughness = 0.15;
    deckFlakeMat.map = flakeTexture;
    const onFlake = (event) => paintFlake(event.detail);
    window.addEventListener('ale:flake', onFlake);

    Object.assign(ctx, { flat, metallicMat, flakeMat, deckMat, concreteMat, deckFlakeMat, reflectorSize, mirror, onFlake });
}
