// One-off refactor (tour-casa, phase 1): splits start() in js/hero-3d.js into modules under js/hero/.
// Each module is `export default function build(ctx)`: it takes what it needs from ctx and puts back
// what later modules use. Run: node tools/split-hero.mjs [--write]
import fs from 'node:fs';

const SRC = 'js/hero-3d.js';
const lines = fs.readFileSync(SRC, 'utf8').split('\n');
const L = (a, b) => lines.slice(a - 1, b);            // 1-based, inclusive

// [name, path, description, ranges]; order = build order (same as the original code order)
const CHUNKS = [
    ['core', 'js/hero/core.js', 'Renderer, scene, camera, environment, bookkeeping for dispose(), mesh helpers and base materials.', [[71, 152]]],
    ['props', 'js/hero/props.js', 'Shared props: walls with doorways (old scene) and framed photos with their light wash.', [[153, 203], [352, 384]]],
    ['materials', 'js/hero/materials.js', 'Floors: live floor materials, the floor mirror and the live flake texture.', [[204, 278]]],
    ['lights', 'js/hero/lights.js', 'Lights: fill, downlights with beams and floor pools, dust in the air.', [[279, 351]]],
    ['living', 'js/hero/scenes/living.js', 'Living room: the floor sample (exploded view) with its spot, frames, the glass wall view and fireplace flames.', [[385, 499], [733, 764]]],
    ['assets', 'js/hero/assets.js', 'Assets: loads the baked rooms (gzipped GLB + atlas + floor light map) with a progress bar.', [[500, 581]]],
    ['garage', 'js/hero/scenes/garage.js', 'Garage (current route; the house tour moves it out as an optional scene).', [[582, 597]]],
    ['outdoor', 'js/hero/scenes/outdoor.js', 'Pool area: deck, pool, water, caustics, waterline and the backlit logo.', [[598, 732], [765, 795]]],
    ['cameraPath', 'js/hero/cameraPath.js', 'Camera path: position and look-at curves through the rooms and the scroll-to-curve mapping.', [[796, 817]]],
    ['ui', 'js/hero/ui.js', 'HTML pinned to the scene: hotspots and the text areas they must not cover.', [[818, 840]]],
];
const MAIN = [841, 1149];
const MUTABLE = ['pixelRatio', 'explode', 'sampleSpin', 'idle'];   // declared in a module, changed in main
const GLOBALS = ['THREE', 'RoomEnvironment', 'Reflector', 'GLTFLoader', 'canvas', 'hero', 'params', 'SHOT', 'OLD',
    'FORCED_TIER', 'MODELS', 'FLOOR_LIGHT_GAIN', 'FLAKES'];

const text = (ranges) => ranges.flatMap(([a, b]) => L(a, b));
const declared = (ls) => {
    const out = new Map();                            // name -> 'const' | 'let' | 'function'
    for (const l of ls) {
        let m;
        if ((m = l.match(/^ {4}(const|let)\s+(\w+)/))) out.set(m[2], m[1]);
        if ((m = l.match(/^ {4}(?:const|let)\s+\[([^\]]+)\]/))) m[1].split(',').forEach((n) => out.set(n.trim(), 'const'));
        if ((m = l.match(/^ {4}function\s+(\w+)/))) out.set(m[1], 'function');
    }
    return out;
};
const strip = (ls) => ls.join('\n').replace(/\/\/.*$/gm, '').replace(/'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, "''");
const uses = (src, name) => new RegExp(`(?<![.\\w$])${name}(?![\\w$])(?!\\s*:(?!:))`).test(src);
const assigns = (src, name) => new RegExp(`(?<![.\\w$])${name}\\s*(=(?!=)|\\+=|-=|\\+\\+|--)`).test(src);

const parts = CHUNKS.map(([name, path, desc, ranges]) => ({ name, path, desc, body: text(ranges) }))
    .concat([{ name: 'main', body: L(...MAIN) }]);
parts.forEach((p) => { p.decl = declared(p.body); p.src = strip(p.body); });

const report = [];
parts.forEach((p, i) => {
    const earlier = new Set(GLOBALS);
    parts.slice(0, i).forEach((q) => q.decl.forEach((_, n) => earlier.add(n)));
    const later = new Set();
    parts.slice(i + 1).forEach((q) => q.decl.forEach((_, n) => later.add(n)));
    p.imports = [...earlier].filter((n) => !p.decl.has(n) && uses(p.src, n));
    p.exports = [...p.decl.keys()].filter((n) => parts.some((q, j) => j !== i && uses(q.src, n) && !q.decl.has(n)));
    const fwd = [...later].filter((n) => !p.decl.has(n) && uses(p.src, n) && !earlier.has(n));
    if (fwd.length) report.push(`${p.name}: usa nomes declarados DEPOIS: ${fwd.join(', ')}`);
    p.decl.forEach((kind, n) => {
        if (kind !== 'let') return;
        const others = parts.filter((q, j) => j !== i && !q.decl.has(n) && assigns(q.src, n)).map((q) => q.name);
        if (others.length) report.push(`${p.name}: let ${n} é alterado em ${others.join(', ')}`);
    });
});

for (const p of parts) console.log(`${p.name.padEnd(10)} in: ${p.imports.join(', ')}\n${''.padEnd(10)} out: ${(p.exports || []).join(', ')}`);
console.log('\nATENÇÃO:\n' + (report.join('\n') || '(nada)'));

if (process.argv.includes('--write')) {
    const header = (p) => `// ${p.desc}\n// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).\n`;
    const destr = (names) => (names.length ? `    const { ${names.join(', ')} } = ctx;\n` : '');
    for (const p of parts.filter((q) => q.path)) {
        fs.mkdirSync(p.path.replace(/\/[^/]+$/, ''), { recursive: true });
        const out = header(p) + 'export default function build(ctx) {\n' + destr(p.imports) + p.body.join('\n') + '\n'
            + (p.exports.length ? `    Object.assign(ctx, { ${p.exports.join(', ')} });\n` : '') + '}\n';
        fs.writeFileSync(p.path, out);
    }
    fs.writeFileSync('js/hero/index.js', '// The hero scene modules, in build order (see js/hero-3d.js).\n'
        + CHUNKS.map(([n, path]) => `import ${n} from './${path.replace('js/hero/', '')}';`).join('\n')
        + `\n\nexport default [${CHUNKS.map(([n]) => n).join(', ')}];\n`);
    const main = parts.at(-1);
    const newStart = [
        'function start(THREE, RoomEnvironment, Reflector, GLTFLoader, modules) {',
        `    const ctx = { ${GLOBALS.join(', ')} };`,
        '    modules.forEach((build) => build(ctx));',
        destr(main.imports.filter((n) => !MUTABLE.includes(n))).replace(/\n$/, ''),
        `    let { ${MUTABLE.join(', ')} } = ctx;      // changed by the loop below (pixelRatio is mirrored back to ctx)`,
        ...main.body,
        '}',
    ];
    const out = [...L(1, 69), ...newStart, ...lines.slice(1150)].join('\n');
    fs.writeFileSync(SRC, out);
    console.log('\nescrito.');
}
