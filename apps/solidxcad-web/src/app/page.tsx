import Link from 'next/link';
import {
  ArrowRight,
  Box,
  Cpu,
  FileBox,
  Layers,
  MessageSquare,
  Printer,
  Ruler,
  Wrench,
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Navbar } from '@/components/Navbar';

const WORKFLOW = [
  { step: '01', label: 'Describe', detail: 'Engineering intent in plain language' },
  { step: '02', label: 'Generate', detail: 'Parametric STEP & mesh geometry' },
  { step: '03', label: 'Inspect', detail: 'Measure, section, and validate in 3D' },
  { step: '04', label: 'Export', detail: 'STL, G-code, URDF, and DXF' },
];

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Text-to-STEP generation',
    desc: 'Describe brackets, motor mounts, enclosures, or sheet-metal parts — SolidX outputs real B-rep STEP models, not placeholders.',
  },
  {
    icon: Box,
    title: 'In-browser CAD workbench',
    desc: 'Orbit, pick, section, and measure assemblies directly in the studio. No desktop CAD license required to review geometry.',
  },
  {
    icon: Layers,
    title: 'Assembly-aware modeling',
    desc: 'Build multi-body designs with fasteners, standoffs, and catalog hardware — structured for manufacturing, not loose meshes.',
  },
  {
    icon: Ruler,
    title: 'Engineering inspection',
    desc: 'Check bounding boxes, mass properties, and fit before export. Catch dimensional issues before they reach the shop floor.',
  },
  {
    icon: Printer,
    title: 'Print & fabrication ready',
    desc: 'Slice to G-code, export watertight STL, and prepare sheet-metal DXF — all from the same project workspace.',
  },
  {
    icon: Cpu,
    title: 'Robotics & mechanisms',
    desc: 'Generate URDF, SRDF, and SDFormat for robotic cells, linkages, and mechanism simulation pipelines.',
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
      <div className="auth-orb auth-orb-a" aria-hidden />
      <div className="auth-orb auth-orb-b" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1">
          <section className="max-w-5xl mx-auto px-6 pt-14 pb-16 text-center">
            <div className="flex justify-center mb-8">
              <BrandLogo href="/" size={64} showName={false} />
            </div>

            <p className="landing-eyebrow mb-5">Cloud CAD for engineers</p>

            <h1 className="text-4xl md:text-[3.25rem] font-bold text-white mb-6 leading-[1.08] tracking-tight max-w-3xl mx-auto">
              From design intent
              <span className="block text-brand mt-1">to production-ready STEP</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
              SolidX CAD is an AI-native design engine in the browser. Describe parametric parts,
              assemblies, and modifications — then inspect, refine, and export manufacturing files
              without leaving your project.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {FORMATS.map((fmt) => (
                <span key={fmt} className="landing-format-pill">
                  {fmt}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-4 mb-14">
              <Link
                href="/register"
                className="auth-btn-primary text-base px-8 py-3 shadow-lg shadow-brand/20 inline-flex items-center gap-2"
              >
                Start free
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="px-8 py-3 rounded-xl border border-white/15 text-gray-200 hover:bg-white/5 transition-colors text-base font-medium"
              >
                Sign in
              </Link>
            </div>

            <div className="landing-workflow max-w-3xl mx-auto">
              {WORKFLOW.map(({ step, label, detail }, i) => (
                <div key={step} className="landing-workflow-step">
                  <div className="landing-workflow-node">
                    <span className="text-[10px] font-mono text-brand-muted">{step}</span>
                    <span className="text-sm font-semibold text-white">{label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 leading-snug">{detail}</p>
                  {i < WORKFLOW.length - 1 && (
                    <ArrowRight className="landing-workflow-arrow hidden sm:block" aria-hidden />
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="border-y border-white/5 bg-black/25 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-6 py-14">
              <div className="text-center mb-10">
                <h2 className="landing-eyebrow mb-3">Built for mechanical design</h2>
                <p className="text-xl md:text-2xl font-semibold text-white tracking-tight">
                  Everything you need from first sketch to shop-floor output
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="landing-feature-card">
                    <div className="landing-feature-icon">
                      <Icon className="w-5 h-5 text-brand" aria-hidden />
                    </div>
                    <h3 className="font-semibold text-white mb-2">{title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-4xl mx-auto px-6 py-16">
            <div className="landing-prompt-panel">
              <div className="flex items-start gap-3 mb-4">
                <FileBox className="w-5 h-5 text-brand shrink-0 mt-0.5" aria-hidden />
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-muted mb-1">
                    Example prompts
                  </p>
                  <p className="text-sm text-gray-400">
                    Open a project and describe geometry the way you would to a colleague on the shop floor.
                  </p>
                </div>
              </div>
              <ul className="space-y-2.5">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <li key={prompt} className="landing-prompt-chip">
                    <Wrench className="w-3.5 h-3.5 text-brand-muted shrink-0" aria-hidden />
                    <span>{prompt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="border-t border-white/5 bg-[#050f1c]/60">
            <div className="max-w-3xl mx-auto px-6 py-16 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
                Ship real geometry, not screenshots
              </h2>
              <p className="text-gray-400 mb-8 max-w-xl mx-auto leading-relaxed">
                Create a free account, start a project, and generate your first STEP file in minutes.
                Free tier includes text-to-CAD, cloud viewer, and project storage.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/register" className="auth-btn-primary inline-flex items-center gap-2 px-10 py-3">
                  Open design studio
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                <Link
                  href="/pricing"
                  className="px-8 py-3 rounded-xl border border-white/15 text-gray-200 hover:bg-white/5 transition-colors text-base font-medium"
                >
                  View pricing
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="relative z-10 border-t border-white/5 py-8">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} SolidX CAD · equvinoxis</p>
            <div className="flex items-center gap-6">
              <Link href="/pricing" className="hover:text-gray-300 transition-colors">
                Pricing
              </Link>
              <Link href="/login" className="hover:text-gray-300 transition-colors">
                Sign in
              </Link>
              <Link href="/register" className="hover:text-gray-300 transition-colors">
                Start free
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
