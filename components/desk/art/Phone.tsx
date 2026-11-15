import { objectBySlug } from '@/content/objects';
import { Sticker } from './Sticker';
import { ArtSvg, heightOf, label } from './svg';

const H = heightOf('phone');

/** Dark until selected; then the screen lights yellow and spills onto the felt (CSS). */
export function Phone() {
  const o = objectBySlug('power-walk')!;
  return (
    <ArtSvg id="phone">
      <ellipse
        className="phone-spill"
        cx={50}
        cy={H / 2}
        rx={110}
        ry={H * 0.62}
        fill="url(#phone-spill)"
      />
      <rect x={0} y={0} width={100} height={H} rx={20} fill="#121518" />
      <rect className="phone-screen" x={6} y={6} width={88} height={H - 12} rx={14} />
      <g
        className="phone-bulb"
        fill="none"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(26 ${H / 2 - 30}) scale(2)`}
      >
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
      </g>
      <Sticker x={-40} y={H - 10} rot={-8} text={label(o.label)} />
    </ArtSvg>
  );
}
