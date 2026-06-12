import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SolidX CAD — Natural language turned into CAD',
  description: 'SolidX CAD turns your ideas into production-ready 3D models, assemblies, and manufacturing files in one cloud studio.',
  icons: { icon: '/logo.png', apple: '/logo.png' },
};

export const viewport: Viewport = {
  themeColor: '#071428',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <body className="dark min-h-screen bg-[#071428] text-gray-200 antialiased">{children}</body>
    </html>
  );
}
