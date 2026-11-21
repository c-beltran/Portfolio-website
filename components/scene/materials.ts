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
   * The residual (M3c): the Tier 1 still minus the live render, both at the seat's rest pose, in
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
   * Coming forward (design 2026-11-19 §4.1): a `dim` uniform (0–1) that darkens the output toward
   * DIM_LEVEL while an object is out (the static scene; Tier 1's CSS brightness() matches it).
   */
  dim?: true;
  /**
   * The opened-pose bake of a mover (design §6): `openDay` and `openLamp` (black 1×1 until they
   * load) mixed over the rest bake by `openMix` (0–1) after the day/lamp fade.
   */
  opened?: true;
};

/** A black 1×1 standing in for a bake that hasn't loaded. */
function black(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

/** Hand a mover's opened bake to its material once it has loaded. */
export function setOpenedBake(m: THREE.ShaderMaterial, day: THREE.Texture, lamp: THREE.Texture) {
  lightmap(day);
  lightmap(lamp);
  m.uniforms.openDay!.value = day;
  m.uniforms.openLamp!.value = lamp;
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
  if (opts.dim) uniforms.dim = { value: 0 };
  if (opts.opened)
    Object.assign(uniforms, {
      openDay: { value: black() },
      openLamp: { value: black() },
      openMix: { value: 0 },
    });
  const world = !!(probe || residual);
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
    ...(opts.dim ? ['uniform float dim;'] : []),
    ...(opts.opened
      ? ['uniform sampler2D openDay;', 'uniform sampler2D openLamp;', 'uniform float openMix;']
      : []),
    'varying vec2 vUv;',
    ...(world ? ['varying vec3 vWorld;'] : []),
    'void main() {',
    '  vec4 base = mix(texture2D(day, vUv), texture2D(lamp, vUv), fade);',
    ...(opts.opened
      ? [
          '  base = mix(base, mix(texture2D(openDay, vUv), texture2D(openLamp, vUv), fade), openMix);',
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
    ...(opts.dim ? [`  base.rgb *= 1.0 - ${(1 - DIM_LEVEL).toFixed(2)} * dim;`] : []),
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

/**
 * Glass and water (no real-time transmission, spec §6): a faint tint plus the probe's reflection,
 * strongest at the rim. Their meshes are upright cylinders, so the normal is radial from the
 * vertical axis through `center` (set from the mesh's bounds).
 */
export function glassMaterial(probe: Probe, tint: THREE.Color, fill: number, strength = 1) {
  probe.forEach(probeMap);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      probeDay: { value: probe[0] },
      probeLamp: { value: probe[1] },
      fade: { value: 0 },
      tint: { value: tint },
      fill: { value: fill },
      strength: { value: strength },
      center: { value: new THREE.Vector3() },
    },
    vertexShader: VERTEX,
    fragmentShader: [
      'uniform vec3 tint;',
      'uniform float fill;',
      'uniform float strength;',
      'uniform vec3 center;',
      PROBE_GLSL,
      'varying vec2 vUv;',
      'varying vec3 vWorld;',
      'void main() {',
      '  vec3 v = normalize(vWorld - cameraPosition);',
      '  vec3 n = normalize(vec3(vWorld.x - center.x, 0.0, vWorld.z - center.z));',
      '  if (dot(n, v) > 0.0) n = -n;',
      '  float f = strength * schlick(dot(-v, n));',
      '  vec3 env = probe(reflect(v, n), 1.0);',
      '  float a = clamp(fill + f, 0.0, 1.0);',
      '  gl_FragColor = vec4((tint * fill + env * f) / max(a, 1e-3), a);',
      '  #include <colorspace_fragment>',
      '}',
    ].join('\n'),
  });
}
