import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Check, Zap } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white text-center mb-4">Simple pricing</h1>
        <p className="text-muted text-center mb-12">Credits power AI design and CAD generation</p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-8">
            <h2 className="text-xl font-bold text-white mb-2">Free</h2>
            <div className="text-3xl font-bold mb-4">$0</div>
            <ul className="space-y-3 text-sm text-muted mb-8">
              <li className="flex gap-2"><Check className="w-4 h-4 text-accent" /> Unlimited API usage</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-accent" /> Text-to-STEP generation</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-accent" /> Cloud viewer & downloads</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-accent" /> 3 projects</li>
            </ul>
            <Link href="/register" className="btn-ghost w-full block text-center">Get started</Link>
          </div>

          <div className="card p-8 border-accent/50 relative">
            <div className="absolute -top-3 right-4 text-xs bg-accent text-white px-2 py-0.5 rounded">Popular</div>
            <h2 className="text-xl font-bold text-white mb-2">Pro</h2>
            <div className="text-3xl font-bold mb-4">$20<span className="text-lg text-muted font-normal">/mo</span></div>
            <ul className="space-y-3 text-sm text-muted mb-8">
              <li className="flex gap-2"><Zap className="w-4 h-4 text-yellow-400" /> 500 credits / month</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-accent" /> Unlimited projects</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-accent" /> Priority CAD generation</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-accent" /> Slicing & parts library</li>
            </ul>
            <Link href="/settings" className="btn-primary w-full block text-center">Upgrade in app</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
