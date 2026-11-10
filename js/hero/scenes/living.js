// Living room: the floor sample (exploded view) with its spot, frames, the glass wall view and fireplace flames.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE, hero, OLD, MODELS, mobile, IMG, H, scene, materials, keep, mesh, box, load, canvasTexture, M, framed, floorPool, poolGeo } = ctx;
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

    // ---------- tour-casa, phase 2 ----------
    // the living room's floor: metallic epoxy, with the reveal curtain and the light sweep
    const livingFloor = OLD ? null : ctx.addFloorFx(ctx.metallicMat, { x0: -4.5, x1: 4.5 });
    if (livingFloor) livingFloor.reveal = 0;          // starts as raw concrete; the opening reveals it
    // sheer curtains at both sides of the glass wall, lit from behind by the sunset
    if (!OLD) {
        const sheerGeo = new THREE.PlaneGeometry(0.75, 3.0, 24, 1);
        const pos = sheerGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.05 * Math.sin(pos.getX(i) * 26));   // soft folds
        sheerGeo.computeVertexNormals();
        const sheer = new THREE.MeshStandardMaterial({
            color: 0xf3ece2, emissive: 0xffb27a, emissiveIntensity: 0.22, roughness: 1,
            transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
        });
        keep(sheerGeo, sheer);
        [1.85, 4.07].forEach((x) => {
            const s = new THREE.Mesh(sheerGeo, sheer);
            s.position.set(x, 1.62, -4.28);
            scene.add(s);
        });
    }
    const floorCards = Array.from(hero.querySelectorAll('.floor-card'));
    Object.assign(ctx, { sample, spot, sampleLayers, layerLabels, layerPoint, explode, sampleSpin, idle, flame, livingFloor, floorCards });
}
