import * as THREE from 'three';
import { DIM_LEVEL } from '@/content/opened';

type Probe = [day: THREE.Texture, lamp: THREE.Texture];

export type ProbeOptions = {
  /** The baked reflection probe (scripts/scene/probe.py), day and lamp. */
  probe?: Probe;
  /** The group's roughness on its bake UVs (bake.py's gloss-<group>): blurs and weakens it. */
  gloss?: THREE.Texture;
  /** Reflection strength in day mode, and in lamp mode (cross-faded with the bake). */
  strength?: number;
  strengthLamp?: number;
  /**
   * The residual: the Tier 1 still minus the live render, both at the seat's rest pose, in
   * the seat master's image space (scripts/scene/measure/residual.mjs). Projected from the seat
   * onto this geometry and added in sRGB, it closes the gap between the live scene and the still.
   */
  residual?: {
    day: THREE.Texture;
    lamp: THREE.Texture;
    /** The seat camera at rest: projection (the full master, lens shift included) × view. */
    viewProj: THREE.Matrix4;
    weight?: number;
  };
  /**
   * Coming forward: a `dim` uniform (0–1) that darkens the output toward
   * DIM_LEVEL while an object is out (the static scene; Tier 1's CSS brightness() matches it).
   */
  dim?: true;
  /**
   * The opened-pose bake of a mover: `openDay` and `openLamp` (black 1×1 until they
   * load) mixed over the rest bake by `openMix` (0–1) after the day/lamp fade.
   */
  opened?: true;
  /**
   * The window's weather (the sky only): `weatherMap` (the painter's canvas) laid over the bake
   * inside `weatherRect` (its patch on the plane's UVs: u0, v0, u1, v1, v down) by `weatherMix`.
   */
  weather?: true;
  /**
   * The room's light, as Tier 1's CSS layers lay it over the still, in the seat master's space
   * (lightViewProj): moonlight multiplied in by moonK, the weather's tint (stronger toward the
   * window: tintSide is the master x where it is full, then where it is down to tintFar) by tintK,
   * then the lamp's pool screened on by poolK. In sRGB, as CSS blends.
   */
  light?: true;
};

/** A black 1×1 standing in for a bake that hasn't loaded. */
function black(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

/**
 * Hand a mover's opened bake to its material once it has loaded, or a video (the phone's clip).
 * three uploads video textures linear and decodes them only in its own materials, so the shader
 * decodes a video from sRGB itself (openDecode).
 */
export function setOpenedBake(m: THREE.ShaderMaterial, day: THREE.Texture, lamp: THREE.Texture) {
  lightmap(day);
  lightmap(lamp);
  m.uniforms.openDay!.value = day;
  m.uniforms.openLamp!.value = lamp;
  m.uniforms.openDecode!.value = (day as THREE.VideoTexture).isVideoTexture ? 1 : 0;
}

function lightmap(t: THREE.Texture) {
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  // The monitor model's screen UVs run outside 0–1 (Blender repeats images by default).
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
}

function probeMap(t: THREE.Texture) {
  // Equirectangular, top row up (the image as rendered), mipmapped: roughness picks the level.
  t.flipY = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
}

function residualMap(t: THREE.Texture) {
  // Raw differences, image top row up (as encoded); sampled 1:1-ish, so no mipmaps.
  t.flipY = true;
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
}

/** d = (texel − ½)·2 of the seat's view of this point, added to the colour in sRGB. */
const RESIDUAL_GLSL = [
  'uniform sampler2D residualDay;',
  'uniform sampler2D residualLamp;',
  'uniform mat4 seatViewProj;',
  'uniform float residualWeight;',
  'vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }',
  'vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }',
  'vec3 residual(vec3 base, vec3 world) {',
  '  vec4 clip = seatViewProj * vec4(world, 1.0);',
  '  if (clip.w <= 0.0) return base;',
  // Past the master (the glance looks a little beyond it), the edge's residual carries on.
  '  vec2 uv = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);',
  '  vec3 d = (mix(texture2D(residualDay, uv).rgb, texture2D(residualLamp, uv).rgb, fade) - 0.5) * 2.0;',
  '  return toLinear(clamp(toSRGB(max(base, 0.0)) + d * residualWeight, 0.0, 1.0));',
  '}',
].join('\n');

const VERTEX_PLAIN = [
  'varying vec2 vUv;',
  'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
].join('\n');

const VERTEX = [
  'varying vec2 vUv;',
  'varying vec3 vWorld;',
  'void main() {',
  '  vUv = uv;',
  '  vec4 w = modelMatrix * vec4(position, 1.0);',
  '  vWorld = w.xyz;',
  '  gl_Position = projectionMatrix * viewMatrix * w;',
  '}',
].join('\n');

/**
 * The probe lookup: a three.js direction (Y up) into probe.py's panorama, whose centre looks
 * along Blender +Y (three −Z) with Blender +X (three +X) to the right.
 */
const PROBE_GLSL = [
  'uniform sampler2D probeDay;',
  'uniform sampler2D probeLamp;',
  'uniform float fade;',
  'vec3 probe(vec3 r, float lod) {',
  '  vec2 uv = vec2(0.5 + atan(r.x, -r.z) / 6.28318531, 0.5 + asin(clamp(r.y, -1.0, 1.0)) / 3.14159265);',
  '  return mix(textureLod(probeDay, uv, lod).rgb, textureLod(probeLamp, uv, lod).rgb, fade);',
  '}',
  'float schlick(float cosTheta) { return 0.04 + 0.96 * pow(1.0 - clamp(cosTheta, 0.0, 1.0), 5.0); }',
].join('\n');

/**
 * Unlit, baked: shows the Cycles bake as is, cross-fading day → lamp by `fade`. With a probe it
 * adds the view-dependent reflection a bake can't hold (the desk's sheen, the phone's glass),
 * Fresnel-weighted, blurred by roughness. Normals come from screen derivatives (flat faces), so
 * the GLB carries none.
 */
export function bakedMaterial(day: THREE.Texture, lamp: THREE.Texture, opts: ProbeOptions = {}) {
  lightmap(day);
  lightmap(lamp);
  const uniforms: Record<string, THREE.IUniform> = {
    day: { value: day },
    lamp: { value: lamp },
    fade: { value: 0 },
  };
  const { probe, gloss, residual } = opts;
  if (probe) {
    probe.forEach(probeMap);
    if (gloss) {
      gloss.flipY = false;
      gloss.colorSpace = THREE.NoColorSpace;
    }
    Object.assign(uniforms, {
      probeDay: { value: probe[0] },
      probeLamp: { value: probe[1] },
      gloss: { value: gloss ?? null },
      strength: { value: opts.strength ?? 1 },
      strengthLamp: { value: opts.strengthLamp ?? 0 },
    });
  }
  if (residual) {
    residualMap(residual.day);
    residualMap(residual.lamp);
    Object.assign(uniforms, {
      residualDay: { value: residual.day },
      residualLamp: { value: residual.lamp },
      seatViewProj: { value: residual.viewProj },
      residualWeight: { value: residual.weight ?? 1 },
    });
  }
  if (opts.dim)
    Object.assign(uniforms, {
      dim: { value: 0 },
      // A lean-in's art box (drawing-buffer px, y up) left undimmed, feathered by dimFeather px.
      dimClear: { value: new THREE.Vector4(0, 0, 0, 0) },
      dimFeather: { value: 0 },
      // How open the hole is (its lean-in's eased travel), so it fades in and out with the move.
      dimClearK: { value: 0 },
    });
  if (opts.opened)
    Object.assign(uniforms, {
      openDay: { value: black() },
      openLamp: { value: black() },
      openMix: { value: 0 },
      openDecode: { value: 0 },
    });
  if (opts.weather)
    Object.assign(uniforms, {
      weatherMap: { value: black() },
      weatherMix: { value: 0 },
      weatherRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    });
  if (opts.light)
    Object.assign(uniforms, {
      tintRgb: { value: new THREE.Vector3(1, 1, 1) },
      tintK: { value: 0 },
      tintSide: { value: new THREE.Vector2(1, 0) },
      tintFar: { value: 1 },
      moonK: { value: 0 },
      moonRgb: { value: new THREE.Vector3(1, 1, 1) },
      poolK: { value: 0 },
      poolAt: { value: new THREE.Vector2(0.5, 0.5) },
      poolR: { value: new THREE.Vector2(0.2, 0.2) },
      poolRgb: { value: new THREE.Vector3(1, 1, 1) },
      lightViewProj: { value: new THREE.Matrix4() },
      // The screens keep their own light: master rects (x0, y0, x1, y1); zero-area ones keep nothing.
      lightKeep: { value: [0, 1, 2].map(() => new THREE.Vector4(0, 0, 0, 0)) },
    });
  const world = !!(probe || residual || opts.light);
  const fragment = [
    'uniform sampler2D day;',
    'uniform sampler2D lamp;',
    ...(probe
      ? [
          'uniform sampler2D gloss;',
          'uniform float strength;',
          'uniform float strengthLamp;',
          PROBE_GLSL,
        ]
      : ['uniform float fade;']),
    ...(residual ? [RESIDUAL_GLSL] : []),
    ...(opts.dim
      ? [
          'uniform float dim;',
          'uniform vec4 dimClear;',
          'uniform float dimFeather;',
          'uniform float dimClearK;',
        ]
      : []),
    ...(opts.opened
      ? [
          'uniform sampler2D openDay;',
          'uniform sampler2D openLamp;',
          'uniform float openMix;',
          'uniform float openDecode;',
        ]
      : []),
    ...(opts.weather
      ? ['uniform sampler2D weatherMap;', 'uniform float weatherMix;', 'uniform vec4 weatherRect;']
      : []),
    ...(opts.light
      ? [
          'uniform vec3 tintRgb;',
          'uniform float tintK;',
          'uniform vec2 tintSide;',
          'uniform float tintFar;',
          'uniform float moonK;',
          'uniform vec3 moonRgb;',
          'uniform float poolK;',
          'uniform vec2 poolAt;',
          'uniform vec2 poolR;',
          'uniform vec3 poolRgb;',
          'uniform mat4 lightViewProj;',
          'uniform vec4 lightKeep[3];',
          'float keepAt(vec2 m, vec4 r) {',
          '  if (r.z <= r.x || r.w <= r.y) return 0.0;',
          '  vec2 lo = smoothstep(r.xy - 0.004, r.xy + 0.004, m);',
          '  vec2 hi = 1.0 - smoothstep(r.zw - 0.004, r.zw + 0.004, m);',
          '  return lo.x * lo.y * hi.x * hi.y;',
          '}',
        ]
      : []),
    'varying vec2 vUv;',
    ...(world ? ['varying vec3 vWorld;'] : []),
    'void main() {',
    '  vec4 base = mix(texture2D(day, vUv), texture2D(lamp, vUv), fade);',
    ...(opts.opened
      ? [
          '  vec4 opened = mix(texture2D(openDay, vUv), texture2D(openLamp, vUv), fade);',
          '  if (openDecode > 0.5) opened = sRGBTransferEOTF(opened);',
          '  base = mix(base, opened, openMix);',
        ]
      : []),
    ...(probe
      ? [
          '  vec3 v = normalize(vWorld - cameraPosition);',
          '  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));',
          '  if (dot(n, v) > 0.0) n = -n;',
          '  float rough = texture2D(gloss, vUv).r;',
          '  vec3 env = probe(reflect(v, n), rough * 7.0);',
          '  base.rgb += mix(strength, strengthLamp, fade) * schlick(dot(-v, n)) * (1.0 - rough) * env;',
        ]
      : []),
    ...(residual ? ['  base.rgb = residual(base.rgb, vWorld);'] : []),
    ...(opts.weather
      ? [
          '  vec2 wl = (vUv - weatherRect.xy) / (weatherRect.zw - weatherRect.xy);',
          '  float inW = step(0.0, wl.x) * step(wl.x, 1.0) * step(0.0, wl.y) * step(wl.y, 1.0);',
          '  base = mix(base, texture2D(weatherMap, wl), weatherMix * inW);',
        ]
      : []),
    ...(opts.light
      ? [
          '  vec4 lc = lightViewProj * vec4(vWorld, 1.0);',
          '  vec2 m = lc.xy / lc.w * 0.5 + 0.5;',
          '  m.y = 1.0 - m.y;',
          '  vec3 s = sRGBTransferOETF(base).rgb;',
          '  s *= mix(vec3(1.0), moonRgb, moonK);',
          '  float side = clamp((m.x - tintSide.y) / (tintSide.x - tintSide.y), 0.0, 1.0);',
          '  vec3 tintHere = mix(mix(vec3(1.0), tintRgb, tintFar), tintRgb, side);',
          '  s *= mix(vec3(1.0), tintHere, tintK);',
          '  vec3 pool = poolRgb * 0.5 * (1.0 - clamp(length((m - poolAt) / poolR), 0.0, 1.0)) * poolK;',
          '  s = 1.0 - (1.0 - s) * (1.0 - pool);',
          '  float keep = max(keepAt(m, lightKeep[0]), max(keepAt(m, lightKeep[1]), keepAt(m, lightKeep[2])));',
          '  base.rgb = mix(sRGBTransferEOTF(vec4(s, 1.0)).rgb, base.rgb, keep);',
        ]
      : []),
    // In sRGB, as CSS brightness() dims the Tier 1 still, so the two tiers dim alike.
    ...(opts.dim
      ? [
          '  float dimHere = dim;',
          '  if (dimClear.z > dimClear.x && dimClear.w > dimClear.y) {',
          '    vec2 p = gl_FragCoord.xy;',
          '    vec2 lo = smoothstep(dimClear.xy, dimClear.xy + dimFeather, p);',
          '    vec2 hi = 1.0 - smoothstep(dimClear.zw - dimFeather, dimClear.zw, p);',
          '    dimHere *= 1.0 - dimClearK * lo.x * lo.y * hi.x * hi.y;',
          '  }',
          `  base.rgb = sRGBTransferEOTF(vec4(sRGBTransferOETF(base).rgb * (1.0 - ${(1 - DIM_LEVEL).toFixed(2)} * dimHere), 1.0)).rgb;`,
        ]
      : []),
    '  gl_FragColor = base;',
    '  #include <colorspace_fragment>',
    '}',
  ];
  return new THREE.ShaderMaterial({
    // Cycles shades both sides of a face; some imported faces (the monitor screen) wind backwards.
    side: THREE.DoubleSide,
    uniforms,
    vertexShader: world ? VERTEX : VERTEX_PLAIN,
    fragmentShader: fragment.join('\n'),
  });
}
