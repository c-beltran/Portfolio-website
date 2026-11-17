import { ART_PALETTE as C } from '@/lib/artPalette';
import { objectBySlug } from '@/content/objects';
import { ArtSvg, heightOf, label } from './svg';

const H = heightOf('card');

export function Card() {
  const o = objectBySlug('contact')!;
  const [name, title, links] = o.face;
  return (
    <ArtSvg id="card" sticker={{ x: -6, y: -10, rot: -4, text: label(o.label) }}>
      <rect x={0} y={0} width={100} height={H} rx={3} fill={C.paper} />
      <text x={8} y={18} fontSize={10} fontWeight={900} fill={C.ink} className="art-display">
        {name}
      </text>
      <text x={8} y={26} fontSize={5.5} fill={C.inkMuted}>
        {title}
      </text>
      <text x={8} y={H - 7} fontSize={5.5} fill={C.ink} className="art-mono">
        {links}
      </text>
    </ArtSvg>
  );
}
