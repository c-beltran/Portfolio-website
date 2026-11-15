import { Sticker } from './Sticker';
import { ArtSvg, heightOf } from './svg';

const H = heightOf('lamp');

/** The desk lamp, seen from above. Its bulb follows the theme token, so it lights without JS. */
export function Lamp() {
  return (
    <ArtSvg id="lamp">
      <circle cx={50} cy={H - 24} r={22} fill="#2A3036" />
      <circle cx={50} cy={H - 24} r={6} fill="#3E454B" />
      <path
        d={`M50 ${H - 24} L36 54 L58 24`}
        fill="none"
        stroke="#3E454B"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx={60} cy={24} rx={30} ry={20} fill="#D9A441" />
      <ellipse cx={62} cy={27} rx={17} ry={11} fill="#7A5A1E" />
      <circle className="lamp-bulb" cx={62} cy={27} r={8} fill="var(--lamp-glow)" />
      <Sticker x={-4} y={H - 10} rot={-4} text="LAMP" />
    </ArtSvg>
  );
}
