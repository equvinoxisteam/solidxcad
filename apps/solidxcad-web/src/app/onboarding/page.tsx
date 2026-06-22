'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Rocket, Wrench, GraduationCap } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { api, getToken, setStoredUser } from '@/lib/api';
import { sanitizeUserError } from '@/lib/userFacingErrors';
import { BRAND_NAME } from '@/lib/brand';

const USE_CASES = [
  { id: 'hobby', label: 'Hobby & makers', icon: Wrench },
  { id: 'professional', label: 'Professional design', icon: Rocket },
  { id: 'education', label: 'Education', icon: GraduationCap },
];

const EXPERIENCE = [
  { id: 'new', label: 'New to CAD' },
  { id: 'some', label: 'Some experience' },
  { id: 'expert', label: 'CAD expert' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [useCase, setUseCase] = useState('');
  const [experience, setExperience] = useState('');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    api.me()
      .then(({ user }) => {
        if (user.onboardingCompleted) {
          router.push('/dashboard');
          return;
        }
        setName(user.name || '');
        setUseCase(user.onboarding?.useCase || '');
        setExperience(user.onboarding?.experience || '');
        setGoal(user.onboarding?.goal || '');
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function save(partial: Record<string, string | boolean>, nextStep?: number) {
    setSaving(true);
    setError('');
    try {
      const { user } = await api.completeOnboarding(partial);
      setStoredUser(user);
      if (partial.complete) {
        router.push('/dashboard');
      } else if (nextStep) {
        setStep(nextStep);
      }
    } catch (err) {
      setError(sanitizeUserError(err instanceof Error ? err.message : '', 'save'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center auth-scene">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <AuthShell
      title={step === 1 ? 'What should we call you?' : step === 2 ? `How will you use ${BRAND_NAME}?` : 'What do you want to build first?'}
      subtitle={step === 3 ? 'What do you want to build first?' : 'Personalize your studio'}
      step={step}
      totalSteps={3}
    >
      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl p-3 mb-4">{error}</div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <input
            className="auth-input"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="auth-btn-primary w-full"
            disabled={!name.trim() || saving}
            onClick={() => save({ name: name.trim() }, 2)}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Continue'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">I&apos;m here for</p>
          <div className="grid gap-2">
            {USE_CASES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setUseCase(id)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  useCase === id
                    ? 'border-brand bg-brand/10 text-white'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                }`}
              >
                <Icon className="w-5 h-5 text-brand shrink-0" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-wide pt-2">CAD experience</p>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setExperience(id)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  experience === id
                    ? 'border-brand bg-brand/15 text-brand'
                    : 'border-white/15 text-gray-400 hover:border-white/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="auth-btn-primary w-full"
            disabled={!useCase || !experience || saving}
            onClick={() => save({ useCase, experience }, 3)}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Next level'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <textarea
            className="auth-input min-h-[100px] resize-none"
            placeholder="e.g. Robot arm bracket, enclosure with M3 screws, 30mm test cube…"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <button
            type="button"
            className="auth-btn-primary w-full flex items-center justify-center gap-2"
            disabled={saving}
            onClick={() => save({ goal, complete: true })}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Enter dashboard
              </>
            )}
          </button>
        </div>
      )}
    </AuthShell>
  );
}
