import type { ReactNode } from 'react';
import { LampToggle } from '@/components/header/LampToggle';
import { THEME_SCRIPT, themeCss } from '@/lib/theme';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body>
        <LampToggle />
        {children}
      </body>
    </html>
  );
}
