import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { artOf, LEAN_IDS } from '@/content/opened';
import { CAMERAS } from '@/content/scene/cameras';
import {
  blendCam,
  foldOrder,
  holeOf,
  leanCamera,
  leanView,
  type CamState,
  type ScreenBox,
} from './lean';

/** Where a world point lands, in canvas CSS px, through a camera state. */
function project(s: CamState, p: number[], canvas: ScreenBox): [number, number] {
  const view = new THREE.Matrix4()
    .compose(
      new THREE.Vector3(...s.position),
      new THREE.Quaternion(...s.quaternion),
      new THREE.Vector3(1, 1, 1),
    )
    .invert();
  const proj = new THREE.Matrix4().fromArray(s.projection);
  const v = new THREE.Vector3(...(p as [number, number, number]))
    .applyMatrix4(view)
    .applyMatrix4(proj);
  return [
    canvas.left + ((v.x + 1) / 2) * canvas.width,
    canvas.top + ((1 - v.y) / 2) * canvas.height,
  ];
}

const CASES: { box: ScreenBox; canvas: ScreenBox }[] = [
  {
    box: { left: 520, top: 40, width: 640, height: 533 },
    canvas: { left: 0, top: 0, width: 1280, height: 800 },
  },
  {
    box: { left: 8, top: 8, width: 374, height: 311 },
    canvas: { left: 0, top: 0, width: 390, height: 844 },
  },
];

describe('leanView', () => {
  for (const id of LEAN_IDS)
    for (const { box, canvas } of CASES)
      it(`puts ${id}'s face where its art shows it, in a ${canvas.width}×${canvas.height} canvas`, () => {
        // keep the art's aspect, as the slot does
        const b = { ...box, width: box.height * artOf(id).aspect };
        const s = leanView(id, b, canvas);
        const want = artOf(id).screen!;
        CAMERAS[id].screen!.forEach((p, i) => {
          const [x, y] = project(s, p, canvas);
          expect(
            Math.abs(x - (b.left + want[i]![0] * b.width)),
            `${id} corner ${i} x`,
          ).toBeLessThan(1);
          expect(
            Math.abs(y - (b.top + want[i]![1] * b.height)),
            `${id} corner ${i} y`,
          ).toBeLessThan(1);
        });
      });
});

describe('blending camera states', () => {
  const canvas = CASES[0]!.canvas;
  const A = leanView('monitor', { left: 100, top: 40, width: 600, height: 520 }, canvas);
  const B = leanView('cv', { left: 560, top: 40, width: 600, height: 520 }, canvas);

  it('is exact at 0 and 1', () => {
    expect(blendCam(A, B, 0)).toEqual(A);
    expect(blendCam(A, B, 1)).toEqual(B);
  });

  it('leaves the seat alone with nothing leaning', () => {
    expect(leanCamera(A, [])).toEqual(A);
  });

  it('folds the lean-ins in order: the one closing first, then the one opening', () => {
    const seat = leanView('board', { left: 300, top: 40, width: 600, height: 440 }, canvas);
    expect(
      leanCamera(seat, [
        { state: A, k: 1 },
        { state: B, k: 0 },
      ]),
    ).toEqual(A);
    expect(
      leanCamera(seat, [
        { state: A, k: 0 },
        { state: B, k: 1 },
      ]),
    ).toEqual(B);
  });
});

describe('the order lean-ins fold in', () => {
  it('keeps the order they were opened in, so closing one never reorders the blend', () => {
    // the CV opened first, then How I build; then Esc: both are closing
    const order = foldOrder(
      [
        { id: 'monitor', k: 0.7 },
        { id: 'cv', k: 0.96 },
      ],
      { cv: 1, monitor: 2, board: 0 },
    );
    expect(order.map((l) => l.id)).toEqual(['cv', 'monitor']);
  });

  it("cuts the dim's hole for the latest lean-in, as far as it has come", () => {
    expect(holeOf([])).toBeNull();
    expect(
      holeOf([
        { id: 'cv', k: 0.96 },
        { id: 'monitor', k: 0.3 },
      ]),
    ).toEqual({ id: 'monitor', k: 0.3 });
  });
});
