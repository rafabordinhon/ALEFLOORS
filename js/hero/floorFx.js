// Floor effects shared by every room (tour-casa): a reveal curtain from raw concrete to the finished
// floor (with a warm edge), and a band of light that sweeps across the floor during its "floor moment".
// ctx.addFloorFx(material, { x0, x1 }) patches a floor material and returns its controls:
//   fx.reveal (0 = raw concrete, 1 = finished)   fx.sweep (0..1 across the room)   fx.sweepAmt (0..1)
// The loop (js/hero-3d.js) sets them each frame; ctx.updateFloorFx() pushes them to the shaders.
export default function build(ctx) {
    const { THREE, load } = ctx;
    const raw = { value: null };
    load('assets/images/hero/concrete.webp', [1, 1], (t) => { raw.value = t; });
    const list = [];
    // contact shadows (see contactShadows.js): a blurred image of what stands on the floor, in world xz
    const noContact = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    noContact.needsUpdate = true;
    ctx.textures.push(noContact);

    ctx.addFloorFx = (material, { x0, x1 }) => {
        const fx = {
            reveal: 1, sweep: 0, sweepAmt: 0, x0, x1,
            u: { uRevealX: { value: x1 + 2 }, uSweepX: { value: x0 - 2 }, uSweepAmt: { value: 0 }, uEdge: { value: 0 }, uRaw: raw,
                uContact: { value: noContact }, uContactRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uContactAmt: { value: 0 } },
            material,
        };
        material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, fx.u);
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nvarying vec3 vFxPos;')
                .replace('#include <project_vertex>', '#include <project_vertex>\nvFxPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', `#include <common>
varying vec3 vFxPos;
uniform float uRevealX; uniform float uSweepX; uniform float uSweepAmt; uniform float uEdge;
uniform sampler2D uRaw;
uniform sampler2D uContact; uniform vec4 uContactRect; uniform float uContactAmt;
float fxFin;`)
                // finished floor on the left of the line, raw concrete (matte, opaque: no mirror) on the right
                .replace('#include <map_fragment>', `#include <map_fragment>
fxFin = 1.0 - smoothstep(uRevealX - 0.25, uRevealX + 0.25, vFxPos.x);
vec3 fxRaw = texture2D(uRaw, vFxPos.xz * 0.45).rgb * vec3(0.95, 0.93, 0.9);
diffuseColor.rgb = mix(fxRaw, diffuseColor.rgb, fxFin);
diffuseColor.a = mix(1.0, diffuseColor.a, fxFin);`)
                .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(0.9, roughnessFactor, fxFin);`)
                // the sweeping band and the curtain's warm edge
                .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float fxBand = exp(-pow((vFxPos.x - uSweepX) / 0.5, 2.0));
float fxEdgeLine = exp(-pow((vFxPos.x - uRevealX) / 0.12, 2.0));
totalEmissiveRadiance += vec3(1.0, 0.86, 0.66) * (fxBand * uSweepAmt * 0.35 * fxFin + fxEdgeLine * uEdge * 0.8);`)
                // contact shadow: darkens the floor and hides the mirror under it
                .replace('#include <opaque_fragment>', `#include <opaque_fragment>
float fxContact = texture2D(uContact, (vFxPos.xz - uContactRect.xy) * uContactRect.zw).r * uContactAmt;
gl_FragColor.rgb *= 1.0 - fxContact;
gl_FragColor.a = mix(gl_FragColor.a, 1.0, fxContact);`);
        };
        material.customProgramCacheKey = () => 'floorFx';
        material.needsUpdate = true;
        list.push(fx);
        return fx;
    };

    // texture: the blurred image; rect: { x0, z0, w, d } it covers in world metres; amount: 0..1
    ctx.setFloorContact = (material, texture, { x0, z0, w, d }, amount) => {
        list.filter((fx) => fx.material === material).forEach((fx) => {
            fx.u.uContact.value = texture;
            fx.u.uContactRect.value.set(x0, z0, 1 / w, 1 / d);
            fx.u.uContactAmt.value = amount;
        });
    };

    ctx.updateFloorFx = () => {
        list.forEach((fx) => {
            const span = fx.x1 - fx.x0 + 3;
            fx.u.uRevealX.value = fx.x0 - 1.5 + span * fx.reveal;
            fx.u.uEdge.value = Math.sin(Math.PI * Math.min(1, Math.max(0, fx.reveal)));
            fx.u.uSweepX.value = fx.x0 - 1 + (fx.x1 - fx.x0 + 2) * fx.sweep;
            fx.u.uSweepAmt.value = fx.sweepAmt;
        });
    };
}
