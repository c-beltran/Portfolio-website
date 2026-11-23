'use client';

import { useGLTF, useTexture } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { bakedMaterial } from './materials';
import { Movers } from './Movers';
import type { MomentRig } from './MomentRig';
import { leanCamera, leanView, stateOf, type CamState, type ScreenBox } from './lean';
import { MOVER_IDS, type LeanId, type MoverId, type OpenedId } from '@/content/opened';
import { CAMERAS, type Vec3 } from '@/content/scene/cameras';
import { master, viewOffset } from '@/content/scene/framing';
import { panOf } from '@/components/desk/pan';
import { glanceShift, glanceTarget, useGlance, type Glance } from './glance';
import { hfov } from './transition';

const GROUPS = ['room', 'desk', 'monitor', 'props', 'screen', 'board', 'sky'] as const;
type Group = (typeof GROUPS)[number];
/** The objects that come forward, in their own GLB (Movers.tsx). */
const MOVERS = MOVER_IDS;
type Mover = MoverId;
// The phone's dark glass, under the clip quad: the residual corrects it toward the still.
const PHONE_GLASS = '#0b0c0e';
const tex = (g: Group | Mover, mode: 'day' | 'lamp') => `/scene/bake/${g}-${mode}.webp`;
const PROBE = ['/scene/bake/probe-day.webp', '/scene/bake/probe-lamp.webp'];

/**
 * The view-dependent layer over the bake (materials.ts), tuned against the Tier 1 still with
 * scripts/scene/measure/match.mjs: which groups reflect the probe, and how strongly.
 */
// Measured: the desk's sheen helps in day; in lamp the probe
// mirrors the lit screens where the still shows none, and on the props it costs more than it gives.
type Glossy = { gloss: string; strength: number; strengthLamp: number };
const GLOSSY: Partial<Record<Group, Glossy>> = {
  desk: { gloss: '/scene/bake/gloss-desk.webp', strength: 2, strengthLamp: 0 },
};

/**
 * Points a camera through the seat: the full frustum is the seat's master
 * render, `view` the window cut out of it (framing.ts viewOffset, fullW × fullH px, the window at
 * x, y), plus Blender's lens shift, a fraction of the larger side (the master's width): +x right,
 * +y up. The rig and the residual's projection both use it, so they can't drift apart.
 */
function aimSeat(
  camera: THREE.PerspectiveCamera,
  view: { fullW: number; fullH: number; x: number; y: number },
  width: number,
  height: number,
  target: Vec3 = CAMERAS.seat.target,
) {
  const seat = CAMERAS.seat;
  const { w, h } = master();
  camera.aspect = w / h;
  camera.fov = (2 * Math.atan(Math.tan(hfov(seat) / 2) / (w / h)) * 180) / Math.PI;
  const big = Math.max(view.fullW, view.fullH);
  camera.setViewOffset(
    view.fullW,
    view.fullH,
    view.x + seat.shift[0] * big,
    view.y - seat.shift[1] * big,
    width,
    height,
  );
  camera.position.set(...seat.eye);
  camera.up.set(0, 1, 0);
  camera.lookAt(...target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

/** The seat at rest, the whole master: what the residual was captured through. */
function seatViewProj(): THREE.Matrix4 {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.05, 20);
  const { w, h } = master();
  const [fullW, fullH] = [2048, (2048 * h) / w];
  aimSeat(cam, { fullW, fullH, x: 0, y: 0 }, fullW, fullH);
  return new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
}

const RESIDUAL = ['/scene/bake/residual-seat-day.webp', '/scene/bake/residual-seat-lamp.webp'];

function Scene({
  lamp,
  onReady,
  capture,
  open,
  rigRef,
}: {
  lamp: boolean;
  onReady: () => void;
  capture: boolean;
  open: OpenedId | null;
  rigRef: RefObject<MomentRig | null>;
}) {
  const { scene } = useGLTF('/scene/scene.glb');
  const glossy = Object.entries(GLOSSY) as [Group, Glossy][];
  const urls = [
    ...GROUPS.flatMap((g) => [tex(g, 'day'), tex(g, 'lamp')]),
    ...PROBE,
    ...glossy.map(([, o]) => o.gloss),
    // The capture for the residual renders without it (scripts/scene/measure/residual.mjs).
    ...(capture ? [] : RESIDUAL),
    ...MOVERS.flatMap((m) => [tex(m, 'day'), tex(m, 'lamp')]),
  ];
  const textures = useTexture(urls);
  const invalidate = useThree((s) => s.invalidate);
  const canvas = useThree((s) => s.gl.domElement);
  const materials = useMemo(() => {
    const n = 2 * GROUPS.length;
    const probe = [textures[n]!, textures[n + 1]!] as [THREE.Texture, THREE.Texture];
    const r = n + 2 + glossy.length;
    const residual = capture
      ? undefined
      : { day: textures[r]!, lamp: textures[r + 1]!, viewProj: seatViewProj() };
    const baked = Object.fromEntries(
      GROUPS.map((g, i) => {
        const k = glossy.findIndex(([name]) => name === g);
        const opts = k < 0 ? {} : { ...glossy[k]![1], probe, gloss: textures[n + 2 + k]! };
        return [
          g,
          bakedMaterial(textures[2 * i]!, textures[2 * i + 1]!, { ...opts, residual, dim: true }),
        ];
      }),
    ) as Record<Group, THREE.ShaderMaterial>;
    const m0 = urls.length - 2 * MOVERS.length;
    const moving = Object.fromEntries(
      MOVERS.map((m, i) => [
        m,
        bakedMaterial(textures[m0 + 2 * i]!, textures[m0 + 2 * i + 1]!, {
          residual,
          opened: true,
          dim: true,
        }),
      ]),
    ) as Record<Mover, THREE.ShaderMaterial>;
    const glassTex = flat(PHONE_GLASS);
    const phoneScreen = bakedMaterial(glassTex, glassTex, { residual, opened: true, dim: true });
    return { ...baked, ...moving, phoneScreen };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textures]);

  useEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const g = (o.name in materials ? o.name : o.parent?.name) as keyof typeof materials;
      // an unknown mesh takes the props bake (no mesh needs one)
      o.material = materials[g] ?? materials.props;
    });
    invalidate();
    onReady();
  }, [scene, materials, invalidate, onReady]);
  const statics = useMemo(() => GROUPS.map((g) => materials[g]), [materials]);

  // Day ↔ lamp cross-fade (0.6 s), rendering on demand only while it runs.
  const first = useRef(true);
  useEffect(() => {
    const to = lamp ? 1 : 0;
    // The first frame is already in the current mode: no day-lit flash when it appears.
    const from = first.current ? to : (materials.room.uniforms.fade!.value as number);
    first.current = false;
    const start = performance.now();
    let id = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / 600);
      const fade = from + (to - from) * k;
      for (const m of Object.values(materials)) m.uniforms.fade!.value = fade;
      canvas.dataset.fade = fade.toFixed(2); // where the scene is between day and lamp (for tests)
      invalidate();
      if (k < 1) id = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(id);
  }, [lamp, materials, invalidate, canvas]);

  return (
    <>
      <primitive object={scene} />
      <Movers open={open} materials={materials} statics={statics} rigRef={rigRef} />
    </>
  );
}

/** Put a camera state on the live camera (its projection included, as R3F leaves it to us). */
function setCam(camera: THREE.PerspectiveCamera, s: CamState) {
  camera.position.fromArray(s.position);
  camera.quaternion.fromArray(s.quaternion);
  camera.projectionMatrix.fromArray(s.projection);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.updateMatrixWorld();
}

/** A 1×1 colour standing in for a bake: sRGB bytes, as the bakes are (materials.ts lightmap). */
function flat(hex: string): THREE.Texture {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const t = new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

/**
 * The live seat: the seat camera framing the window exactly as the Tier 1
 * still does. The full frustum is the seat's master render; setViewOffset cuts the window out of
 * it with framing.ts viewOffset (the portrait pan included) plus Blender's lens shift. The glance
 * turns the camera a few degrees, and the DOM overlays (hotspots, the name) move by the matching
 * screen distance through --gx/--gy on .desk-still.
 */
function Rig({
  capture,
  open,
  rigRef,
}: {
  capture: boolean;
  open: OpenedId | null;
  rigRef: RefObject<MomentRig | null>;
}) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const glance = useRef<Glance>({ yaw: 0, pitch: 0 });
  const still = useMemo(() => document.querySelector<HTMLElement>('.desk-still'), []);
  // The seat camera as last aimed, and each lean-in's last art box (a closing one's slot goes).
  const seatCam = useRef<CamState | null>(null);
  const boxes = useRef(new Map<LeanId, ScreenBox>());
  const leaned = useRef(false);

  const frame = useCallback(() => {
    const { camera: cam, size, invalidate } = get();
    const camera = cam as THREE.PerspectiveCamera & { manual?: boolean };
    const [W, H] = [size.width, size.height];
    if (!W || !H) return;
    camera.manual = true; // R3F leaves aspect and the projection to us
    if (capture) {
      // The whole master, at rest: the canvas is the master's shape (residual.mjs sizes it).
      aimSeat(camera, { fullW: W, fullH: H, x: 0, y: 0 }, W, H);
      invalidate();
      return;
    }
    const o = viewOffset(W / H, W, H, still ? panOf(still) : 0);
    const seat = CAMERAS.seat;
    const g = glance.current;
    aimSeat(camera, o, W, H, glanceTarget(seat.eye, seat.target, g.yaw, g.pitch));
    camera.updateMatrixWorld();
    seatCam.current = stateOf(camera);
    leaned.current = false;
    invalidate();
    // The overlays follow the turn: focal length in pixels of the full frame.
    const [dx, dy] = glanceShift(g.yaw, g.pitch, o.fullW / 2 / Math.tan(hfov(seat) / 2));
    still?.style.setProperty('--gx', `${dx.toFixed(2)}px`);
    still?.style.setProperty('--gy', `${dy.toFixed(2)}px`);
  }, [get, still, capture]);

  // Before Movers fits its objects (priority −1, so R3F still renders): lean the camera in from
  // the seat for each lean-in on its way (MomentRig.lean), or put it back at the seat.
  useFrame(() => {
    const rig = rigRef.current;
    const from = seatCam.current;
    if (capture || !rig || !from) return;
    const camera = get().camera as THREE.PerspectiveCamera;
    const leans = rig.lean();
    if (!leans.length) {
      if (leaned.current) setCam(camera, from);
      leaned.current = false;
      return;
    }
    const c = get().gl.domElement.getBoundingClientRect();
    const canvas = { left: c.left, top: c.top, width: c.width, height: c.height };
    const states = leans.flatMap((l) => {
      const r = document
        .querySelector<HTMLElement>(`.opened[data-id="${l.id}"] .opened__art`)
        ?.getBoundingClientRect();
      if (r && r.height > 0)
        boxes.current.set(l.id, { left: r.left, top: r.top, width: r.width, height: r.height });
      const b = boxes.current.get(l.id);
      return b ? [{ state: leanView(l.id, b, canvas), k: l.k }] : [];
    });
    setCam(camera, leanCamera(from, states));
    leaned.current = true;
  }, -1);

  // On mount and every resize; the portrait pan re-frames on the desk's scroll.
  useEffect(frame, [frame, size.width, size.height]);
  useEffect(() => {
    if (!still) return;
    still.addEventListener('scroll', frame, { passive: true });
    return () => {
      still.removeEventListener('scroll', frame);
      still.style.removeProperty('--gx');
      still.style.removeProperty('--gy');
    };
  }, [still, frame]);

  useGlance(
    useCallback(
      (g: Glance) => {
        glance.current = g;
        frame();
      },
      [frame],
    ),
    // While an object is out the view holds still, so the held object and the panel don't drift.
    open === null,
  );
  return null;
}

export default function LiveScene(props: {
  lamp: boolean;
  onReady: () => void;
  /** ?tier=2&capture=master: the whole master at rest, no residual, readable pixels. */
  capture?: boolean;
  /** The object that has come forward, if any (content/opened.ts). */
  open?: OpenedId | null;
}) {
  const open = props.open ?? null;
  const capture = !!props.capture;
  const rigRef = useRef<MomentRig | null>(null);
  return (
    <Canvas
      // Never a pointer target: the hotspots and the page own every pointer and touch.
      style={{ pointerEvents: 'none' }}
      frameloop="demand"
      dpr={capture ? 1 : [1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
        preserveDrawingBuffer: capture,
      }}
      camera={{ near: 0.05, far: 20 }}
    >
      <Suspense fallback={null}>
        <Scene
          lamp={props.lamp}
          onReady={props.onReady}
          capture={capture}
          open={open}
          rigRef={rigRef}
        />
      </Suspense>
      <Rig capture={capture} open={open} rigRef={rigRef} />
    </Canvas>
  );
}
