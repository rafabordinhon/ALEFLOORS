// Pool area: deck, pool, water, caustics, waterline and the backlit logo.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE, OLD, IMG, scene, materials, textures, mesh, box, load, canvasTexture, M, framed, flat, deckMat, floorPool, poolGeo } = ctx;
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

    Object.assign(ctx, { causticLayers, rippleNormal });
}
