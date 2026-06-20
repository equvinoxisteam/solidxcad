'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Check, CreditCard, ImagePlus, Loader2, User } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { BRAND_NAME } from '@/lib/brand';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      setError('');
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
        name: `${BRAND_NAME} Pro`,
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
    <div className="dashboard-scene min-h-screen relative overflow-hidden">
      <div className="auth-bg opacity-50" aria-hidden />
      <div className="auth-grid opacity-30" aria-hidden />

      <div className="relative z-10 min-h-screen">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

        <DashboardShell>
          <header className="dashboard-page-header dashboard-page-header-settings">
            <div>
              <p className="dashboard-page-eyebrow">Account</p>
              <h1 className="dashboard-page-title">Settings</h1>
              <p className="dashboard-page-subtitle">Manage your profile and subscription</p>
            </div>
          </header>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : user ? (
            <div className="settings-stack">
              {error && (
                <div className="dashboard-alert dashboard-alert-error">{error}</div>
              )}

              <section className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-icon">
                    <User className="w-5 h-5 text-brand" aria-hidden />
                  </div>
                  <h2 className="settings-card-title">Profile</h2>
                </div>

                <form onSubmit={saveProfile} className="settings-form">
                  <div className="settings-avatar-row">
                    <div className="settings-avatar-preview">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarPreview} alt="Profile" className="settings-avatar-image" />
                      ) : (
                        <div className="settings-avatar-fallback">
                          <User className="w-7 h-7 text-brand" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="settings-avatar-actions">
                      <p className="settings-field-label">Profile photo</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onAvatarPick}
                        className="sr-only"
                        aria-label="Upload profile photo"
                      />
                      <button
                        type="button"
                        className="settings-upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="w-4 h-4 shrink-0" aria-hidden />
                        Upload photo
                      </button>
                      <p className="settings-field-hint">JPG or PNG, max 2.5 MB. Used by the agent for context.</p>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label className="settings-field-label" htmlFor="settings-name">
                      Display name
                    </label>
                    <input
                      id="settings-name"
                      className="auth-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </div>

                  <div className="settings-field">
                    <label className="settings-field-label" htmlFor="settings-phone">
                      Phone
                    </label>
                    <input
                      id="settings-phone"
                      className="auth-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 000 0000"
                      autoComplete="tel"
                    />
                  </div>

                  <div className="settings-field">
                    <label className="settings-field-label" htmlFor="settings-email">
                      Email
                    </label>
                    <input
                      id="settings-email"
                      className="auth-input settings-input-readonly"
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
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      ) : saved ? (
                        <>
                          <Check className="w-4 h-4" aria-hidden />
                          Saved
                        </>
                      ) : (
                        'Save changes'
                      )}
                    </button>
                  )}
                </form>
              </section>

              <section className="settings-card">
                <div className="settings-card-header settings-card-header-split">
                  <h2 className="settings-card-title">Credits</h2>
                  <span className="settings-plan-pill">{user.plan} plan</span>
                </div>

                {usage && (
                  <>
                    <div className="settings-credits-row">
                      <div>
                        <p className="settings-credits-value">{formatCreditCount(usage.remaining)}</p>
                        <p className="settings-credits-label">credits remaining</p>
                      </div>
                      {usage.unlimited ? (
                        <span className="settings-plan-pill">No monthly cap</span>
                      ) : usage.limit != null ? (
                        <p className="settings-credits-limit">
                          of {formatCreditCount(usage.limit)}
                          <span>monthly allowance</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="settings-progress-wrap">
                      <div className="settings-progress-bar">
                        <div
                          className="settings-progress-fill"
                          style={{ width: `${usage.percentRemaining}%` }}
                        />
                      </div>
                      <p className="settings-field-hint">
                        {usage.unlimited
                          ? 'Unlimited usage is enabled on this workspace. Credits are shown for reference.'
                          : `${formatCreditCount(usage.used)} used · ${formatCreditCount(usage.remaining)} left this cycle`}
                      </p>
                    </div>
                  </>
                )}
              </section>

              <section className="settings-card">
                <h2 className="settings-card-title mb-4">Subscription</h2>
                <div className="settings-kv-row">
                  <span className="settings-kv-label">Plan</span>
                  <span className="settings-kv-value">{user.plan}</span>
                </div>
                <div className="settings-kv-row">
                  <span className="settings-kv-label">Billing status</span>
                  <span className="settings-kv-value settings-kv-value-accent">
                    {usage?.unlimited ? 'Unlimited access' : `${formatCredits(user)} remaining`}
                  </span>
                </div>
              </section>

              {user.plan !== 'pro' && billing && (
                <section className="settings-card settings-card-pro">
                  <h2 className="settings-card-title flex items-center gap-2 mb-1">
                    <CreditCard className="w-5 h-5 text-brand" aria-hidden />
                    Upgrade to Pro
                  </h2>
                  <p className="settings-field-hint mb-4">
                    ${billing.plan.amountUsd}/month · {billing.plan.credits} credits · unlimited projects
                  </p>
                  <button
                    type="button"
                    onClick={upgrade}
                    className="auth-btn-primary flex items-center justify-center gap-2 w-full sm:w-auto px-6"
                    disabled={paying}
                  >
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : 'Pay with Razorpay'}
                  </button>
                </section>
              )}
            </div>
          ) : null}
        </DashboardShell>
      </div>
    </div>
  );
}
