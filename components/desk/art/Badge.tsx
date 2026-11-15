import { ART_PALETTE as C } from '@/lib/artPalette';
import { objectBySlug } from '@/content/objects';
import { ArtSvg, heightOf, label } from './svg';

const H = heightOf('badge');

export function Badge() {
  const o = objectBySlug('experience')!;
  const [name, title, company, since] = o.face;
  return (
    <ArtSvg id="badge" sticker={{ x: -6, y: H - 4, rot: 6, text: label(o.label) }}>
      <rect x={43} y={-30} width={14} height={50} fill="#FFD84D" />
      <rect x={2} y={14} width={96} height={H - 16} rx={6} fill={C.paper} />
      <rect x={36} y={20} width={28} height={5} rx={2.5} fill="#15191C" />
      <rect x={12} y={32} width={76} height={68} rx={3} fill="#D5D9DD" />
      <text x={12} y={115} fontSize={11} fontWeight={800} fill={C.ink} className="art-display">
        {name}
      </text>
      <text x={12} y={126} fontSize={7} fill={C.inkMuted}>
        {title}
      </text>
      <path d={`M2 136 H98 V${H - 8} a6 6 0 0 1 -6 6 H8 a6 6 0 0 1 -6 -6 Z`} fill={C.bar} />
      <text x={12} y={149} fontSize={10} fontWeight={800} fill={C.paper} className="art-display">
        {company}
      </text>
      <text x={12} y={159} fontSize={6.5} fill={C.barInk}>
        {since}
      </text>
    </ArtSvg>
  );
}
