import { objectBySlug } from '@/content/objects';
import { Sticker } from './Sticker';
import { ArtSvg, label } from './svg';

export function Note() {
  const o = objectBySlug('this-site')!;
  return (
    <ArtSvg id="note">
      <rect x={0} y={0} width={100} height={100} fill="#FFE27A" />
      {o.face.map((line, i) => (
        <text
          key={line}
          x={12}
          y={34 + i * 18}
          fontSize={17}
          fontWeight={700}
          fill="#2B2410"
          className="art-hand"
        >
          {line}
        </text>
      ))}
      <Sticker x={40} y={90} rot={5} text={label(o.label)} />
    </ArtSvg>
  );
}
