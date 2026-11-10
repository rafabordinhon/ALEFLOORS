// HTML pinned to the scene: hotspots and the text areas they must not cover.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE, hero, V } = ctx;
    // ---------- hotspots (HTML), pinned to points on each floor ----------
    const spotEls = Array.from(hero.querySelectorAll('.hotspot'));
    const anchors = [V(1.1, 0.05, -1.7), V(-10.2, 0.05, -1.0), V(-10.6, 0.08, -8.4)];
    const projected = new THREE.Vector3();
    // each room's text block (stage coordinates, padded): a hotspot that would land on the text is
    // hidden, so it never covers copy or steals a tap from a button. Measured on resize only.
    const copyEls = [hero.querySelector('.hero-copy'), ...hero.querySelectorAll('.room-caption')];
    let copyRects = [];
    const measureCopy = () => {
        const stage = hero.querySelector('.hero-stage').getBoundingClientRect();
        copyRects = copyEls.map((el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { l: r.left - stage.left, r: r.right - stage.left, t: r.top - stage.top, b: r.bottom - stage.top };
        });
    };
    // hysteresis: hides within 24 px of the text, shows again only beyond 48 px (no flicker at the edge)
    const overCopy = (i, x, y, wasOn) => {
        const c = copyRects[i];
        const pad = wasOn ? 24 : 48;
        return !!c && x > c.l - pad && x < c.r + pad && y > c.t - pad && y < c.b + pad;
    };

    Object.assign(ctx, { spotEls, anchors, projected, measureCopy, overCopy });
}
