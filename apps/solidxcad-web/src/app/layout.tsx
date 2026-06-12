import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SolidX CAD — Natural language turned into CAD',
  description: 'SolidX CAD turns your ideas into production-ready 3D models, assemblies, and manufacturing files in one cloud studio.',
  icons: { icon: '/logo.png', apple: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
