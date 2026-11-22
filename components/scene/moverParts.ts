import type { OpenedId } from '@/content/opened';

export type MeshKey = OpenedId | 'phoneScreen';

/** Each mover mesh's material: the rigid parts take their mover's bake; the clip quad is glass. */
export const MESH: Record<string, MeshKey> = {
  kit_base: 'kit',
  kit_lid: 'kit',
  phone_body: 'phone',
  phone_screen: 'phoneScreen',
};

/**
 * The material key for a loaded mover mesh: its own name's, or else its parent's. gltf-transform's
 * quantize can't rescale an animated node, so it moves that node's mesh (kit_lid's) into an unnamed
 * child, which three's GLTFLoader names after the mesh with a suffix ("kit_lid_1").
 */
export function meshKey(name: string, parentName?: string): MeshKey | undefined {
  return MESH[name] ?? (parentName ? MESH[parentName] : undefined);
}
