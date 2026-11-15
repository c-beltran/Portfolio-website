import { objectBySlug } from '@/content/objects';
import { Sticker } from './Sticker';
import { ArtSvg, heightOf, label } from './svg';

const H = heightOf('card');

export function Card() {
  const o = objectBySlug('contact')!;
  const [name, title, links] = o.face;
  return (
    <ArtSvg id="card">
      <rect x={0} y={0} width={100} height={H} rx={3} fill="#FFFFFF" />
      <text x={8} y={18} fontSize={10} fontWeight={900} fill="#15191C" className="art-display">
        {name}
      </text>
      <text x={8} y={26} fontSize={5.5} fill="#3E454B">
        {title}
      </text>
      <text x={8} y={H - 7} fontSize={5.5} fill="#15191C" className="art-mono">
        {links}
      </text>
      <Sticker x={-6} y={-10} rot={-4} text={label(o.label)} />
    </ArtSvg>
  );
}
