import { objectBySlug } from '@/content/objects';
import { Sticker } from './Sticker';
import { ArtSvg, label } from './svg';

/** The backflow test-kit gauge with its three hoses. The needle swings up when selected (CSS). */
export function Gauge() {
  const o = objectBySlug('potaflow')!;
  return (
    <ArtSvg id="gauge">
      <g className="hoses" fill="none" strokeWidth={5} strokeLinecap="round">
        <path d="M42 84 C 30 110, 10 112, 2 128" stroke="#C8412B" />
        <path d="M50 88 C 52 110, 40 118, 44 128" stroke="#E5B53A" />
        <path d="M58 84 C 72 106, 92 108, 98 126" stroke="#2F6FBF" />
      </g>
      <rect x={38} y={76} width={24} height={14} rx={3} fill="#9AA1A8" />
      <circle cx={50} cy={44} r={40} fill="#D9DDE1" />
      <circle cx={50} cy={44} r={34} fill="#FFFFFF" />
      <path d="M 26 64 A 31 31 0 0 1 22 30" fill="none" stroke="#E5B53A" strokeWidth={3} />
      <path d="M 74 64 A 31 31 0 0 0 78 30" fill="none" stroke="#C8412B" strokeWidth={3} />
      <g stroke="#15191C" strokeWidth={1.4} strokeLinecap="round">
        <line x1={50} y1={14} x2={50} y2={19} />
        <line x1={29} y1={23} x2={32} y2={27} />
        <line x1={71} y1={23} x2={68} y2={27} />
        <line x1={20} y1={44} x2={25} y2={44} />
        <line x1={80} y1={44} x2={75} y2={44} />
      </g>
      <text
        x={50}
        y={62}
        textAnchor="middle"
        fontSize={6}
        fontWeight={600}
        fill="#15191C"
        className="art-mono"
      >
        PSID
      </text>
      <g className="needle">
        <line
          x1={50}
          y1={44}
          x2={50}
          y2={17}
          stroke="#C8412B"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </g>
      <circle cx={50} cy={44} r={3.4} fill="#15191C" />
      <Sticker x={2} y={74} rot={-5} text={label(o.label)} />
    </ArtSvg>
  );
}
