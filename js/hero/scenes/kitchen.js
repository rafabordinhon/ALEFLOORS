// Kitchen (tour-casa, phase 3): open to the living room, x -13.5..-4.5, z -4.5..4.5. Cabinets, island,
// stools and pendants are baked in room-b.glb (Blender: scripts/house_kitchen.py). Live here: the
// polished concrete floor with its reveal and light sweep.
export default function build(ctx) {
    const { OLD, concreteMat } = ctx;
    if (OLD) return;
    const kitchenFloor = ctx.addFloorFx(concreteMat, { x0: -13.5, x1: -4.5 });
    kitchenFloor.reveal = 0;                 // raw concrete until the visitor reaches the kitchen
    Object.assign(ctx, { kitchenFloor });
}
