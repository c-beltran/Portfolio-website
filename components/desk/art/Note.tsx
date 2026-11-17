import { ART_PALETTE as C } from '@/lib/artPalette';
import { objectBySlug } from '@/content/objects';
import { ArtSvg, label } from './svg';

export function Note() {
  const o = objectBySlug('this-site')!;
  return (
    <ArtSvg id="note" sticker={{ x: 40, y: 90, rot: 5, text: label(o.label) }}>
      <rect x={0} y={0} width={100} height={100} fill={C.note} />
      {o.face.map((line, i) => (
        <text
          key={line}
          x={12}
          y={34 + i * 18}
          fontSize={17}
          fontWeight={700}
          fill={C.noteInk}
          className="art-hand"
        >
          {line}
        </text>
      ))}
    </ArtSvg>
  );
}
