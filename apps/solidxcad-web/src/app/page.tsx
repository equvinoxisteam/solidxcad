import Link from 'next/link';
import {
  ArrowRight,
  Box,
  Cpu,
  Layers,
  MessageSquare,
  Printer,
  Ruler,
} from 'lucide-react';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MarketingHeader } from '@/components/MarketingHeader';

const WORKFLOW = [
  { step: '01', label: 'Describe', detail: 'Engineering intent in plain language' },
  { step: '02', label: 'Generate', detail: 'Parametric STEP and mesh geometry' },
  { step: '03', label: 'Inspect', detail: 'Measure, section, and validate in 3D' },
  { step: '04', label: 'Export', detail: 'STL, G-code, URDF, and DXF' },
];

const FEATURES = [
  { icon: MessageSquare, title: 'Text-to-STEP generation' },
  { icon: Box, title: 'In-browser CAD workbench' },
  { icon: Layers, title: 'Assembly-aware modeling' },
  { icon: Ruler, title: 'Engineering inspection' },
  { icon: Printer, title: 'Print and fabrication ready' },
  { icon: Cpu, title: 'Robotics and mechanisms' },
];

const FORMATS = ['STEP', 'STL', 'GLB', 'G-code', 'URDF', 'DXF'];

export default function HomePage() {
  return (
    <div className="landing-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg" aria-hidden />
      <div className="auth-grid" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen">
        <MarketingHeader />

        <main className="flex-1 w-full">
          <section className="marketing-hero">
            <h1 className="text-3xl sm:text-4xl md:text-[3.25rem] font-bold text-gray-900 mb-4 leading-[1.08] tracking-tight">
              From design intent
              <span className="block text-brand mt-1">to production-ready STEP</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-6 leading-relaxed">
              SolidX CAD is an AI-native design engine in the browser. Describe parametric parts,
              assemblies, and modifications, then inspect, refine, and export manufacturing files
              without leaving your project.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {FORMATS.map((fmt) => (
                <span key={fmt} className="landing-format-pill">
                  {fmt}
                </span>
              ))}
            </div>

            <div className="landing-cta-actions mb-8">
              <Link href="/register" className="auth-btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
                Start free
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link href="/login?fresh=1" className="landing-btn-secondary">
                Sign in
              </Link>
            </div>

            <div className="landing-workflow-row">
              {WORKFLOW.map(({ step, label, detail }, i) => (
                <div key={step} className="contents">
                  <div className="landing-workflow-step">
                    <span className="landing-workflow-step-num">{step}</span>
                    <span className="text-sm font-semibold text-gray-900 mt-2 block">{label}</span>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{detail}</p>
                  </div>
                  {i < WORKFLOW.length - 1 && (
                    <ArrowRight className="landing-workflow-arrow-between hidden sm:block" aria-hidden />
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="marketing-features-section">
            <div className="marketing-section-inner">
              <div className="space-y-0">
                {FEATURES.map(({ icon: Icon, title }, index) => (
                  <article
                    key={title}
                    className={`landing-feature-row ${index % 2 === 1 ? 'landing-feature-row-reverse' : ''} ${
                      index > 0 ? 'border-t border-border' : ''
                    }`}
                  >
                    <div className="landing-feature-visual">
                      <div className="landing-feature-visual-inner">
                        <Icon className="w-16 h-16 text-brand" aria-hidden />
                      </div>
                    </div>
                    <div className="landing-feature-content">
                      <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">{title}</h3>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="marketing-cta-section">
            <div className="marketing-section-inner text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                Ship real geometry, not screenshots
              </h2>
              <p className="text-gray-600 mb-8 max-w-xl mx-auto leading-relaxed">
                Create a free account, start a project, and generate your first STEP file in minutes.
                Free tier includes text-to-CAD, cloud viewer, and project storage.
              </p>
              <div className="landing-cta-actions">
                <Link href="/register" className="auth-btn-primary inline-flex items-center gap-2 px-10 py-3">
                  Open design studio
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                <Link href="/pricing" className="landing-btn-secondary">
                  View pricing
                </Link>
              </div>
            </div>
          </section>
        </main>

        <MarketingFooter />
      </div>
    </div>
  );
}
