// Lights: fill, downlights with beams and floor pools, dust in the air.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE, OLD, mobile, H, scene, keep, canvasTexture, M } = ctx;
    // ---------- light: soft fill, one warm light per room, downlights with beams ----------
    // v2: the rooms' light is baked; the hemisphere only lifts the live floors and objects a little
    const hemi = new THREE.HemisphereLight(0xffe7cc, 0x2a2018, OLD ? 0.45 : 0.3);   // the loop shifts it to dusk outdoors
    scene.add(hemi);
    if (OLD) [[0, 0.5], [-9, 0], [-9, -9]].forEach(([x, z]) => {
        const light = new THREE.PointLight(0xffcf96, 28, 11, 2);
        light.position.set(x, H - 1.1, z);
        scene.add(light);
    });
    const floorPool = new THREE.MeshBasicMaterial({
        map: canvasTexture(128, 128, (c) => {
            const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, 'rgba(255,210,150,0.9)');
            g.addColorStop(1, 'rgba(255,200,140,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, 128, 128);
        }),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.2,
    });
    // beam: a faint vertical gradient on an open cone = light catching dust in the air
    const beamMat = new THREE.MeshBasicMaterial({
        map: canvasTexture(4, 128, (c) => {
            const g = c.createLinearGradient(0, 0, 0, 128);
            g.addColorStop(0, 'rgba(255,214,160,0.55)');
            g.addColorStop(1, 'rgba(255,214,160,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, 4, 128);
        }),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.09,
    });
    const discGeo = new THREE.CircleGeometry(0.09, 20);
    const poolGeo = new THREE.PlaneGeometry(2.2, 2.2);
    const beamGeo = new THREE.ConeGeometry(0.85, H - 0.05, 20, 1, true);
    keep(discGeo, floorPool);
    keep(poolGeo, beamMat);
    keep(beamGeo);
    // baked = the fitting and its light on the floor are already in room-a.glb; only the beam is added
    const downlight = (x, z, beam = true, baked = false) => {
        if (!baked) {
            const d = new THREE.Mesh(discGeo, M.led);
            d.rotation.x = Math.PI / 2;
            d.position.set(x, H - 0.005, z);
            scene.add(d);
            const p = new THREE.Mesh(poolGeo, floorPool);
            p.rotation.x = -Math.PI / 2;
            p.position.set(x, 0.006, z);
            scene.add(p);
        }
        if (beam) {
            const b = new THREE.Mesh(beamGeo, beamMat);
            b.position.set(x, (H - 0.05) / 2, z);
            scene.add(b);
        }
    };
    [[-2.6, -2.2], [2.6, -2.2], [-2.6, 2.8], [2.6, 2.8]].forEach(([x, z]) => downlight(x, z, true, !OLD));
    // garage (v2: LED battens baked in room-b.glb) and pool area (spots baked in room-c.glb)
    if (OLD) [[-11.4, -2.2], [-6.6, -2.2], [-11.4, 2.4], [-6.6, 2.4]].forEach(([x, z]) => downlight(x, z));
    if (OLD) [[-11.6, -6.6], [-6.4, -6.6], [-11.6, -12], [-6.4, -12]].forEach(([x, z]) => downlight(x, z, false));

    // dust drifting in the air (very light)
    const DUST = mobile ? 160 : 320;
    const dustPos = new Float32Array(DUST * 3);
    const dustBox = [[-4.3, 4.3, -4.3, 6], [-13.3, -4.7, -4.3, 4.3], [-13.3, -4.7, -13.3, -4.7]];
    for (let i = 0; i < DUST; i++) {
        const [x0, x1, z0, z1] = dustBox[i % 3];
        dustPos.set([x0 + Math.random() * (x1 - x0), Math.random() * H, z0 + Math.random() * (z1 - z0)], i * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0xffe2b8, size: 0.018, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    keep(dustGeo, dustMat);
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    Object.assign(ctx, { floorPool, poolGeo, dust, hemi });
}
