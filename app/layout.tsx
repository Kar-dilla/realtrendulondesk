import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Shell from '@/components/shell/Shell';
import { getCurrentUser } from '@/lib/supabase/server';

const inter = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  title: 'Trendulon Desk',
  description: 'Trendulon — self-improving newsroom OS',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Shell user={user}>{children}</Shell>
      </body>
    </html>
  );
}
