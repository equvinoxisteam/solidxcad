import type { Metadata, Viewport } from 'next';
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://solidxcad.equvinoxis.com'),
  title: {
    default: `${BRAND_NAME} — Next-generation CAD for the AI age`,
    template: `%s · ${BRAND_NAME}`,
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
      { url: BRAND_LOGO_SRC, type: 'image/png' },
      { url: BRAND_LOGO_SRC, sizes: '32x32', type: 'image/png' },
    ],
    apple: BRAND_LOGO_SRC,
    shortcut: BRAND_LOGO_SRC,
  },
  openGraph: {
    title: `${BRAND_NAME} — Next-generation CAD for the AI age`,
    description:
      'Describe parts and assemblies in plain language. Get parametric STEP geometry, in-browser inspection, and manufacturing exports.',
    url: 'https://solidxcad.equvinoxis.com',
    siteName: BRAND_NAME,
    type: 'website',
    images: [{ url: BRAND_LOGO_SRC, width: 512, height: 512, alt: BRAND_NAME }],
  },
  twitter: {
    card: 'summary',
    title: `${BRAND_NAME} — Next-generation CAD for the AI age`,
    description:
      'Cloud CAD for engineers. Text-to-STEP, assembly modeling, and export to STL, G-code, and URDF.',
    images: [BRAND_LOGO_SRC],
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
