'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OpenedId } from '@/content/opened';
import { MomentRig, type Mats } from './MomentRig';

/**
 * The nine movers in the live scene: each comes from its place
 * on the desk to the panel's slot over 0.9 s (eased), then its clip plays (the lid opens, the phone
 * turns), and going back folds both from wherever they are. The slot is the DOM's .opened__art:
 * the object is fitted to that box each rendered frame (presentPose), so a resize refits it. The
 * rest of the scene dims as it comes out, its residual fades off it, its opened bake fades in with
 * the clip, and the phone's screen shows the clip's video. The rig (MomentRig.ts) also carries
 * the lean-ins' travel and writes the canvas's test hooks.
 */
export function Movers({
  open,
  materials,
  statics,
}: {
  open: OpenedId | null;
  materials: Mats;
  /** The static scene's materials: each has a `dim` uniform. */
  statics: THREE.ShaderMaterial[];
}) {
  const { scene, animations } = useGLTF('/scene/movers.glb');
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const rig = useRef<MomentRig | null>(null);
  const latest = useRef(open);
  useEffect(() => {
    const r = new MomentRig({
      scene,
      animations,
      materials,
      statics,
      canvas: gl.domElement,
      renderer: gl,
      invalidate,
      initial: latest.current,
    });
    rig.current = r;
    return () => {
      r.dispose();
      rig.current = null;
    };
  }, [scene, animations, materials, statics, gl, invalidate]);
  useEffect(() => {
    if (latest.current === open) return;
    latest.current = open;
    rig.current?.setOpen(open);
  }, [open]);
  useFrame((state) => rig.current?.fit(state.camera as THREE.PerspectiveCamera, state.size));
  return <primitive object={scene} />;
}
