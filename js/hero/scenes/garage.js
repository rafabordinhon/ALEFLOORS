// Garage (current route; the house tour moves it out as an optional scene).
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { OLD, IMG, box, M, framed, flat } = ctx;
    // ---------- room B: garage ----------
    // v2: door, cabinets, shelves, workbench, covered car, tires and bike are in room-b.glb
    if (OLD) {
        // sectional garage door (west wall) with a light strip above, cabinets, parking stripes
        box(0.08, 2.7, 4.6, M.metal, -13.36, 1.35, 0);
        for (let i = 1; i < 5; i++) box(0.1, 0.025, 4.6, M.gap, -13.3, i * 0.54, 0);
        box(0.06, 0.03, 4.4, M.led, -13.32, 2.9, 0);
        for (let i = 0; i < 3; i++) {
            box(0.8, 2.0, 0.5, M.graphite, -12.95 + i * 0.83, 1.0, -4.15);
            box(0.02, 0.5, 0.02, M.metal, -12.62 + i * 0.83, 1.15, -3.89);
        }
        [-11.2, -7].forEach((x) => flat(0.12, 4.6, M.stripe, x, 0.6, 0.007));
    }
    framed(IMG + '2-service/homeServices/garage.webp', 'x', -4.5, -6.05, 1, 1.5, 1.14, OLD);
    framed(IMG + '1-home/generalServices/epoxyGarageFloor.webp', 'x', 4.5, -9, -1, 1.9, 1.42, OLD);

}
