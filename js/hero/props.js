// Shared props: walls with doorways (old scene) and framed photos with their light wash.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE, OLD, H, DOOR_W, DOOR_H, scene, keep, mesh, box, canvasTexture, M } = ctx;
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

    Object.assign(ctx, { photos, framed });
}
