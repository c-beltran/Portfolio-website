'use client';

import { CameraControls, useGLTF, useTexture } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { bakedMaterial, glassMaterial } from './materials';
import { blend, cameraFor, easeOutCubic, MOVE_MS, type Framing, type View } from './transition';

const GROUPS = ['room', 'desk', 'monitor', 'props', 'screen', 'sky'] as const;
type Group = (typeof GROUPS)[number];
const tex = (g: Group, mode: 'day' | 'lamp') => `/scene/bake/${g}-${mode}.webp`;
const PROBE = ['/scene/bake/probe-day.webp', '/scene/bake/probe-lamp.webp'];

/**
 * The view-dependent layer over the bake (materials.ts), tuned against the Tier 1 still with
 * scripts/scene/measure/match.mjs: which groups reflect the probe, and how strongly.
 */
// Measured (docs/private/design/m3b/match): the desk's sheen helps in day; in lamp the probe
// mirrors the lit screens where the still shows none, and on the props it costs more than it gives.
type Glossy = { gloss: string; strength: number; strengthLamp: number };
const GLOSSY: Partial<Record<Group, Glossy>> = {
  desk: { gloss: '/scene/bake/gloss-desk.webp', strength: 2, strengthLamp: 0 },
};
// Dark and mostly clear: through the glass the still shows the dark desk, a rim of reflection.
const GLASS = { tint: '#1c2128', fill: 0.15, strength: 1 };
const WATER = { tint: '#1a2633', fill: 0.45, strength: 0.8 };

function Scene({ lamp, onReady }: { lamp: boolean; onReady: () => void }) {
  const { scene } = useGLTF('/scene/scene.glb');
  const glossy = Object.entries(GLOSSY) as [Group, Glossy][];
  const urls = [
    ...GROUPS.flatMap((g) => [tex(g, 'day'), tex(g, 'lamp')]),
    ...PROBE,
    ...glossy.map(([, o]) => o.gloss),
  ];
  const textures = useTexture(urls);
  const invalidate = useThree((s) => s.invalidate);
  const materials = useMemo(() => {
    const n = 2 * GROUPS.length;
    const probe = [textures[n]!, textures[n + 1]!] as [THREE.Texture, THREE.Texture];
    const baked = Object.fromEntries(
      GROUPS.map((g, i) => {
        const k = glossy.findIndex(([name]) => name === g);
        const opts = k < 0 ? {} : { ...glossy[k]![1], probe, gloss: textures[n + 2 + k]! };
        return [g, bakedMaterial(textures[2 * i]!, textures[2 * i + 1]!, opts)];
      }),
    ) as Record<Group, THREE.ShaderMaterial>;
    const see = (o: typeof GLASS) =>
      glassMaterial(probe, new THREE.Color(o.tint), o.fill, o.strength);
    return { ...baked, glass: see(GLASS), water: see(WATER) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textures]);

  useEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const g = (o.name in materials ? o.name : o.parent?.name) as keyof typeof materials;
      const m = materials[g] ?? materials.glass;
      if (g === 'glass' || g === 'water') {
        // Each is one upright cylinder: its normal is radial from the vertical axis.
        o.geometry.computeBoundingBox();
        const c = o.geometry.boundingBox!.getCenter(new THREE.Vector3());
        o.updateWorldMatrix(true, false);
        m.uniforms.center!.value = c.applyMatrix4(o.matrixWorld);
        o.renderOrder = g === 'water' ? 1 : 2; // water inside the glass
      }
      o.material = m;
    });
    invalidate();
    onReady();
  }, [scene, materials, invalidate, onReady]);

  // Day ↔ lamp cross-fade (0.6 s), rendering on demand only while it runs.
  useEffect(() => {
    const to = lamp ? 1 : 0;
    const from = materials.room.uniforms.fade!.value as number;
    const start = performance.now();
    let id = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / 600);
      for (const m of Object.values(materials)) m.uniforms.fade!.value = from + (to - from) * k;
      invalidate();
      if (k < 1) id = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(id);
  }, [lamp, materials, invalidate]);

  return <primitive object={scene} />;
}

/** Drives the camera along the shared transition (lerpLookAt with the clips' ease-out). */
function Rig({
  view,
  framing,
  onMove,
}: {
  view: View;
  framing: Framing;
  onMove: (moving: boolean) => void;
}) {
  const controls = useRef<CameraControls>(null);
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size); // re-applies the rest pose on resize
  const last = useRef<View>(view);

  const apply = (pose: ReturnType<typeof blend>) => {
    const c = controls.current;
    if (!c) return;
    const { camera: cam, size, invalidate } = get();
    const camera = cam as THREE.PerspectiveCamera;
    c.setLookAt(...pose.eye, ...pose.target, false);
    const aspect = size.width / size.height;
    camera.fov = (2 * Math.atan(Math.tan(pose.hfov / 2) / aspect) * 180) / Math.PI;
    // Blender lens shift is a fraction of the larger side; three's view offset moves the frame.
    const big = Math.max(size.width, size.height);
    camera.setViewOffset(
      size.width,
      size.height,
      -pose.shift[0] * big,
      pose.shift[1] * -big,
      size.width,
      size.height,
    );
    camera.updateProjectionMatrix();
    invalidate();
  };

  // Rest pose on mount and on resize or framing change.
  useEffect(() => {
    apply(blend(cameraFor(last.current, framing), cameraFor(last.current, framing), 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framing, size.width, size.height]);

  useEffect(() => {
    if (view === last.current) return;
    const a = cameraFor(last.current, framing);
    const b = cameraFor(view, framing);
    last.current = view;
    const start = performance.now();
    let id = 0;
    onMove(true);
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / MOVE_MS);
      apply(blend(a, b, easeOutCubic(t)));
      if (t < 1) id = requestAnimationFrame(step);
      else onMove(false);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const NONE = 0; // CameraControls.ACTION.NONE: the camera is directed, never orbited (spec §4)
  return (
    <CameraControls
      ref={controls}
      makeDefault
      mouseButtons={{ left: NONE, middle: NONE, right: NONE, wheel: NONE }}
      touches={{ one: NONE, two: NONE, three: NONE }}
    />
  );
}

const noop = () => {};

export default function LiveScene(props: {
  view: View;
  framing: Framing;
  lamp: boolean;
  onReady: () => void;
  onMove?: (moving: boolean) => void;
}) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ near: 0.05, far: 20 }}
    >
      <Suspense fallback={null}>
        <Scene lamp={props.lamp} onReady={props.onReady} />
      </Suspense>
      <Rig view={props.view} framing={props.framing} onMove={props.onMove ?? noop} />
    </Canvas>
  );
}
