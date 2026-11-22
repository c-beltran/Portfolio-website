import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bakedMaterial, setOpenedBake } from './materials';

const tex = () => new THREE.Texture();

describe('bakedMaterial', () => {
  it('is the plain baked shader by default', () => {
    const m = bakedMaterial(tex(), tex());
    expect(Object.keys(m.uniforms).sort()).toEqual(['day', 'fade', 'lamp']);
  });

  it('adds the reflection probe when given one', () => {
    const m = bakedMaterial(tex(), tex(), { probe: [tex(), tex()], gloss: tex(), strength: 0.5 });
    for (const u of ['probeDay', 'probeLamp', 'gloss', 'strength', 'fade']) {
      expect(m.uniforms).toHaveProperty(u);
    }
    expect(m.uniforms.strength!.value).toBe(0.5);
  });

  it('reflects by mode: the lamp strength defaults to none', () => {
    const m = bakedMaterial(tex(), tex(), { probe: [tex(), tex()], gloss: tex(), strength: 2 });
    expect(m.uniforms.strengthLamp!.value).toBe(0);
    const lit = bakedMaterial(tex(), tex(), { probe: [tex(), tex()], strengthLamp: 0.5 });
    expect(lit.uniforms.strengthLamp!.value).toBe(0.5);
  });
});

describe('the residual (the live seat matches the still)', () => {
  const t = () => new THREE.Texture();
  it('adds the residual uniforms, weight 1 by default', () => {
    const m = bakedMaterial(t(), t(), {
      residual: { day: t(), lamp: t(), viewProj: new THREE.Matrix4() },
    });
    for (const k of ['residualDay', 'residualLamp', 'seatViewProj', 'residualWeight'])
      expect(m.uniforms).toHaveProperty(k);
    expect(m.uniforms.residualWeight!.value).toBe(1);
    expect(m.fragmentShader).toContain('residual');
  });

  it('works with the probe too', () => {
    const m = bakedMaterial(t(), t(), {
      probe: [t(), t()],
      residual: { day: t(), lamp: t(), viewProj: new THREE.Matrix4(), weight: 0.5 },
    });
    expect(m.uniforms.residualWeight!.value).toBe(0.5);
    expect(m.uniforms).toHaveProperty('probeDay');
  });

  it('clamps to the master edge instead of stopping there (no seam when the glance looks past it)', () => {
    const m = bakedMaterial(t(), t(), {
      residual: { day: t(), lamp: t(), viewProj: new THREE.Matrix4() },
    });
    expect(m.fragmentShader).toContain('clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0)');
    expect(m.fragmentShader).not.toContain('greaterThan(uv');
  });

  it('leaves the shader alone without it', () => {
    expect(bakedMaterial(t(), t()).fragmentShader).not.toContain('residual');
  });
});

describe('coming forward: the dim and the opened bake', () => {
  const t = () => new THREE.Texture();

  it('adds dim and openMix only when asked for', () => {
    const plain = bakedMaterial(t(), t());
    expect(plain.uniforms).not.toHaveProperty('dim');
    expect(plain.uniforms).not.toHaveProperty('openMix');
    const m = bakedMaterial(t(), t(), { dim: true, opened: true });
    expect(m.uniforms.dim!.value).toBe(0);
    expect(m.uniforms.openMix!.value).toBe(0);
    for (const u of ['openDay', 'openLamp']) expect(m.uniforms).toHaveProperty(u);
  });

  it('starts the opened bake black, 1×1, until it loads', () => {
    const m = bakedMaterial(t(), t(), { opened: true });
    const img = (m.uniforms.openDay!.value as THREE.DataTexture).image;
    expect([img.width, img.height]).toEqual([1, 1]);
  });

  it('at dim 0 and openMix 0 the output is the rest bake, untouched', () => {
    const m = bakedMaterial(t(), t(), { dim: true, opened: true });
    // the opened bake mixes in by openMix after the day/lamp fade; the dim scales by DIM_LEVEL
    expect(m.fragmentShader).toContain(
      'vec4 opened = mix(texture2D(openDay, vUv), texture2D(openLamp, vUv), fade);',
    );
    expect(m.fragmentShader).toContain('base = mix(base, opened, openMix);');
    // in sRGB, as CSS brightness() scales the Tier 1 still: the two dims look the same
    expect(m.fragmentShader).toContain(
      'base.rgb = sRGBTransferEOTF(vec4(sRGBTransferOETF(base).rgb * (1.0 - 0.55 * dim), 1.0)).rgb;',
    );
  });

  it('decodes a video from sRGB in the shader (three uploads video textures linear)', () => {
    const m = bakedMaterial(t(), t(), { opened: true });
    expect(m.uniforms.openDecode!.value).toBe(0);
    const video = Object.assign(t(), { isVideoTexture: true });
    setOpenedBake(m, video, video);
    expect(m.uniforms.openDecode!.value).toBe(1);
    expect(m.fragmentShader).toContain('if (openDecode > 0.5) opened = sRGBTransferEOTF(opened);');
    setOpenedBake(m, t(), t());
    expect(m.uniforms.openDecode!.value).toBe(0);
  });

  it('leaves the shader alone without them', () => {
    const f = bakedMaterial(t(), t()).fragmentShader;
    expect(f).not.toContain('openMix');
    expect(f).not.toContain('dim');
  });
});
