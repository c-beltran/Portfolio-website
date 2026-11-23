'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { artOf, OPENED_IDS, type MoverId, type OpenedId } from '@/content/opened';
import poses from '@/content/scene/opened-poses.json';
import type { Vec3 } from '@/content/scene/cameras';
import { setOpenedBake } from './materials';
import { OUT, REST, stepMoment, type Moment } from './moment';
import { blendPose, presentPose, projectedHeight, type Pose } from './present';
import { easeOutCubic } from './transition';
import { meshKey } from './moverParts';

const PIVOT: Record<OpenedId, string> = { kit: 'obj_kit', phone: 'obj_phone' };
const CLIP_ID = 'power-walk-clip';
const openBake = (id: OpenedId, mode: 'day' | 'lamp') => `/opened/bake/${id}-open-${mode}.webp`;

type Mats = Record<MoverId | 'phoneScreen', THREE.ShaderMaterial>;
type Mover = {
  pivot: THREE.Object3D;
  action: THREE.AnimationAction;
  duration: number;
  clipMs: number;
  rest: Pose;
  /** The pose last fitted to its slot (kept for the way back, once the slot has gone). */
  present: Pose | null;
  moment: Moment;
  /** Its opened bake: asked for (on its first open), and in the material (mixed in only then). */
  requested: boolean;
  loaded: boolean;
};

const poseOf = (o: THREE.Object3D): Pose => ({
  position: o.position.toArray() as Vec3,
  quaternion: o.quaternion.toArray() as Pose['quaternion'],
});
const hookName = (id: OpenedId) => `travel${id[0]!.toUpperCase()}${id.slice(1)}`;

type Setup = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  materials: Mats;
  statics: THREE.ShaderMaterial[];
  canvas: HTMLCanvasElement;
  /** For the test hook data-textures: the textures the renderer holds. */
  renderer: THREE.WebGLRenderer;
  invalidate: () => void;
  /** The object already out when the scene mounts (a direct load): it starts out, unanimated. */
  initial: OpenedId | null;
};

/**
 * The movers' state, outside React: their moments, poses, clips and materials, and the phone
 * screen's video. Movers drives it from effects (setOpen) and from each rendered frame (fit).
 */
class MoverRig {
  private mixer: THREE.AnimationMixer;
  private all: Record<OpenedId, Mover>;
  private open: OpenedId | null;
  private last: OpenedId | null;
  private raf = 0;
  private alive = true;
  private video: { el: HTMLVideoElement; tex: THREE.VideoTexture } | null = null;
  private ray = new THREE.Vector3();

  constructor(private s: Setup) {
    this.mixer = new THREE.AnimationMixer(s.scene);
    this.open = this.last = s.initial;
    this.all = Object.fromEntries(
      OPENED_IDS.map((id) => {
        const pivot = s.scene.getObjectByName(PIVOT[id])!;
        const clip = s.animations.find((a) => a.name === poses[id].clip)!;
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        const m: Mover = {
          pivot,
          action,
          duration: clip.duration,
          clipMs: poses[id].clipMs,
          rest: poseOf(pivot),
          present: null,
          moment: id === s.initial ? OUT : REST,
          requested: false,
          loaded: false,
        };
        return [id, m];
      }),
    ) as Record<OpenedId, Mover>;
    s.scene.traverse((o) => {
      const key = o instanceof THREE.Mesh ? meshKey(o.name, o.parent?.name) : undefined;
      if (key) (o as THREE.Mesh).material = s.materials[key];
    });
    if (s.initial) this.loadBake(s.initial);
    this.syncVideo();
    this.apply();
    s.invalidate();
  }

  /** What's open now: the moments move toward it on each animation frame until they settle. */
  setOpen(open: OpenedId | null) {
    this.open = open;
    if (open) {
      this.last = open;
      this.loadBake(open);
    }
    this.syncVideo();
    cancelAnimationFrame(this.raf);
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = now - prev;
      prev = now;
      // Keep going until every mover has reached where it's headed (not "until a step changed
      // nothing": a frame's timestamp can precede the call, so the first step may be empty).
      let moving = false;
      for (const id of OPENED_IDS) {
        const m = this.all[id];
        m.moment = stepMoment(m.moment, this.open === id, dt, m.clipMs);
        const goal = this.open === id ? OUT : REST;
        if (m.moment.travel !== goal.travel || m.moment.clip !== goal.clip) moving = true;
      }
      this.syncVideo();
      this.apply();
      this.s.invalidate();
      this.raf = moving ? requestAnimationFrame(tick) : 0;
    };
    this.apply();
    this.raf = requestAnimationFrame(tick);
  }

  /** Each rendered frame: fit every mover to its slot (.opened__art) through the live camera. */
  fit(cam: THREE.PerspectiveCamera, view: { width: number; height: number }) {
    this.s.canvas.dataset.textures = String(this.s.renderer.info.memory.textures);
    const c = this.s.canvas.getBoundingClientRect();
    const focalPx = (cam.projectionMatrix.elements[5]! * view.height) / 2;
    for (const id of OPENED_IDS) {
      const m = this.all[id];
      const box = document
        .querySelector<HTMLElement>(`.opened[data-id="${id}"]:not([data-leaving]) .opened__art`)
        ?.getBoundingClientRect();
      if (box && box.height > 0) {
        // aim where the render shows the pivot, not at the box's centre
        const [px, py] = artOf(id).pivot;
        const x = ((box.left + box.width * px - c.left) / c.width) * 2 - 1;
        const y = 1 - ((box.top + box.height * py - c.top) / c.height) * 2;
        this.ray.set(x, y, 0.5).unproject(cam).sub(cam.position).normalize();
        const fitTo = (artHeightPx: number) =>
          presentPose({
            eye: cam.position.toArray() as Vec3,
            forward: poses.forward as Vec3,
            canonical: poses[id].pose as Pose,
            d0: poses[id].d0,
            theta: artOf(id).theta,
            ray: this.ray.toArray() as Vec3,
            artHeightPx,
            focalPx,
          });
        // Sized as if on the camera's axis (as its render was), then refitted for the stretch a
        // flat image gives it off the axis, so it is as tall on screen as the art box.
        const first = fitTo(box.height);
        const dist = cam.position.distanceTo(new THREE.Vector3(...first.position));
        const seen = projectedHeight(
          cam,
          this.ray.toArray() as Vec3,
          dist,
          artOf(id).theta * poses[id].d0,
          view,
        );
        m.present = seen > 0 ? fitTo((box.height * box.height) / seen) : first;
        if (id === (this.open ?? this.last)) this.s.canvas.dataset.fit = box.height.toFixed(1);
      }
      const k = easeOutCubic(m.moment.travel);
      const pose = k > 0 && m.present ? blendPose(m.rest, m.present, k) : m.rest;
      m.pivot.position.fromArray(pose.position);
      m.pivot.quaternion.fromArray(pose.quaternion);
    }
  }

  dispose() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.dropVideo();
    for (const s of this.s.statics) s.uniforms.dim!.value = 0;
  }

  /** Materials, clips and test hooks from the moments. */
  private apply() {
    const { materials, statics, canvas } = this.s;
    let dim = 0;
    for (const id of OPENED_IDS) {
      const m = this.all[id];
      const k = easeOutCubic(m.moment.travel);
      dim = Math.max(dim, k);
      // The residual is exact only where the object rests; it fades off it as it lifts.
      for (const mat of id === 'phone' ? [materials.phone, materials.phoneScreen] : [materials.kit])
        if (mat.uniforms.residualWeight) mat.uniforms.residualWeight.value = 1 - k;
      // Until its opened bake has arrived the placeholder is black: keep the rest bake showing.
      materials[id].uniforms.openMix!.value = m.loaded ? m.moment.clip : 0;
      m.action.time = m.moment.clip * m.duration;
      canvas.dataset[hookName(id)] = m.moment.travel.toFixed(2);
    }
    materials.phoneScreen.uniforms.openMix!.value = this.video ? this.all.phone.moment.clip : 0;
    for (const s of statics) s.uniforms.dim!.value = dim;
    this.mixer.update(0);
    const shown = this.all[this.open ?? this.last ?? 'kit'];
    canvas.dataset.open = this.open ?? '';
    canvas.dataset.travel = shown.moment.travel.toFixed(2);
    canvas.dataset.clip = shown.moment.clip.toFixed(2);
    const mix = materials[this.open ?? this.last ?? 'kit'].uniforms.openMix!.value as number;
    canvas.dataset.openMix = mix.toFixed(2);
  }

  /** The opened bake loads the first time its mover comes out (on demand). */
  private loadBake(id: OpenedId) {
    const m = this.all[id];
    if (m.requested) return;
    m.requested = true;
    const loader = new THREE.TextureLoader();
    void Promise.all([
      loader.loadAsync(openBake(id, 'day')),
      loader.loadAsync(openBake(id, 'lamp')),
    ]).then(
      ([day, lamp]) => {
        if (!this.alive) return; // a rig replaced since: never write over the live one
        setOpenedBake(this.s.materials[id], day, lamp);
        m.loaded = true;
        this.apply();
        this.s.invalidate();
      },
      () => (m.requested = false),
    );
  }

  /**
   * Let go of the clip's texture: unbind it from the screen first, or three re-uploads the disposed
   * texture on the next draw and nothing ever frees it (one leaked per close).
   */
  private dropVideo() {
    if (!this.video) return;
    const u = this.s.materials.phoneScreen.uniforms;
    u.openDay!.value = u.openLamp!.value = this.blank;
    u.openDecode!.value = 0;
    this.video.tex.dispose();
    this.video = null;
  }

  private blank = (() => {
    const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    t.needsUpdate = true;
    return t;
  })();

  /** The phone's screen shows the clip's <video> (PhoneClip.tsx) while it's in the page. */
  private syncVideo() {
    const el = document.getElementById(CLIP_ID) as HTMLVideoElement | null;
    if (el === (this.video?.el ?? null)) return;
    this.dropVideo();
    if (!el) return;
    const tex = new THREE.VideoTexture(el);
    setOpenedBake(this.s.materials.phoneScreen, tex, tex);
    this.video = { el, tex };
    // Render each new video frame while it plays, and only then.
    const frame = () => {
      if (!this.alive || this.video?.el !== el || el.paused) return;
      this.s.invalidate();
      if ('requestVideoFrameCallback' in el) el.requestVideoFrameCallback(frame);
      else requestAnimationFrame(frame);
    };
    el.addEventListener('play', frame);
    frame();
  }
}

/**
 * The kit and the phone in the live scene: each comes from its place
 * on the desk to the panel's slot over 0.9 s (eased), then its clip plays (the lid opens, the phone
 * turns), and going back folds both from wherever they are. The slot is the DOM's .opened__art:
 * the object is fitted to that box each rendered frame (presentPose), so a resize refits it. The
 * rest of the scene dims as it comes out, its residual fades off it, its opened bake fades in with
 * the clip, and the phone's screen shows the clip's video. Test hooks on the canvas: data-open,
 * data-travel and data-clip (the open or last mover), data-travel-kit / -phone, data-fit.
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
  const rig = useRef<MoverRig | null>(null);
  const latest = useRef(open);
  useEffect(() => {
    const r = new MoverRig({
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
