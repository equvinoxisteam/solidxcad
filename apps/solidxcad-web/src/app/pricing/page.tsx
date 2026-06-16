import Link from 'next/link';
import { Check, Sparkles, Zap } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="dashboard-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg opacity-60" aria-hidden />
      <div className="auth-grid opacity-40" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen">
        <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-20 pb-16">
          <div className="text-center mb-12">
            <p className="landing-eyebrow mb-4">Pricing</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
              Start free. Upgrade when you need more throughput.
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Credits power CAD generation and exports. Keep your projects, files, and inspections in one cloud workspace.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/85 p-8">
              <h2 className="text-xl font-bold text-white mb-2">Free</h2>
              <div className="text-3xl font-bold text-white mb-4">$0</div>
              <ul className="space-y-3 text-sm text-gray-400 mb-8">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" /> Text-to-STEP generation
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" /> Cloud viewer & downloads
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" /> Up to 3 projects
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" /> Standard queue
                </li>
              </ul>
              <Link href="/register" className="auth-btn-primary w-full block text-center py-2.5">
                Get started
              </Link>
            </div>

            <div className="auth-card rounded-2xl border border-brand/30 bg-[#0a1628]/90 p-8 relative overflow-hidden">
              <div className="absolute -top-3 right-4 text-xs bg-brand text-white px-2 py-0.5 rounded">
                Popular
              </div>
              <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand/20 blur-3xl" aria-hidden />
              <h2 className="text-xl font-bold text-white mb-2">Pro</h2>
              <div className="text-3xl font-bold text-white mb-4">
                $20<span className="text-lg text-gray-400 font-normal">/mo</span>
              </div>
              <ul className="space-y-3 text-sm text-gray-400 mb-8">
                <li className="flex gap-2">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /> 500 credits / month
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" /> Unlimited projects
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" /> Priority CAD generation
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" /> Parts library
                </li>
                <li className="flex gap-2">
                  <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" /> Faster iterations for teams
                </li>
              </ul>
              <Link href="/register" className="auth-btn-primary w-full block text-center py-2.5">
                Start Pro
              </Link>
            </div>
          </div>

          <div className="text-center mt-12 text-sm text-gray-500">
            Need help choosing a plan?{' '}
            <Link href="/login?fresh=1" className="text-gray-300 hover:text-white transition-colors">
              Sign in
            </Link>{' '}
            to manage billing in your account settings.
          </div>
        </main>
      </div>
    </div>
  );
}
