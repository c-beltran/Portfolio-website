import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { meshKey } from '../../components/scene/moverParts';

/**
 * The movers: the kit case and the phone export on their own, with
 * their hierarchy and clips, so the live scene can bring them forward. Read from the GLB's JSON
 * chunk, without three.
 */
type Gltf = {
  nodes: { name?: string; children?: number[]; mesh?: number }[];
  animations?: {
    name?: string;
    channels: { sampler: number; target: { node?: number; path: string } }[];
    samplers: { input: number }[];
  }[];
  accessors: { max?: number[] }[];
  meshes: { name?: string }[];
};

const PUBLIC = join(process.cwd(), 'public');

function gltf(file: string): Gltf {
  const b = readFileSync(join(PUBLIC, file));
  expect(b.toString('ascii', 0, 4)).toBe('glTF');
  const len = b.readUInt32LE(12);
  expect(b.toString('ascii', 16, 20)).toBe('JSON');
  return JSON.parse(b.toString('utf8', 20, 20 + len)) as Gltf;
}

const parentOf = (g: Gltf, name: string) => {
  const i = g.nodes.findIndex((n) => n.name === name);
  expect(i, `node ${name}`).toBeGreaterThanOrEqual(0);
  const p = g.nodes.find((n) => n.children?.includes(i));
  return p?.name ?? null;
};

describe('movers.glb', () => {
  const g = gltf('scene/movers.glb');

  // The live kit's lid once drew black: gltf-transform's quantize can't rescale an animated
  // node, so it moves kit_lid's mesh into an unnamed child, which three's GLTFLoader names after the
  // mesh with a suffix ("kit_lid_1", checked by loading this file): no name the lookup knew.
  it("every mesh takes its baked material, even one the optimizer moved into its part's child", () => {
    g.nodes.forEach((n, i) => {
      if (n.mesh === undefined) return;
      const parent = g.nodes.find((p) => p.children?.includes(i));
      const loaded = n.name ?? `${g.meshes[n.mesh]!.name}_1`;
      expect(
        meshKey(loaded, parent?.name),
        `node ${i} (${loaded} under ${parent?.name})`,
      ).toBeDefined();
    });
  });

  it('keeps each mover under its pivot', () => {
    expect(parentOf(g, 'obj_kit')).toBeNull();
    expect(parentOf(g, 'kit_base')).toBe('obj_kit');
    expect(parentOf(g, 'kit_lid')).toBe('obj_kit');
    expect(parentOf(g, 'obj_phone')).toBeNull();
    expect(parentOf(g, 'phone_spin')).toBe('obj_phone');
    expect(parentOf(g, 'phone_body')).toBe('phone_spin');
    expect(parentOf(g, 'phone_screen')).toBe('phone_spin');
  });

  for (const [clip, owner, seconds] of [
    ['kit_open', 'kit_lid', 0.8],
    ['phone_turn', 'phone_spin', 0.5],
  ] as const) {
    it(`carries ${clip} on ${owner}, ${seconds} s long`, () => {
      const a = g.animations?.find((x) => x.name === clip);
      expect(a, clip).toBeDefined();
      const targets = a!.channels.map((c) => g.nodes[c.target.node!]?.name);
      expect(targets).toContain(owner);
      const end = Math.max(...a!.samplers.map((s) => g.accessors[s.input]!.max![0]!));
      expect(end).toBeGreaterThan(seconds - 0.02);
      expect(end).toBeLessThan(seconds + 0.02);
    });
  }
});

describe('scene.glb', () => {
  it('no longer holds the movers', () => {
    const names = gltf('scene/scene.glb').nodes.map((n) => n.name ?? '');
    expect(names.filter((n) => /^(kit|phone|obj_kit|obj_phone)/.test(n))).toEqual([]);
  });
  // the water glass is gone, so its glass and water meshes go too
  it('holds exactly the baked groups and the sky, with no glass or water', () => {
    const g = gltf('scene/scene.glb');
    const meshNodes = g.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name ?? '');
    expect(meshNodes.sort()).toEqual(['desk', 'monitor', 'props', 'room', 'screen', 'sky']);
  });
});

describe('the movers’ bakes', () => {
  for (const [file, size] of [
    ['scene/bake/kit-day.webp', 1024],
    ['scene/bake/kit-lamp.webp', 1024],
    ['scene/bake/phone-day.webp', 512],
    ['scene/bake/phone-lamp.webp', 512],
    ['opened/bake/kit-open-day.webp', 2048],
    ['opened/bake/kit-open-lamp.webp', 2048],
    ['opened/bake/phone-open-day.webp', 1024],
    ['opened/bake/phone-open-lamp.webp', 1024],
  ] as const) {
    it(`${file} is ${size}²`, async () => {
      const p = join(PUBLIC, file);
      expect(existsSync(p), file).toBe(true);
      const m = await sharp(p).metadata();
      expect([m.width, m.height]).toEqual([size, size]);
    });
  }
});
