// Palm trees of the pool area, live (they used to be baked into the yard atlas, where every leaf
// face got a few flat texels and looked pixelated). Trunks: curved tubes with a bark texture
// (Poly Haven palm_tree_bark, CC0). Fronds: arched cards with a frond drawn on a canvas (colour +
// alpha), cut out with alphaToCoverage so the edges stay smooth, swaying a little in the wind.
// Near palms stand where scripts/house_outdoor.py casts their shadows; far ones fade into the haze.
// Everything is two meshes (trunks, fronds). Light is painted into vertex colours (dusk sun in the
// west), like the baked rooms. ctx.palmWind.value is the time, set by the loop in js/hero-3d.js.
export default function build(ctx) {
    const { THREE, OLD, MODELS, mobile, scene, keep, load, canvasTexture, anisotropy } = ctx;
    const palmWind = { value: 0 };
    Object.assign(ctx, { palmWind });
    if (OLD) return;

    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const range = (a, b) => a + (b - a) * rnd();

    // ---------- the frond, drawn once: colour (opaque, so the mipmaps have no dark fringe) + alpha ----------
    const TW = 256, TH = 1024;
    const leaflets = [];
    for (let i = 0; i < 64; i++) {
        const s = 0.06 + 0.93 * (i / 63);                              // position along the stem, 0 = base
        const env = Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.04)), 0.55);
        [-1, 1].forEach((side) => {
            leaflets.push({ s, side, len: (0.42 + 0.5 * env) * (0.9 + 0.2 * rnd()), lean: 0.5 + 0.45 * s + 0.1 * rnd(), w: 5.5 + 3 * rnd(), tone: rnd() });
        });
    }
    const drawFrond = (c, colour) => {
        c.fillStyle = colour ? '#3f5c2a' : '#000';
        c.fillRect(0, 0, TW, TH);
        leaflets.forEach(({ s, side, len, lean, w, tone }) => {
            const x0 = TW / 2, y0 = TH * (1 - s);
            const L = len * TW * 0.5;
            const x1 = x0 + side * L * Math.cos(lean * 0.9), y1 = y0 - L * Math.sin(lean * 0.9);
            const nx = (y1 - y0) / L, ny = -(x1 - x0) / L;
            if (colour) {
                const g = c.createLinearGradient(x0, y0, x1, y1);
                g.addColorStop(0, `rgb(${52 + tone * 30 | 0},${84 + tone * 34 | 0},${36 + tone * 14 | 0})`);
                g.addColorStop(1, `rgb(${86 + tone * 40 | 0},${122 + tone * 36 | 0},${52 + tone * 16 | 0})`);
                c.fillStyle = g;
            } else c.fillStyle = '#fff';
            c.beginPath();
            c.moveTo(x0 + nx * w * 0.5, y0 + ny * w * 0.5);
            c.quadraticCurveTo((x0 + x1) / 2 + nx * w * 0.7, (y0 + y1) / 2 + ny * w * 0.7 + 6, x1, y1 + 8);
            c.quadraticCurveTo((x0 + x1) / 2 - nx * w * 0.7, (y0 + y1) / 2 - ny * w * 0.7 + 6, x0 - nx * w * 0.5, y0 - ny * w * 0.5);
            c.fill();
        });
        c.strokeStyle = colour ? '#93a05a' : '#fff';                    // the stem
        c.lineWidth = 7;
        c.beginPath(); c.moveTo(TW / 2, TH); c.lineTo(TW / 2, TH * 0.02); c.stroke();
    };
    const frondMap = canvasTexture(TW, TH, (c) => drawFrond(c, true));
    const frondAlpha = canvasTexture(TW, TH, (c) => drawFrond(c, false));
    frondAlpha.colorSpace = THREE.NoColorSpace;
    [frondMap, frondAlpha].forEach((t) => { t.anisotropy = anisotropy; });

    // ---------- geometry ----------
    const SUN = new THREE.Vector3(-0.93, 0.28, -0.24).normalize();     // low in the west, as in the bake
    const WARM = new THREE.Color(1.0, 0.72, 0.5), SKY = new THREE.Color(0.5, 0.52, 0.74), HAZE = new THREE.Color(0.86, 0.6, 0.5);
    const shade = (normal, haze, out) => {
        const d = normal.dot(SUN);
        const lit = Math.max(0, d) * 0.9 + Math.max(0, -d) * 0.3;       // sun on the face + a little through the leaf
        out.copy(SKY).multiplyScalar(0.85).add(WARM.clone().multiplyScalar(lit));
        return out.lerp(HAZE, haze);
    };
    const F = { pos: [], uv: [], col: [], sway: [], idx: [] };
    const Tk = { pos: [], uv: [], col: [], idx: [] };
    const v = new THREE.Vector3(), side = new THREE.Vector3(), tan = new THREE.Vector3(), nrm = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();

    function frond(top, azimuth, elevation, length, haze, phase) {
        const N = 9;
        const dir = new THREE.Vector3(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation));
        const droop = 0.42 + 0.3 * (1 - Math.sin(Math.max(0, elevation)));
        const base = F.pos.length / 3;
        for (let k = 0; k <= N; k++) {
            const s = k / N;
            v.copy(top).addScaledVector(dir, length * s);
            v.y -= droop * length * s * s;
            tan.copy(dir).multiplyScalar(length); tan.y -= 2 * droop * length * s; tan.normalize();
            side.crossVectors(tan, up).normalize();
            nrm.crossVectors(side, tan).normalize();
            const w = 0.17 * length * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, s * 1.04)));
            const sway = s * s * length * 0.035;
            [[-1, 0.3], [0, 0], [1, 0.3]].forEach(([e, sag], j) => {
                F.pos.push(v.x + side.x * w * e, v.y + side.y * w * e - w * sag, v.z + side.z * w * e);
                F.uv.push(j / 2, s);
                shade(nrm, haze, c).multiplyScalar(0.72 + 0.28 * s);    // darker inside the crown
                F.col.push(c.r, c.g, c.b);
                F.sway.push(sway, phase);
            });
            if (k < N) {
                const a = base + k * 3;
                F.idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
            }
        }
    }

    function palm(x, z, h, lean, haze, fronds) {
        const SEG = 12, RAD = 8;
        const base = Tk.pos.length / 3;
        const at = (t, out) => out.set(x + lean[0] * t * t, h * t, z + lean[1] * t * t);
        for (let k = 0; k <= SEG; k++) {
            const t = k / SEG;
            at(t, v);
            const r = (0.17 - 0.07 * t) + 0.09 * Math.pow(1 - t, 6);    // flares at the foot
            for (let j = 0; j <= RAD; j++) {
                const a = (j / RAD) * Math.PI * 2;
                nrm.set(Math.cos(a), 0, Math.sin(a));
                Tk.pos.push(v.x + nrm.x * r, v.y, v.z + nrm.z * r);
                Tk.uv.push(j / RAD * 2, t * h / 1.1);
                shade(nrm, haze, c).multiplyScalar(0.95 - 0.3 * t * t);  // shaded under the crown
                Tk.col.push(c.r, c.g, c.b);
            }
            if (k < SEG) {
                for (let j = 0; j < RAD; j++) {
                    const a = base + k * (RAD + 1) + j, b = a + RAD + 1;
                    Tk.idx.push(a, b, a + 1, a + 1, b, b + 1);
                }
            }
        }
        const top = at(1, new THREE.Vector3());
        top.y -= 0.05;
        for (let i = 0; i < fronds; i++) {
            const tier = i / fronds;                                    // first the upright ones, then lower and lower
            const elevation = 1.15 - 1.75 * tier + range(-0.12, 0.12);
            frond(top, i * 2.39996 + range(-0.2, 0.2), elevation, range(2.3, 3.1) * (h / 5.6 * 0.35 + 0.65), haze, range(0, 6.28));
        }
    }

    const near = [[-14.2, -14.8, 5.6, [0.5, 0.3]], [-14.0, -6.0, 4.8, [0.3, -0.2]], [-3.0, -15.8, 6.2, [-0.4, 0.2]], [-12.8, -16.2, 4.2, [0.2, 0.4]],
        [1.6, -9.5, 5.8, [0.3, -0.3]], [4.4, -12.5, 6.4, [-0.5, 0.2]], [6.8, -8.2, 5.0, [0.2, 0.3]], [2.8, -17.0, 6.8, [0.3, 0.1]]];
    const far = [[-20, -21, 7.6], [-9, -25, 8.2], [-16.5, -29, 9.4], [-0.5, -24, 7.2], [-26, -13, 8.4], [-23, -4, 7.0], [9, -21, 8.8], [-5, -33, 9.6], [13, -15, 7.8], [-32, -24, 9.2], [-11, -38, 10], [18, -27, 9]];
    near.forEach(([x, z, h, lean]) => palm(x, z, h, lean, 0, mobile ? 18 : 24));
    far.forEach(([x, z, h]) => {
        const d = Math.hypot(x + 8, z + 10);
        palm(x, z, h, [range(-0.6, 0.6), range(-0.6, 0.6)], Math.min(0.62, 0.22 + d / 60), mobile ? 12 : 16);
    });

    const geo = (d, extra) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(d.col, 3));
        if (extra) g.setAttribute('aSway', new THREE.Float32BufferAttribute(d.sway, 2));
        g.setIndex(d.idx);
        return g;
    };
    const trunkMat = new THREE.MeshBasicMaterial({ color: 0xc9a98c, vertexColors: true, toneMapped: false });
    load(MODELS + 'palm-bark.webp', [1, 1], (t) => { trunkMat.map = t; trunkMat.needsUpdate = true; });
    const frondMat = new THREE.MeshBasicMaterial({
        map: frondMap, alphaMap: frondAlpha, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, vertexColors: true, toneMapped: false,
    });
    // wind: each frond bends a little more towards its tip, on its own phase
    frondMat.onBeforeCompile = (shader) => {
        shader.uniforms.uWind = palmWind;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 aSway; uniform float uWind;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed += vec3(0.6 * sin(uWind * 0.9 + aSway.y), sin(uWind * 1.3 + aSway.y * 1.7), 0.6 * cos(uWind * 1.1 + aSway.y)) * aSway.x;`);
    };
    frondMat.customProgramCacheKey = () => 'palmWind';
    const trunks = new THREE.Mesh(geo(Tk, false), trunkMat);
    const fronds = new THREE.Mesh(geo(F, true), frondMat);
    trunks.name = 'trunks'; fronds.name = 'fronds';
    scene.add(trunks, fronds);
    keep(trunks.geometry, trunkMat);
    keep(fronds.geometry, frondMat);
}
