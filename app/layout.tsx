import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { IBM_Plex_Mono, Inter, Schibsted_Grotesk } from 'next/font/google';
import { Header } from '@/components/header/Header';
import { titleFor } from '@/lib/deskRoutes';
import { THEME_SCRIPT, themeCss } from '@/lib/theme';
import './globals.css';

const display = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700', '800', '900'],
  variable: '--font-display',
});
const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-mono',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://cbeltran.com'),
  title: titleFor(null),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      {/* Extensions (ColorZilla, Grammarly…) add attributes to <body> before React hydrates. */}
      <body suppressHydrationWarning>
        <div className="page">
          <Header />
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
