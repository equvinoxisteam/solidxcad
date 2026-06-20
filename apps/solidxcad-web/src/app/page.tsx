import Link from 'next/link';
import { ArrowRight, Box, Download, Sparkles } from 'lucide-react';
import { BRAND_EXPORT_FORMATS, BRAND_NAME } from '@/lib/brand';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MarketingHeader } from '@/components/MarketingHeader';
import { HomeShowcase } from '@/components/HomeShowcase';

const PILLARS = [
  { icon: Sparkles, title: 'Describe your part', subtitle: 'TEXT TO CAD' },
  { icon: Box, title: 'Inspect in 3D', subtitle: 'BROWSER VIEWER' },
  { icon: Download, title: 'Export for production', subtitle: 'STEP · STL · G-CODE' },
];

export default function HomePage() {
  return (
    <div className="landing-home landing-home-light">
      <div className="auth-grid landing-home-grid" aria-hidden />

      <div className="relative z-10 flex min-h-screen flex-col">
        <MarketingHeader />

        <main className="landing-home-main flex-1">
          <section className="landing-home-hero">
            <h1 className="landing-home-title landing-home-title-light">
              From design intent
              <span className="landing-home-title-accent-light">to production-ready files.</span>
            </h1>

            <p className="landing-home-lead landing-home-lead-light">
              Tell {BRAND_NAME} what you need in plain language. Get parametric STEP geometry, preview
              assemblies in the browser, and export manufacturing files without installing desktop CAD.
            </p>

            <div className="landing-home-formats">
              <p className="landing-home-formats-label">Generate and export</p>
              <div className="landing-home-formats-row">
                {BRAND_EXPORT_FORMATS.map((fmt) => (
                  <span key={fmt} className="landing-format-pill">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>

            <Link href="/register" className="auth-btn-primary landing-home-cta-light inline-flex items-center gap-2">
              Start free
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>

            <div className="landing-home-pillars">
              {PILLARS.map(({ icon: Icon, title, subtitle }) => (
                <div key={title} className="landing-home-pillar">
                  <Icon className="landing-home-pillar-icon-light" aria-hidden />
                  <p className="landing-home-pillar-title-light">{title}</p>
                  <p className="landing-home-pillar-sub-light">{subtitle}</p>
                </div>
              ))}
            </div>

            <p className="landing-home-proof landing-home-proof-light">
              FREE TO START · NO INSTALL REQUIRED
            </p>
          </section>

          <HomeShowcase />
        </main>

        <MarketingFooter />
      </div>
    </div>
  );
}
