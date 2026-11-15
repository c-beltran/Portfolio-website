import { objectBySlug } from '@/content/objects';
import { Sticker } from './Sticker';
import { ArtSvg, heightOf, label } from './svg';

const H = heightOf('laptop');
const EDITOR_LINES = [60, 44, 52, 30, 48, 38, 56, 26];
const PANEL_LINES = [22, 16, 20, 12, 18];

/** An editor with a side panel, drawn as blocks: no text until Q25 picks the real session. */
export function Laptop() {
  const o = objectBySlug('how-i-build')!;
  return (
    <ArtSvg id="laptop">
      <rect x={4} y={0} width={92} height={56} rx={4} fill="#1E2328" />
      <rect x={8} y={4} width={84} height={48} rx={2} fill="#F7F8FA" />
      <rect x={8} y={4} width={84} height={5} rx={2} fill="#E3E6E9" />
      {EDITOR_LINES.map((w, i) => (
        <rect
          key={i}
          x={12}
          y={13 + i * 4.6}
          width={w * 0.8}
          height={2.2}
          rx={1.1}
          fill="#C9CED3"
        />
      ))}
      <rect x={64} y={9} width={28} height={43} fill="#EEF0EC" />
      {PANEL_LINES.map((w, i) => (
        <rect key={i} x={67} y={13 + i * 5} width={w} height={2.2} rx={1.1} fill="#B9BFC5" />
      ))}
      <circle cx={68.5} cy={42} r={1.8} fill="#1F7A45" />
      <rect x={72} y={41} width={16} height={2.2} rx={1.1} fill="#1F7A45" />
      <rect x={0} y={56} width={100} height={H - 56} rx={4} fill="#C5CACF" />
      {Array.from({ length: 42 }, (_, i) => (
        <rect
          key={i}
          x={6 + (i % 14) * 6.3}
          y={60 + Math.floor(i / 14) * 4.4}
          width={5.3}
          height={3.4}
          rx={0.8}
          fill="#2A3036"
        />
      ))}
      <rect x={33} y={74} width={34} height={9} rx={2} fill="#B3B9BF" />
      <Sticker x={58} y={H - 6} rot={-3} text={label(o.label)} />
    </ArtSvg>
  );
}
