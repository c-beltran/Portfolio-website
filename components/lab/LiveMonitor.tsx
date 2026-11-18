'use client';

import { CameraControls, useGLTF, useTexture } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { blend, cameraFor, easeOutCubic, MOVE_MS, type Framing, type View } from './transition';

const GROUPS = ['room', 'desk', 'monitor', 'props', 'screen', 'sky'] as const;
type Group = (typeof GROUPS)[number];
const tex = (g: Group, mode: 'day' | 'lamp') => `/lab/bake/${g}-${mode}.webp`;

/** Unlit, baked: shows the Cycles bake as is, cross-fading day → lamp by `fade`. */
function bakedMaterial(day: THREE.Texture, lamp: THREE.Texture) {
  for (const t of [day, lamp]) {
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    // The monitor model's screen UVs run outside 0–1 (Blender repeats images by default).
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  return new THREE.ShaderMaterial({
    // Cycles shades both sides of a face; some imported faces (the monitor screen) wind backwards.
    side: THREE.DoubleSide,
    uniforms: { day: { value: day }, lamp: { value: lamp }, fade: { value: 0 } },
    vertexShader: [
      'varying vec2 vUv;',
      'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D day;',
      'uniform sampler2D lamp;',
      'uniform float fade;',
      'varying vec2 vUv;',
      'void main() {',
      '  gl_FragColor = mix(texture2D(day, vUv), texture2D(lamp, vUv), fade);',
      '  #include <colorspace_fragment>',
      '}',
    ].join('\n'),
  });
}

function Scene({ lamp, onReady }: { lamp: boolean; onReady: () => void }) {
  const { scene } = useGLTF('/lab/scene.glb');
  const urls = GROUPS.flatMap((g) => [tex(g, 'day'), tex(g, 'lamp')]);
  const textures = useTexture(urls);
  const invalidate = useThree((s) => s.invalidate);
  const materials = useMemo(
    () =>
      Object.fromEntries(
        GROUPS.map((g, i) => [g, bakedMaterial(textures[2 * i]!, textures[2 * i + 1]!)]),
      ),
    [textures],
  ) as Record<Group, THREE.ShaderMaterial>;

  useEffect(() => {
    const glass = new THREE.MeshBasicMaterial({
      color: '#dfe8f5',
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const g = (o.name in materials ? o.name : o.parent?.name) as Group | 'glass' | 'water';
      o.material = g === 'glass' || g === 'water' ? glass : (materials[g as Group] ?? glass);
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

export default function LiveMonitor(props: {
  view: View;
  framing: Framing;
  lamp: boolean;
  onMove: (moving: boolean) => void;
  onReady: () => void;
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
      <Rig view={props.view} framing={props.framing} onMove={props.onMove} />
    </Canvas>
  );
}
