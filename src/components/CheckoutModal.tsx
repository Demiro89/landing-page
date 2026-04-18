'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Service = 'YOUTUBE' | 'DISNEY' | 'SURFSHARK';
type PaymentMethod = 'PAYPAL' | 'SOL' | 'XRP' | 'USDT_TRC20' | 'STRIPE';
type Duration = 1 | 3 | 6 | 12;
type Step = 'info' | 'payment' | 'declare' | 'success';

// Fallback prices used until API settings are loaded
const PRICE_DEFAULTS: Record<Service, number> = { YOUTUBE: 5.99, DISNEY: 4.99, SURFSHARK: 2.49 };

const DURATION_OPTIONS: { months: Duration; label: string; badge?: string }[] = [
  { months: 1,  label: '1 mois' },
  { months: 3,  label: '3 mois', badge: '-5%' },
  { months: 6,  label: '6 mois', badge: '-10%' },
  { months: 12, label: '12 mois', badge: '-15%' },
];

const SERVICE_LABELS: Record<Service, string> = {
  YOUTUBE: 'YouTube Premium',
  DISNEY: 'Disney+ 4K',
  SURFSHARK: 'Surfshark VPN One',
};

type PublicSettings = {
  price_youtube: string;
  price_disney: string;
  price_surfshark: string;
  paypal_link: string;
  paypal_instruction_1: string;
  paypal_instruction_2: string;
  paypal_instruction_3: string;
};

const WALLETS = {
  SOL: process.env.NEXT_PUBLIC_WALLET_SOL ?? '8aUZeioqmxWJMf6Lfa6BCbv3dCQpMU7KxoQHPwT1Mz9e',
  XRP: process.env.NEXT_PUBLIC_WALLET_XRP ?? 'rPLwSnrUEMZaiV6zZW2gvcgNbtk6ASt3it',
  USDT_TRC20:
    process.env.NEXT_PUBLIC_WALLET_USDT ??
    process.env.NEXT_PUBLIC_WALLET_USDT_TRC20 ??
    'TDN6Jd12G9AoJfD9b46SEThEjKsXzBGUVR',
};

// --------------------------------------
export default function CheckoutModal({
  service,
  onClose,
}: {
  service: Service;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('info');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('STRIPE');
  const [duration, setDuration] = useState<Duration>(1);
  const [email, setEmail] = useState('');
  const [gmail, setGmail] = useState('');
  const [txId, setTxId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'STRIPE' | 'PAYPAL' | 'CRYPTO'>('STRIPE');
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [showPaypalModal, setShowPaypalModal] = useState(false);
  const [paypalChecked, setPaypalChecked] = useState(false);

  // Dynamic settings fetched from DB
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d: PublicSettings) => setSettings(d))
      .catch(() => { /* use defaults silently */ });
  }, []);

  const rawPriceSetting = settings
    ? service === 'YOUTUBE' ? settings.price_youtube
    : service === 'DISNEY' ? settings.price_disney
    : settings.price_surfshark
    : null;
  const price = rawPriceSetting ? parseFloat(rawPriceSetting) || PRICE_DEFAULTS[service] : PRICE_DEFAULTS[service];
  const totalPrice = price * duration;
  const paypalLink = settings?.paypal_link ?? 'https://paypal.me/AccesPremium89';
  const paypalInstructions = [
    settings?.paypal_instruction_1 ?? 'Envoyez en mode "À un proche" — jamais "Biens ou services".',
    settings?.paypal_instruction_2 ?? 'Indiquez votre adresse email dans la note du paiement.',
    settings?.paypal_instruction_3 ?? 'Activation sous 12h après réception.',
  ];
  const label = SERVICE_LABELS[service];

  // -- Helpers --
  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    });
  }, []);

  // -- Step 1 → 2 : Validate email --
  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError('Adresse email invalide.');
      return;
    }
    if (service === 'YOUTUBE' && !gmail.includes('@')) {
      setError('Adresse Gmail invalide (nécessaire pour l\'invitation YouTube).');
      return;
    }
    setStep('payment');
  };

  // -- Stripe redirect --
  const handleStripeCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          service,
          gmail: service === 'YOUTUBE' ? gmail : undefined,
          durationMonths: duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur Stripe.');
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du paiement.');
      setLoading(false);
    }
  };

  // -- Step 3 : Declare payment --
  const handleDeclarePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!txId.trim()) {
      setError('Veuillez saisir votre ID de transaction ou hash.');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          service,
          amount: totalPrice,
          durationMonths: duration,
          paymentMethod,
          paymentTxId: txId.trim(),
          gmail: service === 'YOUTUBE' ? gmail : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Erreur lors de la création de votre commande.');
      }

      setOrderId(data.orderId);

      // Sauvegarde en localStorage pour retrouver la commande plus tard
      try {
        localStorage.setItem('sm_last_order', JSON.stringify({
          orderId: data.orderId,
          email: email.toLowerCase().trim(),
          service,
          createdAt: new Date().toISOString(),
        }));
      } catch { /* ignoré si localStorage bloqué */ }

      setStep('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  // -- Go to dashboard --
  const goToDashboard = () => {
    router.push(`/dashboard?orderId=${orderId}&email=${encodeURIComponent(email)}`);
  };

  function selectTab(tab: 'STRIPE' | 'PAYPAL' | 'CRYPTO') {
    setActiveTab(tab);
    if (tab === 'STRIPE') setPaymentMethod('STRIPE');
    else if (tab === 'PAYPAL') setPaymentMethod('PAYPAL');
    else setPaymentMethod('SOL');
  }

  function renderStep2() {
    const accentColor =
      service === 'YOUTUBE' ? '#ff3b3b' : service === 'DISNEY' ? '#a78bfa' : '#00c7e0';
    const serviceIcon =
      service === 'YOUTUBE'
        ? 'fa-brands fa-youtube'
        : service === 'DISNEY'
        ? 'fa-solid fa-wand-magic-sparkles'
        : 'fa-solid fa-shield-halved';

    const payAction = () => {
      if (activeTab === 'STRIPE') return handleStripeCheckout();
      if (activeTab === 'PAYPAL') return setShowPaypalModal(true);
      return setStep('declare');
    };

    const CRYPTO_OPTIONS: { id: 'SOL' | 'XRP' | 'USDT_TRC20'; label: string; color: string }[] = [
      { id: 'SOL',        label: 'SOL',  color: '#9945ff' },
      { id: 'XRP',        label: 'XRP',  color: '#346aa9' },
      { id: 'USDT_TRC20', label: 'USDT', color: '#26a17b' },
    ];

    return (
      <div style={{ padding: '20px 24px 24px' }}>
        <div className="checkout-grid">

          {/* ── LEFT : Formulaire de paiement ── */}
          <div className="checkout-payment">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <i className="fa-solid fa-credit-card" style={{ color: accentColor }} />
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>
                Méthode de paiement
              </h3>
            </div>

            {/* Onglets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {(
                [
                  { id: 'STRIPE' as const, icon: 'fa-solid fa-credit-card', label: 'Carte Bancaire' },
                  { id: 'PAYPAL' as const, icon: 'fa-brands fa-paypal',     label: 'PayPal'         },
                  { id: 'CRYPTO' as const, icon: 'fa-solid fa-coins',        label: 'Crypto'         },
                ] as { id: 'STRIPE' | 'PAYPAL' | 'CRYPTO'; icon: string; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '6px', padding: '12px 6px', borderRadius: '12px', cursor: 'pointer',
                    border: activeTab === tab.id ? '2px solid #4f46e5' : '1px solid var(--border2)',
                    background: activeTab === tab.id ? 'rgba(79,70,229,0.1)' : 'rgba(255,255,255,0.02)',
                    color: activeTab === tab.id ? '#a78bfa' : 'var(--muted)',
                    fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.75rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <i className={tab.icon} style={{ fontSize: '1.1rem' }} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contenu Stripe */}
            {activeTab === 'STRIPE' && (
              <div style={{
                background: 'rgba(99,91,255,0.06)', border: '1px solid rgba(99,91,255,0.2)',
                borderRadius: '12px', padding: '16px', marginBottom: '20px',
              }}>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: '#635bff', marginBottom: '10px' }}>
                  <i className="fa-solid fa-lock" style={{ marginRight: '6px' }} />
                  Paiement 100% sécurisé via Stripe
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {[
                    '✅ CB Visa / Mastercard, Apple Pay, Google Pay',
                    '✅ Activation immédiate après paiement',
                    '🔒 Données bancaires jamais transmises à StreamMalin',
                  ].map((line, i) => (
                    <li key={i} style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contenu PayPal */}
            {activeTab === 'PAYPAL' && (
              <div style={{
                background: 'rgba(0,156,222,0.06)', border: '1px solid rgba(0,156,222,0.2)',
                borderRadius: '12px', padding: '16px', marginBottom: '20px',
              }}>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: '#009cde', marginBottom: '10px' }}>
                  <i className="fa-brands fa-paypal" style={{ marginRight: '6px' }} />
                  Instructions PayPal importantes
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    '⚠️ Mode "À un proche" uniquement — jamais Biens/Services',
                    '🔇 Aucun message ni libellé dans la note',
                    `💶 Montant exact : ${totalPrice.toFixed(2).replace('.', ',')}€ (${duration} mois)`,
                    '📋 Notez l\'ID de transaction PayPal après le paiement',
                  ].map((line, i) => (
                    <li key={i} style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contenu Crypto */}
            {activeTab === 'CRYPTO' && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '14px' }}>
                  {CRYPTO_OPTIONS.map(({ id, label: clabel, color }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPaymentMethod(id)}
                      style={{
                        padding: '9px 4px', borderRadius: '9px', cursor: 'pointer',
                        fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.78rem',
                        border: paymentMethod === id ? `2px solid ${color}` : '1px solid var(--border2)',
                        background: paymentMethod === id ? `${color}18` : 'rgba(255,255,255,0.02)',
                        color: paymentMethod === id ? color : 'var(--muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {clabel}
                    </button>
                  ))}
                </div>
                <div style={{
                  background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.35)',
                  borderLeft: '3px solid #ff3b3b', borderRadius: '9px',
                  padding: '10px 12px', marginBottom: '12px',
                }}>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#ff6b6b', lineHeight: 1.55 }}>
                    <strong style={{ color: '#ff3b3b' }}>⚠️ Réseau strict — fonds irrécupérables en cas d&apos;erreur.</strong>{' '}
                    {paymentMethod === 'SOL' && 'Utilisez uniquement le réseau Solana.'}
                    {paymentMethod === 'XRP' && 'Utilisez uniquement le réseau Ripple / XRP Ledger.'}
                    {paymentMethod === 'USDT_TRC20' && 'Utilisez uniquement le réseau TRON (TRC-20).'}
                  </p>
                </div>
                <WalletAddress
                  label={
                    paymentMethod === 'SOL'  ? 'Solana (SOL)'
                    : paymentMethod === 'XRP' ? 'XRP (Ripple)'
                    : 'USDT TRC-20 (TRON)'
                  }
                  address={
                    paymentMethod === 'SOL'  ? WALLETS.SOL
                    : paymentMethod === 'XRP' ? WALLETS.XRP
                    : WALLETS.USDT_TRC20
                  }
                  copiedKey={copiedKey}
                  onCopy={copyToClipboard}
                  copyKey={paymentMethod}
                />
                <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '8px' }}>
                  Envoyez exactement{' '}
                  <strong style={{ color: 'var(--text)' }}>{totalPrice.toFixed(2).replace('.', ',')}€</strong>{' '}
                  ({duration} mois) en {paymentMethod.replace('_TRC20', '')}. Conservez le hash pour l&apos;étape suivante.
                </p>
              </div>
            )}

            {error && <ErrorBox message={error} />}

            {/* Bouton payer */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setStep('info')}
                style={{
                  flexShrink: 0, background: 'none', border: '1px solid var(--border2)',
                  color: 'var(--muted)', fontFamily: 'Syne, sans-serif', fontWeight: 700,
                  fontSize: '0.85rem', padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
              <button
                type="button"
                onClick={payAction}
                disabled={loading}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', padding: '13px', borderRadius: '11px', border: 'none',
                  fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.92rem',
                  color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                  background:
                    activeTab === 'STRIPE'  ? 'linear-gradient(135deg,#635bff,#4f46e5)'
                    : activeTab === 'PAYPAL' ? 'linear-gradient(135deg,#009cde,#0070ba)'
                    : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  transition: 'opacity 0.2s',
                }}
              >
                {loading ? (
                  <><i className="fa-solid fa-spinner fa-spin" /> Chargement...</>
                ) : activeTab === 'STRIPE' ? (
                  <><i className="fa-solid fa-lock" /> Payer {totalPrice.toFixed(2).replace('.', ',')}€ en sécurité</>
                ) : activeTab === 'PAYPAL' ? (
                  <><i className="fa-brands fa-paypal" /> Payer via PayPal</>
                ) : (
                  <><i className="fa-solid fa-check" /> J&apos;ai payé — Déclarer</>
                )}
              </button>
            </div>

            {activeTab === 'STRIPE' && (
              <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted)', marginTop: '10px' }}>
                <i className="fa-solid fa-lock" style={{ marginRight: '4px' }} />
                Paiement chiffré SSL 256-bit via Stripe
              </p>
            )}
          </div>

          {/* ── RIGHT : Récapitulatif (en haut sur mobile grâce à column-reverse) ── */}
          <div className="checkout-summary">
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
              borderRadius: '16px', padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span>📦</span>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
                  Récapitulatif
                </h3>
              </div>

              {/* Produit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                  background:
                    service === 'YOUTUBE' ? 'rgba(255,59,59,0.15)'
                    : service === 'DISNEY'  ? 'rgba(124,58,237,0.15)'
                    : 'rgba(0,199,224,0.15)',
                  color: accentColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                }}>
                  <i className={serviceIcon} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    Partage familial — {duration} mois
                  </div>
                </div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '0.95rem', flexShrink: 0 }}>
                  {totalPrice.toFixed(2).replace('.', ',')}€
                </div>
              </div>

              {/* Détail prix */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  <span>Sous-total</span><span>{totalPrice.toFixed(2).replace('.', ',')}€</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  <span>Frais</span><span>0,00€</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '0.95rem',
                  borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '2px',
                }}>
                  <span>Total</span>
                  <span style={{ color: accentColor }}>{totalPrice.toFixed(2).replace('.', ',')}€</span>
                </div>
              </div>

              {/* Garanties */}
              <div style={{
                background: 'rgba(0,255,170,0.05)', border: '1px solid rgba(0,255,170,0.15)',
                borderRadius: '10px', padding: '12px 14px', marginBottom: '14px',
              }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--green)', marginBottom: '4px', fontFamily: 'Syne, sans-serif' }}>
                  ✓ Garanties incluses
                </p>
                <p style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
                  Accès instantané · Remplacement 24h · Support 7j/7
                </p>
              </div>

              {/* Logos paiement */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {['CB', 'Visa', 'MC', 'PayPal', 'SOL', 'XRP', 'USDT'].map((logo) => (
                  <span key={logo} style={{
                    padding: '3px 8px', borderRadius: '5px', fontSize: '0.62rem',
                    fontFamily: 'Syne, sans-serif', fontWeight: 700,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border2)',
                    color: 'var(--muted)',
                  }}>
                    {logo}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box${step === 'payment' ? ' modal-box--wide' : ''}`}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 0',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background:
                  service === 'YOUTUBE' ? 'rgba(255,59,59,0.15)' : service === 'DISNEY' ? 'rgba(124,58,237,0.15)' : 'rgba(0,199,224,0.15)',
                color: service === 'YOUTUBE' ? 'var(--yt)' : service === 'DISNEY' ? '#a78bfa' : '#00c7e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              <i
                className={
                  service === 'YOUTUBE' ? 'fa-brands fa-youtube' : service === 'DISNEY' ? 'fa-solid fa-wand-magic-sparkles' : 'fa-solid fa-shield-halved'
                }
              />
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: '1rem',
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {price.toFixed(2).replace('.', ',')}€/mois
                {duration > 1 && (
                  <span style={{ color: 'var(--green)', marginLeft: '6px' }}>
                    · {duration} mois = {totalPrice.toFixed(2).replace('.', ',')}€
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              padding: '4px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)')
            }
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Steps indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px 24px 0',
          }}
        >
          {(['info', 'payment', 'declare', 'success'] as Step[]).map((s, i) => (
            <div
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background:
                    step === s
                      ? service === 'YOUTUBE'
                        ? 'var(--yt)'
                        : service === 'DISNEY' ? 'var(--dis)' : '#00c7e0'
                      : ['info', 'payment', 'declare', 'success'].indexOf(step) > i
                      ? 'var(--green)'
                      : 'var(--border2)',
                  transition: 'background 0.3s',
                }}
              />
              {i < 3 && (
                <div
                  style={{
                    width: '24px',
                    height: '1px',
                    background:
                      ['info', 'payment', 'declare', 'success'].indexOf(step) > i
                        ? 'var(--green)'
                        : 'var(--border2)',
                    transition: 'background 0.3s',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* -- STEP 1 : Info -- */}
        {step === 'info' && (
          <form onSubmit={handleInfoSubmit} style={{ padding: '20px 24px 24px' }}>
            <h3
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1.05rem',
                fontWeight: 700,
                marginBottom: '4px',
              }}
            >
              Vos informations
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '20px' }}>
              Nécessaire pour vous envoyer vos accès.
            </p>

            <label style={labelStyle}>
              Email de contact
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                style={inputStyle}
              />
            </label>

            {service === 'YOUTUBE' && (
              <label style={{ ...labelStyle, marginTop: '14px' }}>
                <span>
                  Adresse Gmail{' '}
                  <span style={{ color: 'var(--yt)', fontSize: '0.75rem' }}>
                    (pour recevoir l'invitation)
                  </span>
                </span>
                <input
                  type="email"
                  value={gmail}
                  onChange={(e) => setGmail(e.target.value)}
                  placeholder="votre-gmail@gmail.com"
                  required
                  style={inputStyle}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
                  <i className="fa-solid fa-circle-info" style={{ marginRight: '4px' }} />
                  Doit être un compte Google/Gmail. L'invitation sera envoyée sur cette adresse.
                </span>
              </label>
            )}

            {/* Duration selector */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>
                Durée de l'abonnement
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {DURATION_OPTIONS.map(({ months, label: dlabel, badge }) => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => setDuration(months)}
                    style={{
                      position: 'relative',
                      padding: '10px 6px',
                      borderRadius: '9px',
                      border: duration === months
                        ? `1px solid ${service === 'YOUTUBE' ? 'var(--yt)' : service === 'DISNEY' ? '#7c3aed' : '#00c7e0'}`
                        : '1px solid var(--border)',
                      background: duration === months
                        ? service === 'YOUTUBE' ? 'rgba(255,59,59,0.1)' : service === 'DISNEY' ? 'rgba(124,58,237,0.1)' : 'rgba(0,199,224,0.1)'
                        : 'rgba(255,255,255,0.02)',
                      color: duration === months ? 'var(--text)' : 'var(--muted)',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    {badge && (
                      <span style={{
                        position: 'absolute', top: '-8px', right: '4px',
                        background: 'var(--green)', color: '#000',
                        fontSize: '0.6rem', fontWeight: 800,
                        padding: '1px 5px', borderRadius: '4px',
                      }}>
                        {badge}
                      </span>
                    )}
                    {dlabel}
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px', fontWeight: 400 }}>
                      {(price * months).toFixed(2).replace('.', ',')}€
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && <ErrorBox message={error} />}

            <button type="submit" style={{ ...submitBtnStyle(service), marginTop: '20px' }}>
              Continuer vers le paiement
              <i className="fa-solid fa-arrow-right" style={{ marginLeft: '8px' }} />
            </button>
          </form>
        )}

        {/* -- STEP 2 : Choisir la méthode de paiement -- */}
        {step === 'payment' && renderStep2()}

        {/* -- STEP 3 : Déclaration du paiement -- */}
        {step === 'declare' && (
          <form onSubmit={handleDeclarePayment} style={{ padding: '20px 24px 24px' }}>
            <h3
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1.05rem',
                fontWeight: 700,
                marginBottom: '4px',
              }}
            >
              Déclarer le paiement
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '20px' }}>
              {paymentMethod === 'PAYPAL'
                ? 'Saisissez votre ID de transaction PayPal (visible dans "Activité").'
                : 'Saisissez le hash/TxID de votre transaction crypto.'}
            </p>

            {/* Recap */}
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                <i className="fa-solid fa-user" style={{ marginRight: '6px' }} />
                {email}
              </span>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  color: service === 'YOUTUBE' ? 'var(--yt)' : service === 'DISNEY' ? '#a78bfa' : '#00c7e0',
                }}
              >
                {label} · {duration} mois · {totalPrice.toFixed(2).replace('.', ',')}€
              </span>
            </div>

            <label style={labelStyle}>
              {paymentMethod === 'PAYPAL' ? 'ID de transaction PayPal' : 'Hash / TxID'}
              <input
                type="text"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                placeholder={
                  paymentMethod === 'PAYPAL'
                    ? 'ex: 9AB12345CD678901E'
                    : 'ex: 5jQn8fP3...7Tz'
                }
                required
                style={inputStyle}
              />
            </label>

            {error && <ErrorBox message={error} />}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setStep('payment')}
                style={{
                  flex: '0 0 auto',
                  background: 'none',
                  border: '1px solid var(--border2)',
                  color: 'var(--muted)',
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...submitBtnStyle(service),
                  flex: 1,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane" style={{ marginRight: '8px' }} />
                    Envoyer ma déclaration
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* -- STEP 4 : Succès -- */}
        {step === 'success' && (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(0,255,170,0.12)',
                border: '1px solid rgba(0,255,170,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                color: 'var(--green)',
                margin: '0 auto 20px',
              }}
            >
              <i className="fa-solid fa-circle-check" />
            </div>

            <h3
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1.2rem',
                fontWeight: 800,
                marginBottom: '8px',
              }}
            >
              Paiement déclaré !
            </h3>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--muted)',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}
            >
              Notre équipe va vérifier votre paiement sous peu.
              {service === 'DISNEY'
                ? ' Votre slot Disney+ sera attribué automatiquement.'
                : service === 'SURFSHARK'
                ? ' Vos accès Surfshark VPN One vous seront envoyés par email.'
                : ' Votre invitation YouTube Premium sera envoyée à votre Gmail.'}
              <br />
              <br />
              <strong style={{ color: 'var(--text)' }}>
                Commande #{orderId.slice(0, 12).toUpperCase()}
              </strong>
            </p>

            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '20px',
                fontSize: '0.8rem',
                color: 'var(--muted)',
                textAlign: 'left',
              }}
            >
              <i
                className="fa-solid fa-circle-info"
                style={{ marginRight: '8px', color: '#3b82f6' }}
              />
              Accédez à votre dashboard pour suivre le statut de votre commande. Conservez votre
              email (<strong style={{ color: 'var(--text)' }}>{email}</strong>) pour vous
              reconnecter.
            </div>

            <button
              onClick={goToDashboard}
              style={submitBtnStyle(service)}
            >
              <i className="fa-solid fa-gauge-high" style={{ marginRight: '8px' }} />
              Accéder à mon espace client
            </button>

            <button
              onClick={onClose}
              style={{
                marginTop: '10px',
                width: '100%',
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>

      {/* ── PayPal Instructions Modal ── */}
      {showPaypalModal && (
        <div
          onClick={() => { setShowPaypalModal(false); setPaypalChecked(false); }}
          className="paypal-modal-backdrop"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="paypal-modal-box"
            style={{
              background: 'var(--card)',
              border: '2px solid rgba(255,59,59,0.5)',
              borderRadius: '20px', padding: '24px 20px',
              maxWidth: '420px', width: '100%',
            }}
          >
            {/* Icon + titre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                background: 'rgba(0,156,222,0.12)', color: '#009cde',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
              }}>
                <i className="fa-brands fa-paypal" />
              </div>
              <h3 style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '1.05rem', margin: 0,
              }}>
                Instructions de paiement PayPal
              </h3>
            </div>

            {/* Bloc instructions — bordure rouge + titre majuscules */}
            <div style={{
              background: 'rgba(255,59,59,0.05)',
              border: '2px solid rgba(255,59,59,0.45)',
              borderRadius: '12px', padding: '14px 16px', marginBottom: '16px',
            }}>
              <p style={{
                fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em',
                color: '#ff6b6b', textTransform: 'uppercase' as const,
                marginBottom: '10px',
              }}>
                ⚠️ À lire impérativement
              </p>
              {[
                { icon: 'fa-user-group', color: '#009cde', text: paypalInstructions[0] },
                { icon: 'fa-envelope',   color: '#009cde', text: paypalInstructions[1] },
                { icon: 'fa-clock',      color: '#00ffaa', text: paypalInstructions[2] },
              ].map(({ icon, color, text }, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  marginBottom: i < 2 ? '10px' : 0,
                }}>
                  <i className={`fa-solid ${icon}`} style={{ color, marginTop: '3px', flexShrink: 0, fontSize: '0.82rem' }} />
                  <span
                    style={{ fontSize: '0.83rem', color: 'var(--muted)', lineHeight: 1.55 }}
                    dangerouslySetInnerHTML={{ __html: text }}
                  />
                </div>
              ))}
            </div>

            {/* Montant */}
            <div style={{
              textAlign: 'center', fontSize: '1.7rem', fontWeight: 800,
              fontFamily: 'Syne, sans-serif', color: '#009cde', marginBottom: '16px',
            }}>
              {totalPrice.toFixed(2).replace('.', ',')}€
            </div>

            {/* Checkbox confirmation */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              cursor: 'pointer', marginBottom: '16px',
              background: paypalChecked ? 'rgba(0,255,170,0.05)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${paypalChecked ? 'rgba(0,255,170,0.3)' : 'var(--border2)'}`,
              borderRadius: '10px', padding: '12px',
              transition: 'background 0.2s, border-color 0.2s',
            }}>
              <input
                type="checkbox"
                checked={paypalChecked}
                onChange={(e) => setPaypalChecked(e.target.checked)}
                style={{ marginTop: '2px', accentColor: '#00ffaa', flexShrink: 0, width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>
                J&apos;ai compris que je dois envoyer l&apos;argent en mode{' '}
                <strong style={{ color: '#00ffaa' }}>&quot;À un proche&quot;</strong>{' '}
                et indiquer mon email dans la note PayPal.
              </span>
            </label>

            {/* CTA PayPal */}
            <a
              href={paypalChecked ? `${paypalLink}/${totalPrice.toFixed(2)}` : '#'}
              target={paypalChecked ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={(e) => { if (!paypalChecked) e.preventDefault(); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                width: '100%', padding: '14px', borderRadius: '11px',
                background: paypalChecked
                  ? 'linear-gradient(135deg,#009cde,#0070ba)'
                  : 'rgba(0,156,222,0.25)',
                color: '#fff', textDecoration: 'none',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.95rem',
                marginBottom: '8px', boxSizing: 'border-box' as const,
                opacity: paypalChecked ? 1 : 0.5,
                cursor: paypalChecked ? 'pointer' : 'not-allowed',
                transition: 'opacity 0.2s, background 0.2s',
              }}
            >
              <i className="fa-brands fa-paypal" />
              Ouvrir mon PayPal
              <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.7rem' }} />
            </a>

            {/* Avertissement rouge sous le bouton */}
            <p style={{
              textAlign: 'center', fontSize: '0.76rem', fontWeight: 700,
              color: '#ff6b6b', lineHeight: 1.5, marginBottom: '14px',
            }}>
              ⚠️ ATTENTION : Seuls les paiements envoyés &quot;À un proche&quot; seront validés.
              N&apos;oubliez pas d&apos;indiquer votre email dans les notes PayPal.
            </p>

            {/* Secondary CTA */}
            <button
              onClick={() => { setShowPaypalModal(false); setPaypalChecked(false); setStep('declare'); }}
              style={{
                width: '100%', padding: '11px', borderRadius: '11px',
                border: '1px solid var(--border2)', background: 'rgba(255,255,255,0.04)',
                color: 'var(--muted)', fontFamily: 'Syne, sans-serif',
                fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-check" style={{ marginRight: '7px', color: 'var(--green)' }} />
              J&apos;ai payé — Déclarer mon paiement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------
// Sub-components
// --------------------------------------

function MethodOption({
  id,
  selected,
  icon,
  iconColor,
  title,
  subtitle,
  badge,
  onClick,
}: {
  id: string;
  selected: boolean;
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: selected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
        border: selected ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)',
        borderRadius: '10px',
        padding: '12px 14px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      {badge && (
        <span style={{
          position: 'absolute', top: '-8px', right: '10px',
          background: 'var(--green)', color: '#000',
          fontSize: '0.62rem', fontWeight: 800,
          padding: '2px 7px', borderRadius: '4px',
        }}>
          {badge}
        </span>
      )}
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          background: `${iconColor}15`,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          flexShrink: 0,
        }}
      >
        <i className={icon} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '0.88rem',
            color: 'var(--text)',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{subtitle}</div>
      </div>
      <div
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          border: selected ? '5px solid var(--green)' : '2px solid var(--border2)',
          flexShrink: 0,
          transition: 'border 0.2s',
        }}
      />
    </button>
  );
}

function WalletAddress({
  label,
  address,
  copiedKey,
  onCopy,
  copyKey,
}: {
  label: string;
  address: string;
  copiedKey: string;
  onCopy: (text: string, key: string) => void;
  copyKey: string;
}) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '8px 12px',
        }}
      >
        <code
          style={{
            flex: 1,
            fontSize: '0.72rem',
            color: 'var(--text)',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
          }}
        >
          {address}
        </code>
        <button
          type="button"
          onClick={() => onCopy(address, copyKey)}
          className={`copy-btn ${copiedKey === copyKey ? 'copied' : ''}`}
          style={{ flexShrink: 0 }}
        >
          {copiedKey === copyKey ? (
            <><i className="fa-solid fa-check" /> Copié</>
          ) : (
            <><i className="fa-regular fa-copy" /> Copier</>
          )}
        </button>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,59,59,0.08)',
        border: '1px solid rgba(255,59,59,0.3)',
        borderRadius: '8px',
        padding: '10px 14px',
        marginTop: '12px',
        fontSize: '0.82rem',
        color: 'var(--yt)',
      }}
    >
      <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }} />
      {message}
    </div>
  );
}

// --------------------------------------
// Shared styles
// --------------------------------------
const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'var(--text)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border2)',
  borderRadius: '9px',
  padding: '11px 14px',
  fontSize: '0.88rem',
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
  transition: 'border-color 0.2s',
};

const submitBtnStyle = (service: Service): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '13px',
  borderRadius: '11px',
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: '0.92rem',
  cursor: 'pointer',
  border: 'none',
  background:
    service === 'YOUTUBE' ? 'var(--yt)' : service === 'DISNEY' ? 'linear-gradient(135deg, #2563eb, #7c3aed)' : 'linear-gradient(135deg, #0891b2, #00c7e0)',
  color: '#fff',
  transition: 'opacity 0.2s',
});
