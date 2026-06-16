import Link from 'next/link';
import { Check, Sparkles, Zap } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For trying text-to-STEP and exploring the cloud workbench.',
    cta: 'Get started',
    href: '/register',
    popular: false,
    features: [
      'Text-to-STEP generation',
      'Cloud viewer and downloads',
      'Up to 3 projects',
      'Standard generation queue',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    period: '/month',
    description: 'For engineers shipping more parts, assemblies, and exports each month.',
    cta: 'Start Pro',
    href: '/register',
    popular: true,
    features: [
      '500 credits per month',
      'Unlimited projects',
      'Priority CAD generation',
      'Parts library access',
      'Faster iterations for teams',
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <div className="landing-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg" aria-hidden />
      <div className="auth-grid" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen w-full">
        <MarketingHeader />

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
          <section className="text-center pt-4 sm:pt-8 pb-10 sm:pb-14 max-w-3xl mx-auto">
            <p className="landing-eyebrow mb-3 sm:mb-4">Pricing</p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4 tracking-tight leading-tight">
              Start free. Upgrade when you need more throughput.
            </h1>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed px-2">
              Credits power CAD generation and exports. Keep your projects, files, and inspections
              in one cloud workspace.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-8 max-w-4xl mx-auto items-stretch">
            {PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`pricing-card ${plan.popular ? 'pricing-card-pro' : ''}`}
              >
                {plan.popular && (
                  <span className="pricing-card-badge">Most popular</span>
                )}

                <div className="pricing-card-body">
                  <div className="mb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-white">{plan.name}</h2>
                    <p className="text-sm text-gray-500 mt-2 leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="mb-6 sm:mb-8">
                    <div className="flex items-end gap-1">
                      <span className="text-3xl sm:text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-sm sm:text-base text-gray-400 pb-1">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 sm:space-y-3.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm text-gray-300 leading-snug">
                        {plan.id === 'pro' && feature.includes('credits') ? (
                          <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                        ) : plan.id === 'pro' && feature.includes('Faster') ? (
                          <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
                        ) : (
                          <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
                        )}
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pricing-card-cta">
                  <Link href={plan.href} className="auth-btn-primary w-full block text-center py-3 text-sm sm:text-base">
                    {plan.cta}
                  </Link>
                </div>
              </article>
            ))}
          </section>

          <section className="max-w-3xl mx-auto mt-10 sm:mt-14 rounded-2xl border border-white/[0.08] bg-[#0a1628]/50 px-5 sm:px-8 py-6 sm:py-8 text-center">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-2">What are credits?</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Each CAD generation, refinement, or export uses credits. Free is enough to explore the
              studio; Pro gives you monthly capacity for production work.
            </p>
          </section>

          <p className="text-center mt-8 sm:mt-10 text-xs sm:text-sm text-gray-500 px-4 leading-relaxed">
            Already have an account?{' '}
            <Link href="/login?fresh=1" className="text-gray-300 hover:text-white transition-colors">
              Sign in
            </Link>{' '}
            to manage billing in settings.
          </p>
        </main>

        <footer className="relative z-10 border-t border-white/5 py-6 sm:py-8 mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-500">
            <p>© {new Date().getFullYear()} SolidX CAD</p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <Link href="/" className="hover:text-gray-300 transition-colors">
                Home
              </Link>
              <Link href="/login?fresh=1" className="hover:text-gray-300 transition-colors">
                Sign in
              </Link>
              <Link href="/register" className="hover:text-gray-300 transition-colors">
                Sign up
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-gray-600 mt-4">
            Powered by Equvinoxis Technologies
          </p>
        </footer>
      </div>
    </div>
  );
}
