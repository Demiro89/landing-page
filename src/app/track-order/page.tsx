'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

type Order = {
  id: string;
  service: 'YOUTUBE' | 'DISNEY' | 'SURFSHARK';
  status: string;
  amount: number;
  paymentMethod: string;
  gmail: string | null;
  invitationSentAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  stripeSubscriptionId: string | null;
  cancelAtEnd: boolean;
  paymentFailed: boolean;
  slot: {
    profileNumber: number;
    pinCode: string | null;
    masterAccount: { email: string; password: string } | null;
  } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PAYMENT_DECLARED: { label: 'Paiement déclaré',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: 'fa-clock' },
  PENDING:          { label: 'En attente',           color: '#8888aa', bg: 'rgba(136,136,170,0.1)', icon: 'fa-hourglass-half' },
  CONFIRMED:        { label: 'Confirmé',             color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  icon: 'fa-circle-check' },
  ACTIVE:           { label: 'Actif',                color: '#00ffaa', bg: 'rgba(0,255,170,0.1)',   icon: 'fa-bolt' },
  EXPIRED:          { label: 'Expiré',               color: '#ff3b3b', bg: 'rgba(255,59,59,0.1)',   icon: 'fa-circle-xmark' },
  CANCELLED:        { label: 'Annulé',               color: '#ff3b3b', bg: 'rgba(255,59,59,0.1)',   icon: 'fa-ban' },
};

const METHOD_LABELS: Record<string, string> = {
  PAYPAL:     'PayPal',
  SOL:        'Solana',
  XRP:        'XRP',
  USDT_TRC20: 'USDT TRC-20',
  STRIPE:     'Carte / Apple Pay',
};

// Inner component — uses useSearchParams(), must be inside <Suspense>
function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP flow
  type Step = 'email' | 'otp' | 'results';
  const [step, setStep] = useState<Step>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  // Cancel subscription state
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelledOrders, setCancelledOrders] = useState<Set<string>>(new Set());

  // Report state
  const [reportOrderId, setReportOrderId] = useState<string | null>(null);
  const [reportIssue, setReportIssue] = useState('ACCESS');
  const [reportMessage, setReportMessage] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<Set<string>>(new Set());

  // Portal (update card) state
  const [portalLoading, setPortalLoading] = useState<string | null>(null);

  // Copy-to-clipboard state (fieldKey = `${orderId}-email` | `${orderId}-password` | `${orderId}-pin`)
  const [copiedField, setCopiedField] = useState<string | null>(null);

  function handleCopy(text: string, fieldKey: string) {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  }

  // Pre-fill email from URL param or localStorage (no auto-send)
  useEffect(() => {
    const urlEmail = searchParams.get('email');
    if (urlEmail) {
      setEmail(urlEmail);
    } else {
      try {
        const stored = localStorage.getItem('sm_last_order');
        if (stored) {
          const { email: storedEmail } = JSON.parse(stored);
          if (storedEmail) setEmail(storedEmail);
        }
      } catch { /* ignore */ }
    }
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown countdown for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleSendCode() {
    const target = email.toLowerCase().trim();
    setError('');
    if (!target.includes('@')) {
      setError('Veuillez saisir une adresse email valide.');
      return;
    }
    setLoading(true);
    try {
      await fetch('/api/verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
      // Always transition to OTP step (even if email not found — anti-enumeration)
      setStep('otp');
      setResendCooldown(60);
      setTimeout(() => otpRef.current?.focus(), 100);
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setOtpError('');
    if (otpCode.length !== 6) {
      setOtpError('Entrez le code à 6 chiffres reçu par email.');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch('/api/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Code invalide.');
      setOrders(data.orders ?? []);
      setStep('results');
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Code invalide.');
      setOtpCode('');
      otpRef.current?.focus();
    } finally {
      setOtpLoading(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  function daysLeft(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  async function handleCancelSubscription(orderId: string) {
    setCancelLoading(true);
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors de la résiliation.');
      setCancelledOrders((prev) => new Set(prev).add(orderId));
      // Update local order state
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, cancelAtEnd: true } : o))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur résiliation.');
    } finally {
      setCancelLoading(false);
      setCancelConfirmId(null);
    }
  }

  async function handleOpenPortal(orderId: string) {
    setPortalLoading(orderId);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur portail.');
      window.location.href = data.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Impossible d\'ouvrir le portail Stripe.');
    } finally {
      setPortalLoading(null);
    }
  }

  async function handleReport(orderId: string) {
    setReportLoading(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, email, issue: reportIssue, message: reportMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur lors du signalement.');
      setReportSuccess((prev) => new Set(prev).add(orderId));
      setReportOrderId(null);
      setReportMessage('');
      setReportIssue('ACCESS');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur réseau. Réessayez.');
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', padding: '100px 24px 80px', maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '999px', padding: '6px 16px', fontSize: '0.72rem',
            letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            color: 'var(--green)', marginBottom: '20px',
          }}>
            <i className="fa-solid fa-magnifying-glass" />
            Suivi de commande
          </div>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontSize: 'clamp(1.8rem, 5vw, 2.4rem)',
            fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '12px',
          }}>
            Retrouvez vos commandes
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Entrez votre email pour voir le statut de vos abonnements.
          </p>
        </div>

        {/* ── ÉTAPE 1 : Saisie email ── */}
        {step === 'email' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendCode(); }}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '16px', padding: '24px', marginBottom: '16px',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
              Votre adresse email
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  required
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border2)', borderRadius: '9px',
                    padding: '11px 14px', fontSize: '0.88rem', color: 'var(--text)',
                    outline: 'none', fontFamily: 'DM Sans, sans-serif',
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                    color: '#fff', border: 'none', borderRadius: '9px',
                    padding: '11px 20px', fontFamily: 'Syne, sans-serif',
                    fontWeight: 700, fontSize: '0.88rem', cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' as const,
                  }}
                >
                  {loading
                    ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} />Envoi...</>
                    : <><i className="fa-solid fa-paper-plane" style={{ marginRight: '6px' }} />Recevoir le code</>
                  }
                </button>
              </div>
            </label>
            {error && (
              <div style={{
                marginTop: '12px', background: 'rgba(255,59,59,0.08)',
                border: '1px solid rgba(255,59,59,0.25)', borderRadius: '8px',
                padding: '10px 14px', fontSize: '0.82rem', color: '#ff6b6b',
              }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }} />
                {error}
              </div>
            )}
          </form>
        )}

        {/* ── Skeleton : vérification OTP en cours ── */}
        {step === 'otp' && otpLoading && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px', marginBottom: '16px' }}>
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '14px', padding: '18px 20px',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: '14px', width: '40%', borderRadius: '6px', marginBottom: '6px' }} />
                    <div className="skeleton" style={{ height: '10px', width: '25%', borderRadius: '5px' }} />
                  </div>
                  <div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '999px', flexShrink: 0 }} />
                </div>
                {/* Details row */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                  <div className="skeleton" style={{ height: '11px', width: '30%', borderRadius: '5px' }} />
                  <div className="skeleton" style={{ height: '11px', width: '20%', borderRadius: '5px' }} />
                  <div className="skeleton" style={{ height: '11px', width: '25%', borderRadius: '5px' }} />
                </div>
                {/* Button */}
                <div className="skeleton" style={{ height: '36px', borderRadius: '9px' }} />
              </div>
            ))}
          </div>
        )}

        {/* ── ÉTAPE 2 : Saisie OTP ── */}
        {step === 'otp' && !otpLoading && (
          <form
            onSubmit={handleVerifyCode}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '16px', padding: '28px 24px', marginBottom: '16px',
            }}
          >
            {/* Icône + titre */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', margin: '0 auto 14px',
              }}>
                <i className="fa-solid fa-envelope-open-text" />
              </div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>
                Vérification de votre identité
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                Un code à 6 chiffres a été envoyé à{' '}
                <strong style={{ color: 'var(--text)' }}>{email}</strong>.<br/>
                Valable 15 minutes.
              </p>
            </div>

            {/* Input OTP */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '16px' }}>
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
                style={{
                  textAlign: 'center', letterSpacing: '0.4em',
                  fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '2rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${otpError ? 'rgba(255,59,59,0.5)' : 'rgba(99,102,241,0.4)'}`,
                  borderRadius: '12px', padding: '16px',
                  color: 'var(--text)', outline: 'none', width: '100%',
                  boxSizing: 'border-box' as const,
                  transition: 'border-color 0.2s',
                }}
              />
              <button
                type="submit"
                disabled={otpLoading || otpCode.length !== 6}
                style={{
                  background: otpCode.length === 6
                    ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                    : 'rgba(255,255,255,0.06)',
                  color: otpCode.length === 6 ? '#fff' : 'var(--muted)',
                  border: 'none', borderRadius: '10px',
                  padding: '13px', fontFamily: 'Syne, sans-serif',
                  fontWeight: 700, fontSize: '0.92rem',
                  cursor: otpLoading || otpCode.length !== 6 ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {otpLoading
                  ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '7px' }} />Vérification...</>
                  : <><i className="fa-solid fa-unlock" style={{ marginRight: '7px' }} />Accéder à mes commandes</>
                }
              </button>
            </div>

            {otpError && (
              <div style={{
                background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.25)',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '0.82rem', color: '#ff6b6b', marginBottom: '12px',
              }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }} />
                {otpError}
              </div>
            )}

            {/* Renvoyer / changer d'email */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '8px' }}>
              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={() => { setOtpCode(''); setOtpError(''); handleSendCode(); }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: resendCooldown > 0 ? 'var(--muted)' : '#6366f1',
                  fontSize: '0.79rem', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                <i className="fa-solid fa-rotate-right" style={{ marginRight: '5px' }} />
                {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : loading ? 'Envoi...' : 'Renvoyer le code'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setOtpCode(''); setOtpError(''); setError(''); }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--muted)', fontSize: '0.79rem', cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                <i className="fa-solid fa-arrow-left" style={{ marginRight: '5px' }} />
                Changer d&apos;email
              </button>
            </div>
          </form>
        )}

        {/* Info résiliation — visible sur les étapes email & otp */}
        {step !== 'results' && (
          <div style={{
            marginBottom: '28px', padding: '12px 16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '10px', fontSize: '0.78rem',
            color: 'var(--muted)', lineHeight: 1.6,
          }}>
            💡 <strong style={{ color: 'var(--text)' }}>Info résiliation :</strong> Pour les abonnements par carte, un bouton "Gérer mon abonnement" apparaîtra une fois votre email validé. Pour PayPal, il n&apos;y a aucun prélèvement automatique, votre accès s&apos;arrêtera simplement à la fin de la période payée si vous ne renouvelez pas.
          </div>
        )}

        {/* ── ÉTAPE 3 : Résultats ── */}
        {step === 'results' && (
          orders.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 24px',
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
            }}>
              <i className="fa-solid fa-inbox" style={{ fontSize: '2rem', color: 'var(--muted)', marginBottom: '12px', display: 'block' }} />
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                Aucune commande trouvée pour cet email.
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                Vérifiez l'adresse saisie ou <a href="/#offres" style={{ color: '#3b82f6' }}>passez une commande</a>.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>
                {orders.length} commande{orders.length > 1 ? 's' : ''} trouvée{orders.length > 1 ? 's' : ''}
              </p>
              {orders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['PENDING'];
                const isActive = order.status === 'ACTIVE';
                const days = order.expiresAt ? daysLeft(order.expiresAt) : null;
                const urgent = days !== null && days <= 5;
                const isExpired =
                  order.status === 'EXPIRED' ||
                  order.status === 'CANCELLED' ||
                  (isActive && days !== null && days <= 0);
                const isCancelledAtEnd = order.cancelAtEnd || cancelledOrders.has(order.id);
                const hasStripe = Boolean(order.stripeSubscriptionId);

                return (
                  <div
                    key={order.id}
                    style={{
                      background: 'var(--card)',
                      border: `1px solid ${isActive ? 'rgba(0,255,170,0.2)' : 'var(--border)'}`,
                      borderRadius: '14px', padding: '18px 20px',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.transform = '')}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap' as const, gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                          background: order.service === 'YOUTUBE' ? 'rgba(255,59,59,0.15)' : order.service === 'DISNEY' ? 'rgba(124,58,237,0.15)' : 'rgba(0,199,224,0.15)',
                          color: order.service === 'YOUTUBE' ? 'var(--yt)' : order.service === 'DISNEY' ? '#a78bfa' : '#00c7e0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem',
                        }}>
                          <i className={order.service === 'YOUTUBE' ? 'fa-brands fa-youtube' : order.service === 'DISNEY' ? 'fa-solid fa-wand-magic-sparkles' : 'fa-solid fa-shield-halved'} />
                        </div>
                        <div>
                          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.92rem' }}>
                            {order.service === 'YOUTUBE' ? 'YouTube Premium' : order.service === 'DISNEY' ? 'Disney+ 4K' : 'Surfshark VPN One'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                            #{order.id.slice(0, 12).toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        background: cfg.bg, color: cfg.color,
                        border: `1px solid ${cfg.color}30`,
                        borderRadius: '999px', padding: '4px 10px',
                        fontSize: '0.74rem', fontWeight: 700,
                      }}>
                        <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: '0.65rem' }} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Details row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '16px', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '14px' }}>
                      <span><i className="fa-solid fa-calendar" style={{ marginRight: '5px' }} />Commandé le {formatDate(order.createdAt)}</span>
                      <span><i className="fa-solid fa-euro-sign" style={{ marginRight: '5px' }} />{order.amount.toFixed(2).replace('.', ',')}€/mois</span>
                      <span><i className="fa-solid fa-credit-card" style={{ marginRight: '5px' }} />{METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
                    </div>

                    {/* YouTube invitation status */}
                    {order.service === 'YOUTUBE' && isActive && (
                      <div style={{
                        background: order.invitationSentAt ? 'rgba(0,255,170,0.05)' : 'rgba(245,158,11,0.05)',
                        border: `1px solid ${order.invitationSentAt ? 'rgba(0,255,170,0.2)' : 'rgba(245,158,11,0.2)'}`,
                        borderRadius: '8px', padding: '10px 14px',
                        marginBottom: '10px',
                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem',
                      }}>
                        {order.invitationSentAt ? (
                          <>
                            <i className="fa-solid fa-circle-check" style={{ color: '#00ffaa', flexShrink: 0 }} />
                            <span>
                              <span style={{ color: '#00ffaa', fontWeight: 600 }}>
                                L&apos;invitation a été envoyée sur votre adresse Gmail !
                              </span>
                              {' '}
                              <span style={{ color: 'var(--muted)' }}>Vérifiez vos spams.</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-clock" style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span style={{ color: '#f59e0b' }}>
                              En attente de l&apos;envoi de l&apos;invitation YouTube Premium
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Disney+ credentials (ACTIVE + slot assigned) */}
                    {order.service === 'DISNEY' && isActive && order.slot?.masterAccount && (
                      <div style={{
                        background: 'rgba(124,58,237,0.06)',
                        border: '1px solid rgba(124,58,237,0.25)',
                        borderRadius: '10px', padding: '14px 16px',
                        marginBottom: '10px',
                      }}>
                        <p style={{
                          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem',
                          marginBottom: '12px', color: '#a78bfa',
                          display: 'flex', alignItems: 'center', gap: '7px',
                        }}>
                          <i className="fa-solid fa-key" />
                          Accès Disney+ 4K
                        </p>

                        {/* Email / identifiant */}
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                            Identifiant (email du compte)
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <code style={{
                              flex: 1, background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border2)', borderRadius: '7px',
                              padding: '8px 12px', fontSize: '0.82rem',
                              color: 'var(--text)', fontFamily: 'monospace',
                              wordBreak: 'break-all' as const,
                            }}>
                              {order.slot.masterAccount.email}
                            </code>
                            <button
                              className={`copy-btn${copiedField === `${order.id}-email` ? ' copied' : ''}`}
                              onClick={() => handleCopy(order.slot!.masterAccount!.email, `${order.id}-email`)}
                              style={{ flexShrink: 0 }}
                            >
                              <i className={`fa-solid ${copiedField === `${order.id}-email` ? 'fa-check' : 'fa-copy'}`} style={{ marginRight: '4px' }} />
                              {copiedField === `${order.id}-email` ? 'Copié !' : 'Copier'}
                            </button>
                          </div>
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                            Mot de passe
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <code style={{
                              flex: 1, background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border2)', borderRadius: '7px',
                              padding: '8px 12px', fontSize: '0.82rem',
                              color: 'var(--text)', fontFamily: 'monospace',
                              wordBreak: 'break-all' as const,
                            }}>
                              {order.slot.masterAccount.password}
                            </code>
                            <button
                              className={`copy-btn${copiedField === `${order.id}-password` ? ' copied' : ''}`}
                              onClick={() => handleCopy(order.slot!.masterAccount!.password, `${order.id}-password`)}
                              style={{ flexShrink: 0 }}
                            >
                              <i className={`fa-solid ${copiedField === `${order.id}-password` ? 'fa-check' : 'fa-copy'}`} style={{ marginRight: '4px' }} />
                              {copiedField === `${order.id}-password` ? 'Copié !' : 'Copier'}
                            </button>
                          </div>
                        </div>

                        {/* Profile + PIN */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                          <div style={{ flex: 1, minWidth: '120px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                              Profil à utiliser
                            </div>
                            <code style={{
                              display: 'block', background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border2)', borderRadius: '7px',
                              padding: '8px 12px', fontSize: '0.88rem',
                              color: '#a78bfa', fontFamily: 'Syne, sans-serif', fontWeight: 700,
                            }}>
                              Profil {order.slot.profileNumber}
                            </code>
                          </div>
                          {order.slot.pinCode && (
                            <div style={{ flex: 1, minWidth: '120px' }}>
                              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                                Code PIN profil
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <code style={{
                                  flex: 1, background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border2)', borderRadius: '7px',
                                  padding: '8px 12px', fontSize: '0.88rem',
                                  color: '#a78bfa', fontFamily: 'Syne, sans-serif', fontWeight: 700,
                                  letterSpacing: '0.15em',
                                }}>
                                  {order.slot.pinCode}
                                </code>
                                <button
                                  className={`copy-btn${copiedField === `${order.id}-pin` ? ' copied' : ''}`}
                                  onClick={() => handleCopy(order.slot!.pinCode!, `${order.id}-pin`)}
                                  style={{ flexShrink: 0 }}
                                >
                                  <i className={`fa-solid ${copiedField === `${order.id}-pin` ? 'fa-check' : 'fa-copy'}`} style={{ marginRight: '4px' }} />
                                  {copiedField === `${order.id}-pin` ? 'Copié !' : 'Copier'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '10px', lineHeight: 1.5 }}>
                          <i className="fa-solid fa-circle-info" style={{ marginRight: '5px' }} />
                          Connectez-vous sur Disney+ avec ces identifiants, puis sélectionnez le <strong style={{ color: 'var(--text)' }}>Profil {order.slot.profileNumber}</strong>. Ne modifiez pas le mot de passe ni les autres profils.
                        </p>
                      </div>
                    )}

                    {/* Expiry bar (ACTIVE seulement) */}
                    {isActive && order.expiresAt && days !== null && days > 0 && (
                      <div style={{
                        background: urgent ? 'rgba(245,158,11,0.06)' : 'rgba(0,255,170,0.04)',
                        border: `1px solid ${urgent ? 'rgba(245,158,11,0.3)' : 'rgba(0,255,170,0.15)'}`,
                        borderRadius: '8px', padding: '10px 14px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: urgent ? '0' : '14px',
                        flexWrap: 'wrap' as const, gap: '6px',
                      }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          <i className="fa-solid fa-clock" style={{ marginRight: '5px' }} />
                          Expire le {formatDate(order.expiresAt)}
                        </span>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: urgent ? '#f59e0b' : 'var(--green)' }}>
                          J-{days}
                        </span>
                      </div>
                    )}

                    {/* Bannière échec de prélèvement */}
                    {order.paymentFailed && isActive && (
                      <div style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.45)',
                        borderRadius: '10px', padding: '14px 16px',
                        marginBottom: '10px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b', fontSize: '1.1rem', marginTop: '2px', flexShrink: 0 }} />
                          <div>
                            <p style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.86rem', margin: '0 0 4px' }}>
                              Échec de prélèvement
                            </p>
                            <p style={{ color: 'var(--muted)', fontSize: '0.79rem', margin: 0, lineHeight: 1.5 }}>
                              Votre paiement a échoué. Mettez à jour votre carte bancaire pour conserver votre accès.
                            </p>
                          </div>
                        </div>
                        {hasStripe && (
                          <button
                            onClick={() => handleOpenPortal(order.id)}
                            disabled={portalLoading === order.id}
                            style={{
                              width: '100%', padding: '10px', borderRadius: '8px',
                              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                              color: '#000', border: 'none', fontFamily: 'Syne, sans-serif',
                              fontWeight: 700, fontSize: '0.83rem', cursor: portalLoading === order.id ? 'not-allowed' : 'pointer',
                              opacity: portalLoading === order.id ? 0.7 : 1,
                            }}
                          >
                            {portalLoading === order.id
                              ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '7px' }} />Chargement...</>
                              : <><i className="fa-solid fa-credit-card" style={{ marginRight: '7px' }} />Mettre à jour ma carte bancaire</>
                            }
                          </button>
                        )}
                      </div>
                    )}

                    {/* Résiliation programmée */}
                    {isActive && isCancelledAtEnd && !isExpired && (
                      <div style={{
                        background: 'rgba(255,59,59,0.06)',
                        border: '1px solid rgba(255,59,59,0.25)',
                        borderRadius: '8px', padding: '10px 14px',
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        marginBottom: '10px', fontSize: '0.82rem',
                      }}>
                        <i className="fa-solid fa-calendar-xmark" style={{ color: '#ff6b6b', marginTop: '2px', flexShrink: 0 }} />
                        <span style={{ color: '#ff6b6b', lineHeight: 1.5 }}>
                          <strong>Résiliation enregistrée.</strong> Aucun futur prélèvement.
                          {order.expiresAt && (
                            <> Votre accès reste actif jusqu&apos;au <strong>{formatDate(order.expiresAt)}</strong>.</>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Alerte urgence (≤ 5 jours) */}
                    {isActive && urgent && days !== null && days > 0 && (
                      <div style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.35)',
                        borderRadius: '8px', padding: '10px 14px',
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        marginTop: '8px', marginBottom: '14px', fontSize: '0.82rem',
                      }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b', marginTop: '2px', flexShrink: 0 }} />
                        <span style={{ color: '#f59e0b', lineHeight: 1.5 }}>
                          <strong>Attention, votre accès expire bientôt.</strong>
                          {' '}Pensez à renouveler pour éviter une coupure de service.
                        </span>
                      </div>
                    )}

                    {/* Bloc "Accès expiré" */}
                    {isExpired && (
                      <div style={{
                        background: 'rgba(255,59,59,0.06)',
                        border: '1px solid rgba(255,59,59,0.25)',
                        borderRadius: '10px', padding: '16px',
                        marginBottom: '14px', textAlign: 'center' as const,
                      }}>
                        <i className="fa-solid fa-circle-xmark" style={{ fontSize: '1.6rem', color: '#ff6b6b', marginBottom: '8px', display: 'block' }} />
                        <p style={{ color: '#ff6b6b', fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px' }}>
                          Accès expiré
                        </p>
                        <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '14px' }}>
                          Votre abonnement a pris fin. Souscrivez à un nouvel abonnement pour retrouver l&apos;accès.
                        </p>
                        <a
                          href="/#offres"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                            background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                            color: '#fff', borderRadius: '9px', padding: '10px 20px',
                            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem',
                            textDecoration: 'none',
                          }}
                        >
                          <i className="fa-solid fa-rotate-right" />
                          Renouveler mon abonnement
                        </a>
                      </div>
                    )}

                    {/* Bouton Renouveler (urgent mais pas encore expiré) */}
                    {isActive && urgent && days !== null && days > 0 && (
                      <a
                        href="/#offres"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                          width: '100%', padding: '10px', borderRadius: '9px', marginBottom: '8px',
                          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
                          color: '#f59e0b', fontSize: '0.82rem', fontWeight: 700,
                          fontFamily: 'Syne, sans-serif', textDecoration: 'none',
                          boxSizing: 'border-box' as const,
                        }}
                      >
                        <i className="fa-solid fa-rotate-right" />
                        Renouveler maintenant
                      </a>
                    )}

                    {/* Bouton résilier abonnement */}
                    {isActive && hasStripe && !isCancelledAtEnd && !isExpired && (
                      <button
                        onClick={() => setCancelConfirmId(order.id)}
                        style={{
                          width: '100%', padding: '9px', borderRadius: '9px',
                          border: '1px solid rgba(255,59,59,0.3)',
                          background: 'rgba(255,59,59,0.05)',
                          color: '#ff6b6b', fontSize: '0.79rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                          marginBottom: '6px',
                        }}
                      >
                        <i className="fa-solid fa-ban" style={{ marginRight: '6px' }} />
                        Résilier l&apos;abonnement
                      </button>
                    )}

                    {/* Signaler un problème */}
                    {reportSuccess.has(order.id) ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'rgba(0,255,170,0.06)', border: '1px solid rgba(0,255,170,0.2)',
                        borderRadius: '8px', padding: '10px 14px',
                        fontSize: '0.8rem', color: '#00ffaa', marginBottom: '8px',
                      }}>
                        <i className="fa-solid fa-circle-check" />
                        Signalement envoyé — nous allons traiter votre demande rapidement.
                      </div>
                    ) : reportOrderId === order.id ? (
                      <div style={{
                        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: '10px', padding: '14px 16px', marginBottom: '8px',
                      }}>
                        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem', marginBottom: '10px' }}>
                          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b', marginRight: '7px' }} />
                          Signaler un problème
                        </p>
                        <select
                          value={reportIssue}
                          onChange={(e) => setReportIssue(e.target.value)}
                          style={{
                            width: '100%', background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border2)', borderRadius: '7px',
                            padding: '9px 12px', fontSize: '0.82rem', color: 'var(--text)',
                            fontFamily: 'DM Sans, sans-serif', marginBottom: '8px',
                            outline: 'none',
                          }}
                        >
                          <option value="ACCESS">🔑 Accès impossible</option>
                          <option value="BILLING">💳 Problème de facturation</option>
                          <option value="OTHER">❓ Autre</option>
                        </select>
                        <textarea
                          value={reportMessage}
                          onChange={(e) => setReportMessage(e.target.value)}
                          placeholder="Décrivez le problème (optionnel)..."
                          maxLength={500}
                          rows={3}
                          style={{
                            width: '100%', background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border2)', borderRadius: '7px',
                            padding: '9px 12px', fontSize: '0.8rem', color: 'var(--text)',
                            fontFamily: 'DM Sans, sans-serif', resize: 'vertical' as const,
                            marginBottom: '10px', outline: 'none', boxSizing: 'border-box' as const,
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => { setReportOrderId(null); setReportMessage(''); }}
                            disabled={reportLoading}
                            style={{
                              flex: 1, padding: '9px', borderRadius: '7px',
                              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border2)',
                              color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                            }}
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleReport(order.id)}
                            disabled={reportLoading}
                            style={{
                              flex: 2, padding: '9px', borderRadius: '7px',
                              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
                              color: '#f59e0b', fontSize: '0.8rem', fontWeight: 700,
                              cursor: reportLoading ? 'not-allowed' : 'pointer',
                              opacity: reportLoading ? 0.7 : 1, fontFamily: 'Syne, sans-serif',
                            }}
                          >
                            {reportLoading
                              ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} />Envoi...</>
                              : <><i className="fa-solid fa-paper-plane" style={{ marginRight: '6px' }} />Envoyer le signalement</>
                            }
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReportOrderId(order.id)}
                        style={{
                          width: '100%', padding: '9px', borderRadius: '9px', marginBottom: '8px',
                          border: '1px solid rgba(245,158,11,0.25)',
                          background: 'rgba(245,158,11,0.04)',
                          color: 'var(--muted)', fontSize: '0.79rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                        }}
                      >
                        <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px', color: '#f59e0b' }} />
                        Signaler un problème
                      </button>
                    )}

                    {/* CTA espace client */}
                    {!isExpired && (
                      <button
                        onClick={() => router.push(`/dashboard?orderId=${order.id}&email=${encodeURIComponent(email)}`)}
                        style={{
                          width: '100%', padding: '10px', borderRadius: '9px',
                          border: '1px solid var(--border2)', background: 'rgba(255,255,255,0.03)',
                          color: 'var(--muted)', fontSize: '0.82rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                          transition: 'background 0.2s, color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
                        }}
                      >
                        <i className="fa-solid fa-gauge-high" style={{ marginRight: '7px' }} />
                        Voir le détail dans mon espace client
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Modal confirmation résiliation */}
        {cancelConfirmId && (
          <div
            onClick={() => !cancelLoading && setCancelConfirmId(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '24px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: '18px', padding: '32px 28px',
                maxWidth: '400px', width: '100%', textAlign: 'center',
              }}
            >
              <div style={{
                width: '52px', height: '52px', borderRadius: '12px',
                background: 'rgba(255,59,59,0.12)', color: '#ff6b6b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', margin: '0 auto 20px',
              }}>
                <i className="fa-solid fa-ban" />
              </div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem', marginBottom: '10px' }}>
                Résilier l&apos;abonnement ?
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '22px' }}>
                Votre accès restera actif jusqu&apos;à la fin de la période en cours.
                Aucun prélèvement futur ne sera effectué.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setCancelConfirmId(null)}
                  disabled={cancelLoading}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '9px',
                    border: '1px solid var(--border2)', background: 'rgba(255,255,255,0.04)',
                    color: 'var(--muted)', fontFamily: 'Syne, sans-serif',
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleCancelSubscription(cancelConfirmId)}
                  disabled={cancelLoading}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '9px',
                    background: cancelLoading ? 'rgba(255,59,59,0.4)' : 'rgba(255,59,59,0.15)',
                    border: '1px solid rgba(255,59,59,0.4)',
                    color: '#ff6b6b', fontFamily: 'Syne, sans-serif',
                    fontWeight: 700, fontSize: '0.85rem',
                    cursor: cancelLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cancelLoading
                    ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} />Traitement...</>
                    : 'Confirmer la résiliation'
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Telegram support */}
        <div style={{
          marginTop: '32px', textAlign: 'center',
          padding: '20px', background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: '14px',
        }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '12px' }}>
            Un problème avec votre commande ?
          </p>
          <a
            href="https://t.me/flexnight9493"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)',
              color: '#3b82f6', borderRadius: '10px', padding: '10px 20px',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            <i className="fa-brands fa-telegram" />
            Contacter le support Telegram
          </a>
        </div>

      </main>
      <Footer />
    </>
  );
}

// Default export — wraps content in Suspense (required by Next.js 14 for useSearchParams)
export default function TrackOrderPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: 'var(--muted)' }} />
      </div>
    }>
      <TrackOrderContent />
    </Suspense>
  );
}
