import seat from '@/content/scene/bounds-seat.json';
import type { Pt } from '@/content/scene/screenAffine';

type Uv = Record<'u0' | 'v0' | 'u1' | 'v1', number>;

/** The window's patch of sky on the still: its corners (TL, TR, BR, BL), master fractions. */
export const SKY_QUAD = (seat as unknown as { quads: { sky: Pt[] } }).quads.sky;
/** Its place on the live desk's sky plane, in Blender's UVs (v up). */
export const SKY_UV = (seat as unknown as { skyUv: Uv }).skyUv;
/** The live sky plane's size, metres (scripts/scene/sky_geo.py). */
const PLANE = [6, 5] as const;
/** The patch's shape in the world: the painter's canvas keeps it. */
export const PATCH_ASPECT =
  ((SKY_UV.u1 - SKY_UV.u0) * PLANE[0]) / ((SKY_UV.v1 - SKY_UV.v0) * PLANE[1]);
/** The patch on the glTF plane's UVs (v down: glTF flips Blender's), as u0, v0, u1, v1. */
export const SKY_RECT_GLTF = [SKY_UV.u0, 1 - SKY_UV.v1, SKY_UV.u1, 1 - SKY_UV.v0] as const;
