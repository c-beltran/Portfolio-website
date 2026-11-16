import { ART_PALETTE as C } from '@/lib/artPalette';
import { objectBySlug } from '@/content/objects';
import { ArtSvg, label } from './svg';

export function Polaroid() {
  const o = objectBySlug('about')!;
  return (
    <ArtSvg id="photo" sticker={{ x: -6, y: -8, rot: -4, text: label(o.label) }}>
      <rect x={0} y={0} width={100} height={117.6} fill={C.paper} />
      <rect x={7} y={7} width={86} height={86} fill={C.photo} />
      <text x={50} y={53} textAnchor="middle" fontSize={8} fontWeight={600} fill={C.ink}>
        {o.face[0]}
      </text>
    </ArtSvg>
  );
}
