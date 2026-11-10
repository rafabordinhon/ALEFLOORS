// The hero scene modules, in build order (see js/hero-3d.js).
import core from './core.js';
import props from './props.js';
import materials from './materials.js';
import floorFx from './floorFx.js';
import lights from './lights.js';
import living from './scenes/living.js';
import assets from './assets.js';
import garage from './scenes/garage.js';
import kitchen from './scenes/kitchen.js';
import outdoor from './scenes/outdoor.js';
import cameraPath from './cameraPath.js';
import ui from './ui.js';

export default [core, props, materials, floorFx, lights, living, assets, garage, kitchen, outdoor, cameraPath, ui];
