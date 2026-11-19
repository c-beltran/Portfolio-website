import * as THREE from 'three';

/** Unlit, baked: shows the Cycles bake as is, cross-fading day → lamp by `fade`. */
export function bakedMaterial(day: THREE.Texture, lamp: THREE.Texture) {
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
