'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Check, CreditCard, Loader2, User } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import {
  api,
  creditUsageSummary,
  formatCreditCount,
  formatCredits,
  getToken,
  setStoredUser,
  type BillingConfig,
  type User as UserType,
} from '@/lib/api';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    Promise.all([api.me(), api.billingConfig()])
      .then(([me, bill]) => {
        setUser(me.user);
        setName(me.user.name || '');
        setPhone(me.user.phone || '');
        setAvatarPreview(me.user.avatarUrl || null);
        setStoredUser(me.user);
        setBilling(bill);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name cannot be empty');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { user: updated } = await api.updateProfile({
        name: trimmed,
        phone: phone.trim(),
        ...(pendingAvatar ? { avatarDataUrl: pendingAvatar } : {}),
      });
      setUser(updated);
      setStoredUser(updated);
      setAvatarPreview(updated.avatarUrl || null);
      setPendingAvatar(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2_500_000) {
      setError('Profile photo must be under 2.5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      setPendingAvatar(data);
      setAvatarPreview(data);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function upgrade() {
    if (!billing || !window.Razorpay) return;
    setPaying(true);
    try {
      const order = await api.createOrder();
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'SolidX CAD Pro',
        description: 'Pro plan subscription',
        order_id: order.orderId,
        handler: async (response: Record<string, string>) => {
          await api.verifyPayment(response);
          const me = await api.me();
          setUser(me.user);
          setStoredUser(me.user);
        },
        theme: { color: '#103A8E' },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  const profileChanged = user && (
    name.trim() !== (user.name || '')
    || phone.trim() !== (user.phone || '')
    || Boolean(pendingAvatar)
  );
  const usage = user ? creditUsageSummary(user, billing) : null;

  return (
    <div className="dashboard-scene min-h-screen flex flex-col relative overflow-hidden">
      <div className="auth-bg opacity-60" aria-hidden />
      <div className="auth-grid opacity-40" aria-hidden />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        <Navbar />

        <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Settings</h1>
          <p className="text-gray-400 text-sm mb-8">Manage your account and subscription</p>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : user ? (
            <div className="space-y-5">
              {error && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl p-3">
                  {error}
                </div>
              )}

              <section className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/85 p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center">
                    <User className="w-5 h-5 text-brand" />
                  </div>
                  <h2 className="font-semibold text-white">Account</h2>
                </div>

                <form onSubmit={saveProfile} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarPreview}
                          alt="Profile"
                          className="w-16 h-16 rounded-full object-cover border border-white/20"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-brand/15 border border-brand/25 flex items-center justify-center">
                          <User className="w-7 h-7 text-brand" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">
                        Profile photo
                      </label>
                      <input type="file" accept="image/*" onChange={onAvatarPick} className="text-xs text-gray-400" />
                      <p className="text-[10px] text-gray-500 mt-1">Used by the agent for personalization context</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">
                      Display name
                    </label>
                    <input
                      className="auth-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">
                      Phone
                    </label>
                    <input
                      className="auth-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 000 0000"
                      autoComplete="tel"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1.5">
                      Email
                    </label>
                    <input
                      className="auth-input opacity-70 cursor-not-allowed"
                      value={user.email}
                      readOnly
                      disabled
                    />
                  </div>

                  {(profileChanged || saved) && (
                    <button
                      type="submit"
                      className="auth-btn-primary flex items-center justify-center gap-2 w-full sm:w-auto px-6"
                      disabled={saving || !name.trim()}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : saved ? (
                        <>
                          <Check className="w-4 h-4" />
                          Saved
                        </>
                      ) : (
                        'Save changes'
                      )}
                    </button>
                  )}
                </form>
              </section>

              <section className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/85 p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-white">Credits</h2>
                  <span className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                    {user.plan} plan
                  </span>
                </div>

                {usage && (
                  <>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-3xl font-semibold text-white tabular-nums tracking-tight">
                          {formatCreditCount(usage.remaining)}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">credits remaining</p>
                      </div>
                      {usage.unlimited ? (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand-muted">
                          No monthly cap
                        </span>
                      ) : usage.limit != null ? (
                        <p className="text-sm text-gray-400 tabular-nums text-right">
                          of {formatCreditCount(usage.limit)}
                          <span className="block text-xs text-gray-500">monthly allowance</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all"
                          style={{ width: `${usage.percentRemaining}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {usage.unlimited
                          ? 'Unlimited usage is enabled on this workspace. Credits are shown for reference.'
                          : `${formatCreditCount(usage.used)} used · ${formatCreditCount(usage.remaining)} left this cycle`}
                      </p>
                    </div>
                  </>
                )}
              </section>

              <section className="auth-card rounded-2xl border border-white/10 bg-[#0a1628]/85 p-6 space-y-3">
                <h2 className="font-semibold text-white">Subscription</h2>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-gray-400">Plan</span>
                  <span className="text-sm font-medium text-white uppercase">{user.plan}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-400">Billing status</span>
                  <span className="text-sm font-medium text-blue-200">
                    {usage?.unlimited ? 'Unlimited access' : `${formatCredits(user)} remaining`}
                  </span>
                </div>
              </section>

              {user.plan !== 'pro' && billing && (
                <section className="auth-card rounded-2xl border border-brand/25 bg-brand/5 p-6">
                  <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-brand" />
                    Upgrade to Pro
                  </h2>
                  <p className="text-sm text-gray-400 mb-4">
                    ${billing.plan.amountUsd}/month · {billing.plan.credits} credits · unlimited projects
                  </p>
                  <button
                    type="button"
                    onClick={upgrade}
                    className="auth-btn-primary flex items-center justify-center gap-2 w-full sm:w-auto px-6"
                    disabled={paying}
                  >
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pay with Razorpay'}
                  </button>
                </section>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
