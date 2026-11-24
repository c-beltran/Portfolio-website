import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  lightFor,
  MOON_RGB,
  POOL,
  SCREENS,
  TINT_FAR_SHARE,
  WINDOW_SIDE,
} from '@/content/weather/light';
import type { Lamp, Render, Time } from '@/lib/light';
import { useMotion } from '@/lib/useMotion';
import { reducedMotion, weatherHeld } from '@/lib/weather/hold';
import { createPainter, motionFps } from '@/lib/weather/painter';
import { PATCH_ASPECT, SKY_RECT_GLTF } from '@/lib/weather/patch';
import type { Sky } from '@/lib/weather/types';

/** The live sky's canvas width: the window is a part of the frame, and the plane is filtered. */
const SKY_W = 1024;
/** The still frame under reduced motion (as Tier 1's). */
const STILL_T = 4000;
const MIX_MS = 600;
const TINT_MS = 2000;
const LAMP_MS = 600;

/** Write a uniform (three's materials are mutable by design; kept out of the hook's body). */
function setU(m: THREE.ShaderMaterial, name: string, value: unknown) {
  m.uniforms[name]!.value = value;
}
const setData = (el: HTMLElement, key: string, value: string) => void (el.dataset[key] = value);

const rgb = (v: readonly number[]) => new THREE.Vector3(v[0]! / 255, v[1]! / 255, v[2]! / 255);

/**
 * The live desk's window and light: the window's weather drawn by the same painter as the still's,
 * as the sky's texture (the depth buffer keeps the monitor, light bar and plant in front, and it
 * stays put as the camera moves), and the room's light eased onto every lit material's uniforms.
 * Exposes data-weather-mix, data-tint, data-moon and data-pool on the canvas.
 */
export function useSkyAndLight(o: {
  sky: Sky | null;
  render: Render;
  lamp: Lamp;
  time: Time;
  skyMaterial: THREE.ShaderMaterial;
  lit: THREE.ShaderMaterial[];
  viewProj: THREE.Matrix4;
  canvas: HTMLCanvasElement;
  invalidate: () => void;
}) {
  const { sky, render, lamp, time, skyMaterial, lit, viewProj, canvas, invalidate } = o;
  const { paused } = useMotion();
  const live = useRef({ sky, paused });
  useEffect(() => {
    live.current = { sky, paused };
  }, [sky, paused]);

  // The light's constants, once.
  useEffect(() => {
    for (const m of lit) {
      setU(m, 'moonRgb', rgb(MOON_RGB));
      setU(m, 'poolRgb', rgb(POOL.rgb));
      setU(m, 'poolAt', new THREE.Vector2(...POOL.at));
      setU(m, 'poolR', new THREE.Vector2(...POOL.r));
      setU(m, 'tintSide', new THREE.Vector2(WINDOW_SIDE.from, WINDOW_SIDE.to));
      setU(m, 'tintFar', TINT_FAR_SHARE);
      setU(m, 'lightViewProj', viewProj);
      setU(
        m,
        'lightKeep',
        SCREENS.map((b) => new THREE.Vector4(b.x0, b.y0, b.x1, b.y1)),
      );
    }
    setU(skyMaterial, 'weatherRect', new THREE.Vector4(...SKY_RECT_GLTF));
    invalidate();
  }, [lit, skyMaterial, viewProj, invalidate]);

  // The light eases to where the sky, the render and the lamp put it.
  const target = useMemo(() => lightFor(sky, render, lamp, time), [sky, render, lamp, time]);
  const first = useRef(true);
  useEffect(() => {
    const u0 = lit[0]?.uniforms;
    if (!u0) return;
    const from = first.current
      ? target
      : {
          tint: {
            rgb: (u0.tintRgb!.value as THREE.Vector3).toArray().map((v) => v * 255),
            k: u0.tintK!.value as number,
          },
          moonK: u0.moonK!.value as number,
          poolK: u0.poolK!.value as number,
        };
    first.current = false;
    const start = performance.now();
    // The tint only changes when the weather does: its colour switches as its strength rises.
    const rgbTo = rgb(target.tint.rgb);
    let id = 0;
    const step = () => {
      const t = performance.now() - start;
      const kt = Math.min(1, t / TINT_MS);
      const kl = Math.min(1, t / LAMP_MS);
      const tintK = from.tint.k + (target.tint.k - from.tint.k) * kt;
      const moonK = from.moonK + (target.moonK - from.moonK) * kl;
      const poolK = from.poolK + (target.poolK - from.poolK) * kl;
      const tintRgb = rgb(from.tint.rgb).lerp(rgbTo, kt);
      for (const m of lit) {
        setU(m, 'tintK', tintK);
        setU(m, 'tintRgb', tintRgb);
        setU(m, 'moonK', moonK);
        setU(m, 'poolK', poolK);
      }
      setData(canvas, 'tint', tintK.toFixed(2));
      setData(canvas, 'moon', moonK.toFixed(2));
      setData(canvas, 'pool', poolK.toFixed(2));
      invalidate();
      if (kt < 1 || kl < 1) id = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(id);
  }, [target, lit, canvas, invalidate]);

  // The window's weather: painted into a canvas texture only as often as the sky moves.
  const known = sky !== null;
  useEffect(() => {
    if (!known) return;
    const el = document.createElement('canvas');
    el.width = SKY_W;
    el.height = Math.round(SKY_W / PATCH_ASPECT);
    const painter = createPainter(el.getContext('2d')!, el.width, el.height);
    const tex = new THREE.CanvasTexture(el);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    setU(skyMaterial, 'weatherMap', tex);
    let raf = 0;
    let last = -Infinity;
    let prev = performance.now();
    let t = 0;
    let shownAt = -1;
    let drewStill = '';
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = live.current.sky;
      if (!s) return;
      const dt = Math.min(now - prev, 100);
      prev = now;
      let painted = false;
      if (weatherHeld(canvas, live.current.paused)) {
        const key = `${s.condition}|${s.dayness.toFixed(2)}`;
        if (drewStill !== key) {
          drewStill = key;
          painter.draw(s, reducedMotion() ? STILL_T : t, { still: true });
          painted = true;
        }
      } else {
        t += dt;
        const fps = motionFps(s, t);
        if (fps === 0) {
          // Nothing moves (a clear day between birds, fog): no upload, no re-render.
          const key = `rest|${s.condition}|${s.dayness.toFixed(2)}`;
          if (drewStill !== key) {
            drewStill = key;
            painter.draw(s, t, { still: false });
            painted = true;
          }
        } else if (now - last >= 1000 / fps) {
          last = now;
          drewStill = '';
          painter.draw(s, t, { still: false });
          painted = true;
        }
      }
      if (painted) {
        tex.needsUpdate = true;
        if (shownAt < 0) shownAt = now;
      }
      const mix = shownAt < 0 ? 0 : Math.min(1, (now - shownAt) / MIX_MS);
      if (skyMaterial.uniforms.weatherMix!.value !== mix) {
        setU(skyMaterial, 'weatherMix', mix);
        setData(canvas, 'weatherMix', mix.toFixed(2));
        painted = true;
      }
      if (painted) invalidate();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      setU(skyMaterial, 'weatherMix', 0);
      tex.dispose();
    };
  }, [known, skyMaterial, canvas, invalidate]);
}
