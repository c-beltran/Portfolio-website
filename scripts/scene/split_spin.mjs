// The objects a visitor can spin in the still view (the car, the ball, the mug), each cut out of
// the movers' glb into its own file so a drag loads only the object in hand: its meshes and
// hierarchy, at its clip's last frame (as its opened render), no clips, Meshopt kept. A dense mesh
// (the car) is simplified within a tight error, so its outline still matches its opened render.
//
//   node scripts/scene/split_spin.mjs [movers glb] [out dir]   (default public/scene/movers.glb → public/scene/spin-<id>.glb)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const SRC = process.argv[2] ?? 'public/scene/movers.glb';
const OUT = process.argv[3] ?? 'public/scene';
const IDS = ['car', 'ball', 'mug'];
/** Above this many triangles a mesh is simplified, never past SIMPLIFY_ERROR (of its size). */
const DENSE = 10_000;
const SIMPLIFY_ERROR = 0.0008;

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const triangles = (node) => {
  let n = 0;
  node.traverse((x) => {
    for (const p of x.getMesh()?.listPrimitives() ?? []) n += (p.getIndices()?.getCount() ?? 0) / 3;
  });
  return n;
};

for (const id of IDS) {
  const name = `obj_${id}`;
  const doc = await io.read(SRC);
  const root = doc.getRoot();
  let found = null;
  for (const scene of root.listScenes())
    for (const node of scene.listChildren()) {
      if (node.getName() === name) {
        found = node;
        continue;
      }
      // the object may sit under a group: lift it to the scene before the group goes
      node.traverse((n) => {
        if (n !== node && n.getName() === name) {
          found = n;
          scene.addChild(n);
        }
      });
      if (found !== node) node.dispose();
    }
  if (!found) throw new Error(`split_spin: no ${name} in ${SRC}`);
  // every node outside the object goes, children too (a disposed group leaves them orphaned)
  const kept = new Set();
  found.traverse((n) => kept.add(n));
  for (const n of root.listNodes()) if (!kept.has(n)) n.dispose();
  // The opened render shows each clip's last frame (the car turned, the mug tipped): set it on
  // the node it moves, then drop the clips.
  for (const a of root.listAnimations()) {
    for (const ch of a.listChannels()) {
      const node = ch.getTargetNode();
      if (!node || !kept.has(node) || ch.getTargetPath() !== 'rotation') continue;
      const out = ch.getSampler().getOutput();
      node.setRotation(out.getElement(out.getCount() - 1, []));
    }
    a.dispose();
  }
  const dense = triangles(found) > DENSE;
  await doc.transform(
    prune(),
    ...(dense
      ? [weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: SIMPLIFY_ERROR })]
      : []),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const out = `${OUT}/spin-${id}.glb`;
  await io.write(out, doc);
  console.log(`${out}: ${triangles(found) | 0} triangles${dense ? ' (simplified)' : ''}`);
}
