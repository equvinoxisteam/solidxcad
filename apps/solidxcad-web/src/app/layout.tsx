import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://solidxcad.equvinoxis.com'),
  title: {
    default: 'SolidX CAD — From design intent to production-ready STEP',
    template: '%s · SolidX CAD',
  },
  description:
    'AI-native cloud CAD for engineers. Generate parametric STEP models, inspect assemblies in-browser, and export STL, G-code, URDF, and DXF from one workspace.',
  keywords: [
    'CAD',
    'STEP',
    'text to CAD',
    '3D modeling',
    'mechanical design',
    'assemblies',
    'G-code',
    'URDF',
    'manufacturing',
  ],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', sizes: '32x32' },
    ],
    apple: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'SolidX CAD — From design intent to production-ready STEP',
    description:
      'Describe parts and assemblies in plain language. Get parametric STEP geometry, in-browser inspection, and manufacturing exports.',
    url: 'https://solidxcad.equvinoxis.com',
    siteName: 'SolidX CAD',
    type: 'website',
    images: [{ url: '/favicon.svg', width: 32, height: 32, alt: 'SolidX CAD' }],
  },
  twitter: {
    card: 'summary',
    title: 'SolidX CAD — From design intent to production-ready STEP',
    description:
      'Cloud CAD for engineers. Text-to-STEP, assembly modeling, and export to STL, G-code, and URDF.',
    images: ['/favicon.svg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#103A8E',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-screen bg-base text-gray-900 antialiased">{children}</body>
    </html>
  );
}
