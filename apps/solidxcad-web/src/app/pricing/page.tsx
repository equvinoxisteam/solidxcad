import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Check, Zap } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="dashboard-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg opacity-60" aria-hidden />
      <div className="auth-grid opacity-40" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-16">
          <h1 className="text-3xl font-bold text-white text-center mb-4">Simple pricing</h1>
          <p className="text-gray-400 text-center mb-12">Credits power AI design and CAD generation</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/85 p-8">
              <h2 className="text-xl font-bold text-white mb-2">Free</h2>
              <div className="text-3xl font-bold text-white mb-4">$0</div>
              <ul className="space-y-3 text-sm text-gray-400 mb-8">
                <li className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0" /> Unlimited API usage</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0" /> Text-to-STEP generation</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0" /> Cloud viewer & downloads</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0" /> 3 projects</li>
              </ul>
              <Link href="/register" className="auth-btn-primary w-full block text-center py-2.5">
                Get started
              </Link>
            </div>

            <div className="auth-card rounded-2xl border border-brand/30 bg-[#0a1628]/90 p-8 relative">
              <div className="absolute -top-3 right-4 text-xs bg-brand text-white px-2 py-0.5 rounded">Popular</div>
              <h2 className="text-xl font-bold text-white mb-2">Pro</h2>
              <div className="text-3xl font-bold text-white mb-4">
                $20<span className="text-lg text-gray-400 font-normal">/mo</span>
              </div>
              <ul className="space-y-3 text-sm text-gray-400 mb-8">
                <li className="flex gap-2"><Zap className="w-4 h-4 text-amber-400 shrink-0" /> 500 credits / month</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0" /> Unlimited projects</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0" /> Priority CAD generation</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0" /> Parts library</li>
              </ul>
              <Link href="/settings" className="auth-btn-primary w-full block text-center py-2.5">
                Upgrade in app
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
