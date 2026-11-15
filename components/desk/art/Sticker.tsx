/** The cream label stuck on each object (from the mock). Text, so it stays real and readable. */
export function Sticker({ x, y, rot, text }: { x: number; y: number; rot: number; text: string }) {
  const w = text.length * 6.4 + 12;
  return (
    <g className="sticker" transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect width={w} height={15} fill="var(--sticker)" filter="url(#sticker-shadow)" />
      <text
        x={w / 2}
        y={10.6}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        letterSpacing="0.06em"
        fill="var(--sticker-ink)"
      >
        {text}
      </text>
    </g>
  );
}
