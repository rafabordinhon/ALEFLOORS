// Camera path: position and look-at curves through the rooms and the scroll-to-curve mapping.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE } = ctx;
    // ---------- the camera's curve through the rooms ----------
    // 7 points; rooms are viewed at points 0, 3 and 6. A second curve gives where it looks.
    // tour-casa: living room -> open kitchen (around the island) -> the sliding glass door -> pool deck.
    // Clearances checked: 1.25 m from the stools, 1 m from the island's corner, 1.5 m from the door jambs.
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const pathPos = new THREE.CatmullRomCurve3(ctx.OLD ? [
        V(2.2, 1.55, 5.8), V(0.8, 1.55, 2.2), V(-4.5, 1.55, 0.4),
        V(-6.4, 1.55, 2.4), V(-9.4, 1.55, -1.6), V(-9.2, 1.55, -5.4), V(-10.9, 1.6, -6.2),
    ] : [
        V(2.2, 1.55, 5.8), V(0.2, 1.55, 3.0), V(-2.8, 1.55, 3.4),
        V(-5.4, 1.55, 2.8), V(-8.3, 1.55, -2.0), V(-9.0, 1.6, -5.6), V(-10.6, 1.75, -6.3),
    ], false, 'centripetal');
    const pathLook = new THREE.CatmullRomCurve3(ctx.OLD ? [
        V(-0.9, 1.0, -3.4), V(-4.5, 1.2, -0.4), V(-10, 1.2, 0),
        V(-12.4, 1.1, -2.2), V(-9, 1.2, -8), V(-8.2, 1.0, -11), V(-7.4, 0.5, -11.8),
    ] : [
        V(-0.9, 1.0, -3.4), V(-4.0, 1.2, -1.2), V(-9.5, 1.15, -0.3),
        V(-12.2, 1.05, -0.8), V(-9.0, 1.35, -8.0), V(-8.6, 0.9, -11.5), V(-7.6, 0.5, -12.0),
    ], false, 'centripetal');
    // progress -> place on the curve: hold at each room, glide in between
    const smooth = (t) => t * t * (3 - 2 * t);
    const curveAt = (p) => {
        if (p <= 0.1) return 0;
        if (p < 0.42) return 0.5 * smooth((p - 0.1) / 0.32);
        if (p <= 0.58) return 0.5;
        if (p < 0.9) return 0.5 + 0.5 * smooth((p - 0.58) / 0.32);
        return 1;
    };
    const roomAt = (p) => (p >= 0.68 ? 2 : p >= 0.24 ? 1 : 0);   // same thresholds as js/home.js

    Object.assign(ctx, { V, pathPos, pathLook, smooth, curveAt, roomAt });
}
