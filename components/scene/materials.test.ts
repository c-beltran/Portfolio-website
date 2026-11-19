import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bakedMaterial, glassMaterial } from './materials';

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

describe('glassMaterial', () => {
  it('is see-through, double-sided and writes no depth', () => {
    const m = glassMaterial([tex(), tex()], new THREE.Color('#dfe8f5'), 0.1);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.side).toBe(THREE.DoubleSide);
    expect(m.uniforms).toHaveProperty('fade');
  });
});
