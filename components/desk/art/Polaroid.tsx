import { objectBySlug } from '@/content/objects';
import { Sticker } from './Sticker';
import { ArtSvg, label } from './svg';

export function Polaroid() {
  const o = objectBySlug('about')!;
  return (
    <ArtSvg id="photo">
      <rect x={0} y={0} width={100} height={117.6} fill="#FFFFFF" />
      <rect x={7} y={7} width={86} height={86} fill="#D5D9DD" />
      <text x={50} y={53} textAnchor="middle" fontSize={8} fontWeight={600} fill="#3E454B">
        {o.face[0]}
      </text>
      <Sticker x={56} y={-8} rot={4} text={label(o.label)} />
    </ArtSvg>
  );
}
