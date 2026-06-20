import Link from 'next/link';
import { ArrowRight, Box, Globe, Sparkles } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MarketingHeader } from '@/components/MarketingHeader';

const PILLARS = [
  { icon: Box, title: 'Parametric Engine', subtitle: 'INDUSTRIAL GRADE' },
  { icon: Sparkles, title: 'AI Agent', subtitle: 'TEXT TO STEP' },
  { icon: Globe, title: 'Zero Installation', subtitle: 'BROWSER NATIVE' },
];

export default function HomePage() {
  return (
    <div className="landing-home">
      <div className="landing-home-glow" aria-hidden />

      <div className="relative z-10 flex min-h-screen flex-col">
        <MarketingHeader variant="dark" />

        <main className="landing-home-main flex-1">
          <section className="landing-home-hero">
            <p className="landing-home-badge">
              THE FUTURE OF CAD IS HERE <span aria-hidden>|</span> Browser-Native
            </p>

            <h1 className="landing-home-title">
              Next-Generation CAD.
              <span className="landing-home-title-accent">Engineered for the AI Age.</span>
            </h1>

            <p className="landing-home-lead">
              Escape legacy constraints. {BRAND_NAME} fuses professional parametric modeling with an
              intelligent AI Agent and in-browser inspection. Design, refine, and export faster, all
              directly in your browser.
            </p>

            <Link href="/register" className="landing-home-cta">
              Launch Design Engine
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>

            <div className="landing-home-pillars">
              {PILLARS.map(({ icon: Icon, title, subtitle }) => (
                <div key={title} className="landing-home-pillar">
                  <Icon className="landing-home-pillar-icon" aria-hidden />
                  <p className="landing-home-pillar-title">{title}</p>
                  <p className="landing-home-pillar-sub">{subtitle}</p>
                </div>
              ))}
            </div>

            <p className="landing-home-proof">
              REAL MODELS — GENERATED IN {BRAND_NAME.toUpperCase()}
            </p>
          </section>
        </main>

        <MarketingFooter variant="dark" />
      </div>
    </div>
  );
}
