'use client';

import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 vc-init">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}