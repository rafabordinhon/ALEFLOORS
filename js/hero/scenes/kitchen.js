// Kitchen (tour-casa, phase 3): open to the living room, x -13.5..-4.5, z -4.5..4.5. Cabinets, island,
// stools and pendants are baked in room-b.glb (Blender: scripts/house_kitchen.py). Live here: the
// polished concrete floor with its reveal and light sweep.
export default function build(ctx) {
    const { THREE, OLD, concreteMat, scene, keep } = ctx;
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
    Object.assign(ctx, { kitchenFloor });
}
