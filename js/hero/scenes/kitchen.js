// Kitchen (tour-casa, phase 3): open to the living room, x -13.5..-4.5, z -4.5..4.5. Cabinets, island
// and stools are baked in room-b-furn.glb, walls and ceiling in room-b.glb (Blender:
// scripts/house_kitchen.py). Live here: the polished concrete floor with its reveal and light sweep,
// the sliding door and the three glass pendants over the island (so they reflect in the floor).
export default function build(ctx) {
    const { THREE, OLD, H, concreteMat, scene, keep, canvasTexture } = ctx;
    if (OLD) return;
    const kitchenFloor = ctx.addFloorFx(concreteMat, { x0: -13.5, x1: -4.5 });
    kitchenFloor.reveal = 0;                 // raw concrete until the visitor reaches the kitchen

    // sliding glass door to the yard (the 3.4 m opening at x -10.7..-7.3, z -4.5): a fixed panel on the
    // west half, a sliding one on the east half that glides behind it as the camera approaches.
    // ctx.setDoorOpen(0..1) is called by the loop.
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 0.35, metalness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ea, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.5 });
    const W = 1.76, Hd = 2.96;
    const bars = [[W, 0.06, 0, Hd / 2 - 0.03], [W, 0.06, 0, -Hd / 2 + 0.03], [0.06, Hd, -W / 2 + 0.03, 0], [0.06, Hd, W / 2 - 0.03, 0]];
    const barGeos = bars.map(([w, h]) => new THREE.BoxGeometry(w, h, 0.05));
    const glassGeo = new THREE.PlaneGeometry(W - 0.1, Hd - 0.1);
    barGeos.forEach((g) => keep(g));
    keep(glassGeo, [frameMat, glassMat]);
    const panel = (x, z) => {
        const g = new THREE.Group();
        bars.forEach(([, , bx, by], i) => { const m = new THREE.Mesh(barGeos[i], frameMat); m.position.set(bx, by, 0); g.add(m); });
        g.add(new THREE.Mesh(glassGeo, glassMat));
        g.position.set(x, Hd / 2 + 0.02, z);
        scene.add(g);
        return g;
    };
    panel(-9.86, -4.54);                                  // fixed (outer track)
    const sliding = panel(-8.14, -4.42);                  // sliding (inner track)
    const track = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.03, 0.22), frameMat);
    track.position.set(-9, 0.015, -4.48);
    scene.add(track);
    keep(track.geometry);
    ctx.setDoorOpen = (k) => { sliding.position.x = -8.14 - 1.62 * k; };
    // pendants over the island (x -9.35, z -0.55 / 0.3 / 1.15): smoked glass globe, warm bulb, brass
    // fittings. Live (not baked) so the glass shows the room and the bulbs light up the floor mirror.
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4e, roughness: 0.32, metalness: 1 });
    const cord = new THREE.MeshStandardMaterial({ color: 0x1c1916, roughness: 0.6 });
    const globeMat = new THREE.MeshStandardMaterial({ color: 0xc9a67c, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.3, depthWrite: false, envMapIntensity: 1.6 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffdfae, toneMapped: false });
    const glowTexture = canvasTexture(128, 128, (c) => {
        const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255, 214, 150, 1)');
        g.addColorStop(0.25, 'rgba(255, 190, 120, 0.35)');
        g.addColorStop(1, 'rgba(255, 170, 90, 0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 128, 128);
    });
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, toneMapped: false });
    const GLOBE_Y = 2.02;
    const pendantGeo = {
        canopy: new THREE.CylinderGeometry(0.055, 0.055, 0.02, 20),
        cord: new THREE.CylinderGeometry(0.004, 0.004, H - GLOBE_Y - 0.18, 6),
        cap: new THREE.CylinderGeometry(0.028, 0.04, 0.07, 20),
        globe: new THREE.SphereGeometry(0.15, 32, 20),
        bulb: new THREE.SphereGeometry(0.032, 16, 12),
    };
    Object.values(pendantGeo).forEach((g) => keep(g));
    keep(null, [brass, cord, globeMat, bulbMat, glowMat]);
    [-0.55, 0.3, 1.15].forEach((z) => {
        const g = new THREE.Group();
        g.position.set(-9.35, 0, z);
        const part = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); return m; };
        part(pendantGeo.canopy, brass, H - 0.01);
        part(pendantGeo.cord, cord, (H + GLOBE_Y + 0.18) / 2);
        part(pendantGeo.cap, brass, GLOBE_Y + 0.165);
        part(pendantGeo.bulb, bulbMat, GLOBE_Y + 0.02);
        part(pendantGeo.globe, globeMat, GLOBE_Y).renderOrder = 3;
        const glow = new THREE.Sprite(glowMat);
        glow.position.y = GLOBE_Y + 0.02;
        glow.scale.setScalar(0.75);
        glow.renderOrder = 4;
        g.add(glow);
        scene.add(g);
    });
    Object.assign(ctx, { kitchenFloor });
}
