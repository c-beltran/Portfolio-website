import { ImageResponse } from 'next/og';
import { TOKENS } from './theme';

export const OG_SIZE = { width: 1200, height: 630 };

/** Text-only share card in the day palette. No logos or marks. */
export function ogImage(subtitle: string): ImageResponse {
  const { bg, ink, inkMuted } = TOKENS.day;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: bg,
        color: ink,
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -3 }}>Carlos Beltran</div>
      <div style={{ fontSize: 44, color: inkMuted, marginTop: 24 }}>{subtitle}</div>
    </div>,
    OG_SIZE,
  );
}
