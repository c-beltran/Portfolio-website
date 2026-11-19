import * as THREE from 'three';

type Probe = [day: THREE.Texture, lamp: THREE.Texture];

export type ProbeOptions = {
  /** The baked reflection probe (scripts/scene/probe.py), day and lamp. */
  probe?: Probe;
  /** The group's roughness on its bake UVs (bake.py's gloss-<group>): blurs and weakens it. */
  gloss?: THREE.Texture;
  /** Reflection strength in day mode, and in lamp mode (cross-faded with the bake). */
  strength?: number;
  strengthLamp?: number;
};

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
  const { probe, gloss } = opts;
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
  const fragment = probe
    ? [
        'uniform sampler2D day;',
        'uniform sampler2D lamp;',
        'uniform sampler2D gloss;',
        'uniform float strength;',
        'uniform float strengthLamp;',
        PROBE_GLSL,
        'varying vec2 vUv;',
        'varying vec3 vWorld;',
        'void main() {',
        '  vec4 base = mix(texture2D(day, vUv), texture2D(lamp, vUv), fade);',
        '  vec3 v = normalize(vWorld - cameraPosition);',
        '  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));',
        '  if (dot(n, v) > 0.0) n = -n;',
        '  float rough = texture2D(gloss, vUv).r;',
        '  vec3 env = probe(reflect(v, n), rough * 7.0);',
        '  base.rgb += mix(strength, strengthLamp, fade) * schlick(dot(-v, n)) * (1.0 - rough) * env;',
        '  gl_FragColor = base;',
        '  #include <colorspace_fragment>',
        '}',
      ]
    : [
        'uniform sampler2D day;',
        'uniform sampler2D lamp;',
        'uniform float fade;',
        'varying vec2 vUv;',
        'void main() {',
        '  gl_FragColor = mix(texture2D(day, vUv), texture2D(lamp, vUv), fade);',
        '  #include <colorspace_fragment>',
        '}',
      ];
  return new THREE.ShaderMaterial({
    // Cycles shades both sides of a face; some imported faces (the monitor screen) wind backwards.
    side: THREE.DoubleSide,
    uniforms,
    vertexShader: probe ? VERTEX : VERTEX_PLAIN,
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
