import Link from 'next/link';
import {
  ArrowRight,
  Box,
  Check,
  Cpu,
  Layers,
  MessageSquare,
  Printer,
  Ruler,
} from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';

const WORKFLOW = [
  { step: '01', label: 'Describe', detail: 'Engineering intent in plain language' },
  { step: '02', label: 'Generate', detail: 'Parametric STEP and mesh geometry' },
  { step: '03', label: 'Inspect', detail: 'Measure, section, and validate in 3D' },
  { step: '04', label: 'Export', detail: 'STL, G-code, URDF, and DXF' },
];

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Text-to-STEP generation',
    points: [
      'Describe brackets, mounts, enclosures, or sheet-metal parts',
      'Real B-rep STEP output, not placeholder meshes',
      'Parametric geometry you can refine in chat',
    ],
  },
  {
    icon: Box,
    title: 'In-browser CAD workbench',
    points: [
      'Orbit, pick, section, and measure in the studio',
      'No desktop CAD license to review geometry',
      'Share viewer links with your team',
    ],
  },
  {
    icon: Layers,
    title: 'Assembly-aware modeling',
    points: [
      'Multi-body designs with fasteners and standoffs',
      'Catalog hardware for manufacturing-ready structure',
      'Organized parts, not loose mesh piles',
    ],
  },
  {
    icon: Ruler,
    title: 'Engineering inspection',
    points: [
      'Bounding boxes, mass properties, and fit checks',
      'Catch dimensional issues before the shop floor',
      'Section and measure directly in 3D',
    ],
  },
  {
    icon: Printer,
    title: 'Print and fabrication ready',
    points: [
      'Slice to G-code from the same workspace',
      'Export watertight STL and sheet-metal DXF',
      'One project for design through fabrication',
    ],
  },
  {
    icon: Cpu,
    title: 'Robotics and mechanisms',
    points: [
      'Generate URDF, SRDF, and SDFormat',
      'Robotic cells, linkages, and mechanism pipelines',
      'Simulation-ready robot descriptions',
    ],
  },
];

const FORMATS = ['STEP', 'STL', 'GLB', 'G-code', 'URDF', 'DXF'];

const EXAMPLE_PROMPTS = [
  'Motor mount bracket, 50×30 mm, 4× M3 clearance holes',
  'Pi 4 enclosure with snap-fit lid and ventilation slots',
  'Add M3×20 SHCS from the parts catalog to this plate',
];

export default function HomePage() {
  return (
    <div className="landing-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg" aria-hidden />
      <div className="auth-grid" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen">
        <MarketingHeader />

        <main className="flex-1">
          <section className="marketing-hero">
            <h1 className="text-4xl md:text-[3.25rem] font-bold text-gray-900 mb-5 leading-[1.08] tracking-tight max-w-3xl mx-auto">
              From design intent
              <span className="block text-brand mt-1">to production-ready STEP</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
              SolidX CAD is an AI-native design engine in the browser. Describe parametric parts,
              assemblies, and modifications, then inspect, refine, and export manufacturing files
              without leaving your project.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {FORMATS.map((fmt) => (
                <span key={fmt} className="landing-format-pill">
                  {fmt}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-3 mb-10">
              <Link href="/register" className="auth-btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
                Start free
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link href="/login?fresh=1" className="landing-btn-secondary">
                Sign in
              </Link>
            </div>

            <div className="landing-workflow-row max-w-4xl mx-auto mb-8">
              {WORKFLOW.map(({ step, label, detail }, i) => (
                <div key={step} className="contents">
                  <div className="landing-workflow-step">
                    <span className="text-[10px] font-mono text-brand font-semibold">{step}</span>
                    <span className="text-sm font-semibold text-gray-900 mt-0.5">{label}</span>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{detail}</p>
                  </div>
                  {i < WORKFLOW.length - 1 && (
                    <ArrowRight className="landing-workflow-arrow-between hidden sm:block" aria-hidden />
                  )}
                </div>
              ))}
            </div>

            <div className="max-w-3xl mx-auto">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                Example prompts
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <span key={prompt} className="landing-prompt-chip text-left">
                    {prompt}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="marketing-features-section">
            <div className="marketing-section-inner">
              <div className="text-center mb-12">
                <h2 className="landing-eyebrow mb-3">Built for mechanical design</h2>
                <p className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">
                  Everything you need from first sketch to shop-floor output
                </p>
              </div>

              <div className="space-y-0">
                {FEATURES.map(({ icon: Icon, title, points }, index) => (
                  <article
                    key={title}
                    className={`landing-feature-row ${index % 2 === 1 ? 'landing-feature-row-reverse' : ''} ${
                      index > 0 ? 'border-t border-border' : ''
                    }`}
                  >
                    <div className="landing-feature-visual">
                      <div className="landing-feature-visual-inner">
                        <Icon className="w-14 h-14 text-brand" aria-hidden />
                      </div>
                    </div>
                    <div className="landing-feature-content">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
                      <ul className="space-y-2">
                        {points.map((point) => (
                          <li key={point} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
                            <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
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
              <div className="flex flex-wrap justify-center gap-3">
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

        <footer className="marketing-footer">
          <div className="marketing-footer-inner">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} SolidX CAD</p>
            <div className="flex items-center gap-6">
              <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </Link>
              <Link href="/login?fresh=1" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Sign in
              </Link>
              <Link href="/register" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Start free
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500 mt-4 pb-6">
            Powered by Equvinoxis Technologies
          </p>
        </footer>
      </div>
    </div>
  );
}
