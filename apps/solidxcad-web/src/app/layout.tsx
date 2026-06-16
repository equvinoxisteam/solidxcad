import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://solidxcad.equvinoxis.com'),
  title: {
    default: 'SolidX CAD — Prompt to STEP in the Browser',
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
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'SolidX CAD — AI Design Engine for Engineers',
    description:
      'Describe parts and assemblies in plain language. Get parametric STEP geometry, in-browser inspection, and manufacturing exports.',
    url: 'https://solidxcad.equvinoxis.com',
    siteName: 'SolidX CAD',
    type: 'website',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'SolidX CAD' }],
  },
  twitter: {
    card: 'summary',
    title: 'SolidX CAD — Prompt to STEP in the Browser',
    description:
      'Cloud CAD for engineers. Text-to-STEP, assembly modeling, and export to STL, G-code, and URDF.',
    images: ['/logo.png'],
  },
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
