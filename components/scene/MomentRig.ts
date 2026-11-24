import * as THREE from 'three';
import {
  artOf,
  isLean,
  isMover,
  LEAN_FEATHER,
  LEAN_IDS,
  MOVER_IDS,
  OPENED_IDS,
  type LeanId,
  type MoverId,
  type OpenedId,
} from '@/content/opened';
import poses from '@/content/scene/opened-poses.json';
import type { Vec3 } from '@/content/scene/cameras';
import { quadMatrix3d, type Pt } from '@/content/scene/screenAffine';
import { foldOrder, holeOf } from './lean';
import { setOpenedBake } from './materials';
import { dimsFor, OUT, REST, stepMoment, type Moment } from './moment';
import { meshKey } from './moverParts';
import { spinLive } from '@/lib/spin/live';
import { isSpin } from '@/lib/spin/spin';
import { blendPose, presentPose, projectedHeight, spunPose, type Pose } from './present';
import { easeOutCubic } from './transition';

const CLIP_ID = 'power-walk-clip';
const openBake = (id: MoverId, mode: 'day' | 'lamp') => `/opened/bake/${id}-open-${mode}.webp`;
const cap = (id: string) => id[0]!.toUpperCase() + id.slice(1);

export type Mats = Record<MoverId | 'phoneScreen', THREE.ShaderMaterial>;
type MoverPose = (typeof poses)['kit'] & { face?: { part: string; corners: number[][] } };
const POSES = poses as unknown as Record<MoverId, MoverPose> & { forward: number[] };

type Mover = {
  pivot: THREE.Object3D;
  action: THREE.AnimationAction;
  duration: number;
  rest: Pose;
  /** The pose last fitted to its slot (kept for the way back, once the slot has gone). */
  present: Pose | null;
  /** Its opened bake: asked for (on its first open), and in the material (mixed in only then). */
  requested: boolean;
  loaded: boolean;
  /** The part its face lies on (the badge's and the card's backs), if any. */
  facePart: THREE.Object3D | null;
};

const poseOf = (o: THREE.Object3D): Pose => ({
  position: o.position.toArray() as Vec3,
  quaternion: o.quaternion.toArray() as Pose['quaternion'],
});
const clipMsOf = (id: OpenedId) => (isMover(id) ? POSES[id].clipMs : 0);

export type Setup = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  materials: Mats;
  statics: THREE.ShaderMaterial[];
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  invalidate: () => void;
  /** The object already out when the scene mounts (a direct load): it starts out, unanimated. */
  initial: OpenedId | null;
};

/**
 * Every coming-forward and leaning-in moment of the live scene, outside React: the nine movers'
 * poses, clips and materials, the lean-ins' travel (the camera reads it), the dimming, the phone
 * screen's video and the faces laid on the live badge and card. Movers drives it from effects
 * (setOpen) and from each rendered frame (fit). Test hooks on the canvas, written here: data-open,
 * data-travel and data-clip (the open or last moved), data-travel-<id> for all twelve, data-dim
 * and data-dim-<mover>, data-settled, data-fit, data-open-mix, data-textures, and data-spin and
 * data-spin-turn (the visitor's spin: turning or at rest, and how far it is turned, in radians).
 */
export class MomentRig {
  private mixer: THREE.AnimationMixer;
  private movers: Record<MoverId, Mover>;
  private moments: Record<OpenedId, Moment>;
  private open: OpenedId | null;
  private last: OpenedId | null;
  /** Whether the open mover's face (if it has one) is laid on it: part of data-settled. */
  private facePlaced = false;
  /** When each lean-in was last opened (a counter): the camera folds them in this order. */
  private openedAt: Record<LeanId, number> = { monitor: 0, cv: 0, board: 0, diploma: 0 };
  private opens = 0;
  /** Each lean-in's last art box, kept for its way back once its slot has gone. */
  private leanBoxes = new Map<LeanId, DOMRect>();
  private raf = 0;
  private alive = true;
  private video: { el: HTMLVideoElement; tex: THREE.VideoTexture } | null = null;
  private ray = new THREE.Vector3();
  private corner = new THREE.Vector3();
  /** Each spinnable's centre in its own axes: it spins about that, not about its pivot. */
  private centres = new Map<MoverId, THREE.Vector3>();
  private unspin: () => void;

  constructor(private s: Setup) {
    this.mixer = new THREE.AnimationMixer(s.scene);
    this.open = this.last = s.initial;
    if (s.initial && isLean(s.initial)) this.openedAt[s.initial] = ++this.opens;
    this.moments = Object.fromEntries(
      OPENED_IDS.map((id) => [id, id === s.initial ? OUT : REST]),
    ) as Record<OpenedId, Moment>;
    this.movers = Object.fromEntries(
      MOVER_IDS.map((id) => {
        const pivot = s.scene.getObjectByName(`obj_${id}`)!;
        const clip = s.animations.find((a) => a.name === POSES[id].clip)!;
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        const face = POSES[id].face;
        const m: Mover = {
          pivot,
          action,
          duration: clip.duration,
          rest: poseOf(pivot),
          present: null,
          requested: false,
          loaded: false,
          facePart: face ? (s.scene.getObjectByName(face.part) ?? null) : null,
        };
        return [id, m];
      }),
    ) as Record<MoverId, Mover>;
    s.scene.traverse((o) => {
      const key = o instanceof THREE.Mesh ? meshKey(o.name, o.parent?.name) : undefined;
      if (key) (o as THREE.Mesh).material = s.materials[key];
    });
    for (const id of MOVER_IDS) {
      if (!isSpin(id)) continue;
      const pivot = this.movers[id].pivot;
      pivot.updateMatrixWorld(true);
      const centre = new THREE.Box3().setFromObject(pivot).getCenter(new THREE.Vector3());
      this.centres.set(id, pivot.worldToLocal(centre));
    }
    // A spin redraws the scene; data-spin tells tests whether it is still turning.
    this.unspin = spinLive.subscribe(() => {
      const live = spinLive.get();
      s.canvas.dataset.spin = live && !live.spin.atRest ? 'moving' : 'rest';
      const w = live ? Math.min(1, Math.abs(live.spin.q[3])) : 1;
      s.canvas.dataset.spinTurn = (2 * Math.acos(w)).toFixed(2);
      s.invalidate();
    });
    if (s.initial && isMover(s.initial)) this.loadBake(s.initial);
    this.syncVideo();
    this.apply();
    s.invalidate();
  }

  /** What's open now: the moments move toward it on each animation frame until they settle. */
  setOpen(open: OpenedId | null) {
    if (open !== this.open) this.facePlaced = false;
    this.open = open;
    if (open) {
      this.last = open;
      if (isMover(open)) this.loadBake(open);
      if (isLean(open)) this.openedAt[open] = ++this.opens;
    }
    this.syncVideo();
    cancelAnimationFrame(this.raf);
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = now - prev;
      prev = now;
      // Keep going until every moment has reached where it's headed (not "until a step changed
      // nothing": a frame's timestamp can precede the call, so the first step may be empty).
      let moving = false;
      for (const id of OPENED_IDS) {
        const m = (this.moments[id] = stepMoment(
          this.moments[id],
          this.open === id,
          dt,
          clipMsOf(id),
        ));
        const goal = this.open === id ? OUT : REST;
        if (m.travel !== goal.travel || m.clip !== goal.clip) moving = true;
      }
      this.syncVideo();
      this.apply();
      this.s.invalidate();
      this.raf = moving ? requestAnimationFrame(tick) : 0;
    };
    this.apply();
    this.raf = requestAnimationFrame(tick);
  }

  /** Each lean-in on its way (eased travel above 0), in the order they were last opened. */
  lean(): { id: LeanId; k: number }[] {
    return foldOrder(
      LEAN_IDS.map((id) => ({ id, k: easeOutCubic(this.moments[id].travel) })).filter(
        (l) => l.k > 0,
      ),
      this.openedAt,
    );
  }

  /** Each rendered frame: fit every mover to its slot (.opened__art) through the live camera. */
  fit(cam: THREE.PerspectiveCamera, view: { width: number; height: number }) {
    this.s.canvas.dataset.textures = String(this.s.renderer.info.memory.textures);
    const c = this.s.canvas.getBoundingClientRect();
    const focalPx = (cam.projectionMatrix.elements[5]! * view.height) / 2;
    for (const id of MOVER_IDS) {
      const m = this.movers[id];
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
            forward: POSES.forward as Vec3,
            canonical: POSES[id].pose as Pose,
            d0: POSES[id].d0,
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
          artOf(id).theta * POSES[id].d0,
          view,
        );
        m.present = seen > 0 ? fitTo((box.height * box.height) / seen) : first;
        if (id === (this.open ?? this.last)) this.s.canvas.dataset.fit = box.height.toFixed(1);
      }
      const k = easeOutCubic(this.moments[id].travel);
      let pose = k > 0 && m.present ? blendPose(m.rest, m.present, k) : m.rest;
      const live = spinLive.get();
      const local = this.centres.get(id);
      if (k > 0 && local && live?.id === id)
        pose = this.spun(pose, local, new THREE.Quaternion(...live.spin.q), cam);
      m.pivot.position.fromArray(pose.position);
      m.pivot.quaternion.fromArray(pose.quaternion);
    }
    this.fitLean(c);
    this.placeFace(cam, c);
    this.writeSettled();
  }

  /**
   * The lean-ins' art boxes: data-fit for the open one, and the hole in the dim (drawing-buffer px)
   * over the latest lean-in on its way, opened as far as it has travelled, so it fades in and out
   * with the move (a closing lean-in keeps its last box).
   */
  private fitLean(c: DOMRect) {
    for (const id of LEAN_IDS) {
      const box = document
        .querySelector<HTMLElement>(`.opened[data-id="${id}"]:not([data-leaving]) .opened__art`)
        ?.getBoundingClientRect();
      if (box && box.height > 0) {
        this.leanBoxes.set(id, box);
        if (id === this.open) this.s.canvas.dataset.fit = box.height.toFixed(1);
      }
    }
    const lean = holeOf(this.lean());
    const box = lean ? this.leanBoxes.get(lean.id) : undefined;
    const dpr = this.s.renderer.getPixelRatio();
    const hole = new THREE.Vector4(0, 0, 0, 0);
    let feather = 0;
    if (box) {
      const H = c.height;
      hole.set(
        (box.left - c.left) * dpr,
        (H - (box.bottom - c.top)) * dpr,
        (box.right - c.left) * dpr,
        (H - (box.top - c.top)) * dpr,
      );
      feather = LEAN_FEATHER * Math.min(box.width, box.height) * dpr;
    }
    for (const mat of this.dimmed()) {
      (mat.uniforms.dimClear!.value as THREE.Vector4).copy(hole);
      mat.uniforms.dimFeather!.value = feather;
      mat.uniforms.dimClearK!.value = box && lean ? lean.k : 0;
    }
  }

  private dimmed(): THREE.ShaderMaterial[] {
    const { materials, statics } = this.s;
    return [...statics, ...MOVER_IDS.map((id) => materials[id]), materials.phoneScreen].filter(
      (m) => m.uniforms.dimClear,
    );
  }

  /**
   * A pose turned by the visitor's spin: the spin is in screen axes, so it is carried into the
   * pivot's parent's axes through the camera, and turns the object about its own centre.
   */
  private spun(
    pose: Pose,
    local: THREE.Vector3,
    q: THREE.Quaternion,
    cam: THREE.PerspectiveCamera,
  ) {
    const parent = this.movers.car.pivot.parent;
    const toParent = parent
      ? parent.getWorldQuaternion(new THREE.Quaternion()).invert()
      : new THREE.Quaternion();
    const view = toParent.multiply(cam.getWorldQuaternion(new THREE.Quaternion()));
    const world = view.clone().multiply(q).multiply(view.clone().invert());
    const centre = local
      .clone()
      .applyQuaternion(new THREE.Quaternion(...pose.quaternion))
      .add(new THREE.Vector3(...pose.position));
    return spunPose(pose, centre.toArray() as Vec3, world);
  }

  dispose() {
    this.unspin();
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.dropVideo();
    this.clearFace();
    for (const s of this.s.statics) {
      s.uniforms.dim!.value = 0;
      if (s.uniforms.residualWeight) s.uniforms.residualWeight.value = 1;
    }
  }

  /**
   * Once the open mover with a face (the badge, the card) is out, project its face's corners
   * through the camera and lay the HTML face on them (quadMatrix3d), relative to its own box.
   */
  private placeFace(cam: THREE.PerspectiveCamera, c: DOMRect) {
    const id = this.open;
    const m = id && isMover(id) ? this.movers[id] : null;
    const corners = id && isMover(id) ? POSES[id].face?.corners : undefined;
    const out = id ? this.moments[id].travel === 1 && this.moments[id].clip === 1 : false;
    if (!m?.facePart || !corners || !out) return this.clearFace();
    const face = document.querySelector<HTMLElement>(`.opened__face[data-face="${id}"]`);
    const art = face?.parentElement;
    if (!face || !art) return;
    m.pivot.updateMatrixWorld(true);
    const a = art.getBoundingClientRect();
    const [ox, oy] = [a.left + face.offsetLeft, a.top + face.offsetTop];
    const quad = corners.map((p) => {
      this.corner.fromArray(p).applyMatrix4(m.facePart!.matrixWorld).project(cam);
      return [
        c.left + ((this.corner.x + 1) / 2) * c.width - ox,
        c.top + ((1 - this.corner.y) / 2) * c.height - oy,
      ] as Pt;
    });
    // keep faceBox's flat transform to put back on close
    face.dataset.flat ??= face.style.transform;
    face.style.transform = quadMatrix3d(face.offsetWidth, face.offsetHeight, quad);
    face.dataset.live = '';
    this.facePlaced = true;
  }

  private clearFace() {
    for (const f of document.querySelectorAll<HTMLElement>('.opened__face[data-live]')) {
      f.style.transform = f.dataset.flat ?? '';
      delete f.dataset.live;
    }
    this.facePlaced = false;
  }

  /**
   * data-settled: the open mover, once it is out and its face (if any) is laid on it; or the open
   * lean-in, once the camera has arrived.
   */
  private writeSettled() {
    const id = this.open;
    const out = !!id && this.moments[id].travel === 1 && this.moments[id].clip === 1;
    const ok =
      out && (isLean(id!) || (isMover(id!) && (!this.movers[id].facePart || this.facePlaced)));
    if (ok) this.s.canvas.dataset.settled = id;
    else delete this.s.canvas.dataset.settled;
  }

  /** Materials, clips and test hooks from the moments. */
  private apply() {
    const { materials, statics, canvas } = this.s;
    const eased = Object.fromEntries(
      OPENED_IDS.map((id) => [id, easeOutCubic(this.moments[id].travel)]),
    ) as Record<OpenedId, number>;
    const dims = dimsFor(eased);
    for (const id of MOVER_IDS) {
      const m = this.movers[id];
      const k = eased[id];
      const clip = this.moments[id].clip;
      const mats = id === 'phone' ? [materials.phone, materials.phoneScreen] : [materials[id]];
      for (const mat of mats) {
        // The residual is exact only where the object rests; it fades off it as it lifts.
        if (mat.uniforms.residualWeight) mat.uniforms.residualWeight.value = 1 - k;
        if (mat.uniforms.dim) mat.uniforms.dim.value = dims.movers[id];
      }
      // Until its opened bake has arrived the placeholder is black: keep the rest bake showing.
      materials[id].uniforms.openMix!.value = m.loaded ? clip : 0;
      m.action.time = clip * m.duration;
      canvas.dataset[`dim${cap(id)}`] = dims.movers[id].toFixed(2);
    }
    for (const id of OPENED_IDS)
      canvas.dataset[`travel${cap(id)}`] = this.moments[id].travel.toFixed(2);
    materials.phoneScreen.uniforms.openMix!.value = this.video ? this.moments.phone.clip : 0;
    // The seat's residual holds only from the seat: it fades as the view leans in.
    const lean = Math.max(0, ...LEAN_IDS.map((id) => eased[id]));
    for (const s of statics) {
      s.uniforms.dim!.value = dims.statics;
      if (s.uniforms.residualWeight) s.uniforms.residualWeight.value = 1 - lean;
    }
    this.mixer.update(0);
    const shown = this.open ?? this.last ?? 'kit';
    canvas.dataset.open = this.open ?? '';
    canvas.dataset.travel = this.moments[shown].travel.toFixed(2);
    canvas.dataset.clip = this.moments[shown].clip.toFixed(2);
    canvas.dataset.dim = dims.statics.toFixed(2);
    const mix = isMover(shown) ? (materials[shown].uniforms.openMix!.value as number) : 0;
    canvas.dataset.openMix = mix.toFixed(2);
    this.writeSettled();
  }

  /** The opened bake loads the first time its mover comes out (on demand). */
  private loadBake(id: MoverId) {
    const m = this.movers[id];
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
