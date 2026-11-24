'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import poses from '@/content/scene/opened-poses.json';
import type { Vec3 } from '@/content/scene/cameras';
import { spunPose, type Pose } from '@/components/scene/present';
import { spinLive } from '@/lib/spin/live';
import type { SpinId } from '@/lib/spin/spin';
import { spinCamera } from './spinCamera';

/** Past this, the picture stays and the object simply doesn't spin. */
const GIVE_UP_MS = 8000;

const modelSrc = (id: SpinId) => `/scene/spin-${id}.glb`;
const bakeSrc = (id: SpinId, mode: 'day' | 'lamp') => `/opened/bake/${id}-open-${mode}.webp`;

type Props = {
  id: SpinId;
  mode: 'day' | 'lamp';
  onReady: () => void;
  onFail: () => void;
};

/**
 * The still view's spinnable object in 3D, loaded on the first grab: its model with the opened
 * bake painted on (so it looks as the render does, lit as it sits forward), seen through the
 * render's own camera (spinCamera), turned by the visitor's spin about its centre. Draws only when
 * the spin moves, the mode changes or the box resizes. Calls onReady once its first frame is
 * drawn, or onFail if WebGL or the files don't come.
 */
export default function SpinView({ id, mode, onReady, onFail }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  const setMode = useRef<(m: 'day' | 'lamp') => void>(() => {});
  const ready = useRef(onReady);
  const fail = useRef(onFail);
  useEffect(() => {
    ready.current = onReady;
    fail.current = onFail;
  }, [onReady, onFail]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let gone = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = // preserveDrawingBuffer: the canvas is small, and its frame stays readable (tests compare
        // its outline with the picture's)
        new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });
    } catch {
      fail.current();
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera();
    const c = spinCamera(id);
    cam.position.fromArray(c.position);
    cam.quaternion.fromArray(c.quaternion);
    cam.updateMatrixWorld(true);
    const near = 0.01;
    cam.projectionMatrix.makePerspective(
      c.frustum.left * near,
      c.frustum.right * near,
      c.frustum.top * near,
      c.frustum.bottom * near,
      near,
      20,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const view = new THREE.Quaternion(...c.quaternion);
    const viewInv = view.clone().invert();
    const rest = poses[id].pose as Pose;

    let root: THREE.Object3D | null = null;
    let centre: Vec3 = rest.position as Vec3;
    let raf = 0;
    const draw = () => {
      raf = 0;
      if (!root || gone) return;
      const live = spinLive.get();
      const q = live?.id === id ? new THREE.Quaternion(...live.spin.q) : new THREE.Quaternion();
      // the spin is in screen axes: carried into the world through the camera
      const world = view.clone().multiply(q).multiply(viewInv);
      const pose = spunPose(rest, centre, world);
      root.position.fromArray(pose.position);
      root.quaternion.fromArray(pose.quaternion);
      renderer.render(scene, cam);
    };
    const redraw = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const size = () => {
      const r = canvas.getBoundingClientRect();
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      redraw();
    };
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    const unsubscribe = spinLive.subscribe(redraw);

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const textures = new THREE.TextureLoader();
    // Each bake is used only once it has arrived: a texture still loading draws black.
    const bakes = new Map<string, Promise<THREE.Texture>>();
    const loaded: THREE.Texture[] = [];
    const bake = (m: 'day' | 'lamp') => {
      const key = bakeSrc(id, m);
      if (!bakes.has(key))
        bakes.set(
          key,
          new Promise((resolve, reject) =>
            textures.load(
              key,
              (t) => {
                t.flipY = false;
                t.colorSpace = THREE.SRGBColorSpace;
                if (gone) t.dispose();
                else loaded.push(t);
                resolve(t);
              },
              undefined,
              reject,
            ),
          ),
        );
      return bakes.get(key)!;
    };
    const material = new THREE.MeshBasicMaterial();
    let shown = false;
    let painted: 'day' | 'lamp' | null = null;
    const paint = (m: 'day' | 'lamp') =>
      bake(m).then((t) => {
        // the latest mode wins: a slow bake for a mode since left is dropped
        if (gone || modeRef.current !== m) return;
        material.map = t;
        material.needsUpdate = true;
        painted = m;
        canvas.dataset.spinMode = m;
        redraw();
      });
    // until the new light's bake arrives, the object keeps the old one
    setMode.current = (m) => {
      if (shown) paint(m).catch(() => {});
    };

    const timer = setTimeout(() => !shown && fail.current(), GIVE_UP_MS);
    const model = new Promise<THREE.Object3D>((resolve, reject) =>
      loader.load(modelSrc(id), (gltf) => resolve(gltf.scene), undefined, reject),
    );
    Promise.all([model, paint(modeRef.current)])
      .then(([gltf]) => {
        if (gone || !painted) return;
        const obj = gltf.getObjectByName(`obj_${id}`) ?? gltf;
        obj.traverse((o) => {
          if (o instanceof THREE.Mesh) o.material = material;
        });
        obj.position.fromArray(rest.position);
        obj.quaternion.fromArray(rest.quaternion).normalize();
        scene.add(obj);
        obj.updateMatrixWorld(true);
        centre = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()).toArray();
        root = obj;
        size();
        draw();
        // the first frame is on the canvas: the picture can hand over
        requestAnimationFrame(() => {
          if (gone) return;
          shown = true;
          canvas.dataset.spinReady = 'true';
          ready.current();
          // the light may have changed while it loaded
          if (modeRef.current !== painted) paint(modeRef.current).catch(() => {});
        });
      })
      .catch(() => !gone && !shown && fail.current());

    return () => {
      gone = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsubscribe();
      material.dispose();
      loaded.forEach((t) => t.dispose());
      root?.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
      renderer.dispose();
      // free the context now, not at garbage collection: a browser keeps only a few, and drops
      // the oldest (the live scene's, maybe) when more are made
      renderer.forceContextLoss();
    };
  }, [id]);

  useEffect(() => {
    modeRef.current = mode;
    setMode.current(mode);
  }, [mode]);

  return <canvas ref={canvasRef} className="spin-view" aria-hidden="true" />;
}
