// Contact shadows: a soft dark layer on the floors, right under the furniture, so nothing looks
// like it floats. Drawn ONCE after the rooms load (the furniture doesn't move): a camera at floor
// level looks up at the baked rooms, whatever is within 0.5 m of the floor is drawn (closer =
// darker), the image is blurred and handed to the floor shaders (floorFx.js), which darken the floor
// with it. No extra layer is drawn: a transparent plane over the floors cost ~10 fps on a UHD 630.
// Built in order by js/hero-3d.js; values shared between modules travel in ctx (see docs/PROJECT_MAP.md).
export default function build(ctx) {
    const { THREE, OLD, mobile, renderer, scene, materials, keep, setFloorContact, metallicMat, concreteMat, deckFlakeMat } = ctx;
    const BAKED_LAYER = 1;     // the baked room meshes (set in assets.js): what casts

    const blurMat = new THREE.ShaderMaterial({
        uniforms: { map: { value: null }, step: { value: new THREE.Vector2() } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: [
            'uniform sampler2D map; uniform vec2 step; varying vec2 vUv;',
            'void main() {',
            '  float a = texture2D(map, vUv).r * 0.227;',
            '  a += (texture2D(map, vUv + step * 1.385).r + texture2D(map, vUv - step * 1.385).r) * 0.316;',
            '  a += (texture2D(map, vUv + step * 3.231).r + texture2D(map, vUv - step * 3.231).r) * 0.0703;',
            '  gl_FragColor = vec4(a, a, a, 1.0);',
            '}',
        ].join('\n'),
        depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
    quad.frustumCulled = false;
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const depthMat = new THREE.MeshDepthMaterial();     // near the floor = white, 0.5 m up = black
    depthMat.side = THREE.DoubleSide;
    keep(quad.geometry, [blurMat, depthMat]);

    // region: { x0, x1, z0, z1 } in world metres; floors: the floor materials inside it
    function addRegion({ x0, x1, z0, z1 }, floors, amount) {
        const w = x1 - x0;
        const d = z1 - z0;
        const px = (mobile ? 28 : 56);                              // texels per metre
        const tw = Math.round(w * px);
        const th = Math.round(d * px);
        const opts = { depthBuffer: true, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
        const a = new THREE.WebGLRenderTarget(tw, th, opts);
        const b = new THREE.WebGLRenderTarget(tw, th, opts);
        const cam = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 0.012, 0.5);
        cam.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2);
        cam.up.set(0, 0, 1);                                        // image u = world x, v = world z
        cam.lookAt((x0 + x1) / 2, 1, (z0 + z1) / 2);
        cam.layers.set(BAKED_LAYER);

        const background = scene.background;
        const clearColor = renderer.getClearColor(new THREE.Color());
        const clearAlpha = renderer.getClearAlpha();
        scene.background = null;
        scene.overrideMaterial = depthMat;
        renderer.setClearColor(0x000000, 1);
        renderer.setRenderTarget(a);
        renderer.clear();
        renderer.render(scene, cam);
        scene.overrideMaterial = null;
        scene.background = background;
        // blur: two rounds, wide then narrow (a soft spread plus a darker core right at the contact)
        [[3.2, 0], [0, 3.2], [1.4, 0], [0, 1.4]].forEach(([sx, sy], i) => {
            const [from, to] = i % 2 ? [b, a] : [a, b];
            blurMat.uniforms.map.value = from.texture;
            blurMat.uniforms.step.value.set(sx / tw, sy / th);
            renderer.setRenderTarget(to);
            renderer.render(quad, quadCam);
        });
        renderer.setRenderTarget(null);
        renderer.setClearColor(clearColor, clearAlpha);
        b.dispose();

        materials.push(a);                                          // a render target: only needs dispose(), like a material
        floors.forEach((m) => setFloorContact(m, a.texture, { x0, z0, w, d }, amount));
    }

    // called from hero-3d.js once the rooms are in the scene, before the shaders compile
    function buildContactShadows() {
        if (OLD) return;
        addRegion({ x0: -13.5, x1: 4.5, z0: -4.5, z1: 7 }, [metallicMat, concreteMat], 0.8);                                   // living room + kitchen
        addRegion({ x0: -15, x1: -1.5, z0: -17, z1: -4.5 }, [deckFlakeMat], 0.6);                 // yard
    }

    Object.assign(ctx, { buildContactShadows, BAKED_LAYER });
}
