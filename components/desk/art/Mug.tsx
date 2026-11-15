import { ArtSvg } from './svg';

/** Decoration. Steam drifts only when motion is allowed (CSS). */
export function Mug() {
  return (
    <ArtSvg id="mug">
      <path d="M86 36 h12 a12 12 0 0 1 0 28 h-12" fill="none" stroke="#E7E2D8" strokeWidth={9} />
      <circle cx={46} cy={50} r={46} fill="#E7E2D8" filter="url(#mug-shadow)" />
      <circle cx={46} cy={50} r={36} fill="#4A2E1E" />
      <circle className="steam" cx={46} cy={50} r={22} fill="#FFFFFF" fillOpacity={0.22} />
    </ArtSvg>
  );
}
