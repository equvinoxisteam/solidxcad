import Link from 'next/link';
import {
  Box,
  FolderTree,
  MessageSquare,
  Printer,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Navbar } from '@/components/Navbar';

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Describe it in plain English',
    desc: 'Type what you need — brackets, plates, enclosures, assemblies — and SolidX CAD builds real 3D models for you.',
  },
  {
    icon: Box,
    title: 'View & refine in 3D',
    desc: 'Open STEP, STL, and GLB files in a built-in studio with chat, file tree, and interactive previews.',
  },
  {
    icon: FolderTree,
    title: 'Assemblies that make sense',
    desc: 'Combine plates, fasteners, and catalog parts into multi-part designs with a clear assembly structure.',
  },
  {
    icon: Printer,
    title: 'Ready to manufacture',
    desc: 'Export print-ready meshes and G-code from your project without leaving the workspace.',
  },
  {
    icon: Wrench,
    title: 'Real parts library',
    desc: 'Pull screws, bearings, motors, and boards into your design from a searchable parts catalog.',
  },
  {
    icon: Sparkles,
    title: 'One cloud studio',
    desc: 'Projects, AI chat, files, and viewer live together — from first sketch to final export.',
  },
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
          <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
            <div className="flex justify-center mb-8">
              <BrandLogo href="/" size={72} showName={false} />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
              Natural language
              <span className="block text-brand mt-1">turned into CAD</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              SolidX CAD is your AI design studio. Describe a part, assembly, or modification —
              get production-ready 3D files, previews, and manufacturing outputs in one place.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="auth-btn-primary text-base px-8 py-3 shadow-lg shadow-brand/20"
              >
                Start free
              </Link>
              <Link
                href="/login"
                className="px-8 py-3 rounded-xl border border-white/15 text-gray-200 hover:bg-white/5 transition-colors text-base font-medium"
              >
                Sign in
              </Link>
            </div>
          </section>

          <section className="border-y border-white/5 bg-black/20 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-gray-500 mb-10">
                What you can do
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/10 bg-[#0a1628]/80 p-6 hover:border-brand/40 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-brand" />
                    </div>
                    <h3 className="font-semibold text-white mb-2">{title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-3xl mx-auto px-6 py-20 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Design faster. Ship real geometry.
            </h2>
            <p className="text-gray-400 mb-8">
              Create a free account, open a project, and describe your first part in the chat.
              SolidX CAD handles the rest.
            </p>
            <Link href="/register" className="auth-btn-primary inline-block px-10 py-3">
              Create your studio
            </Link>
          </section>
        </main>

        <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} SolidX CAD
        </footer>
      </div>
    </div>
  );
}
