'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Service = 'YOUTUBE' | 'DISNEY';
type PaymentMethod = 'PAYPAL' | 'SOL' | 'XRP' | 'USDT_TRC20' | 'STRIPE';
type Duration = 1 | 3 | 6 | 12;
type Step = 'info' | 'payment' | 'declare' | 'success';

const PRICES: Record<Service, number> = {
  YOUTUBE: 5.99,
  DISNEY: 4.99,
};

const DURATION_OPTIONS: { months: Duration; label: string; badge?: string }[] = [
  { months: 1,  label: '1 mois' },
  { months: 3,  label: '3 mois', badge: '-5%' },
  { months: 6,  label: '6 mois', badge: '-10%' },
  { months: 12, label: '12 mois', badge: '-15%' },
];

const SERVICE_LABELS: Record<Service, string> = {
  YOUTUBE: 'YouTube Premium',
  DISNEY: 'Disney+ 4K',
};

const PAYPAL_BASE =
  process.env.NEXT_PUBLIC_PAYPAL_ME ??
  process.env.NEXT_PUBLIC_PAYPAL_ME_BASE ??
  'https://www.paypal.com/paypalme/AccesPremium89';

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
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [showPaypalModal, setShowPaypalModal] = useState(false);

  const price = PRICES[service];
  const totalPrice = price * duration;
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

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
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
                  service === 'YOUTUBE' ? 'rgba(255,59,59,0.15)' : 'rgba(124,58,237,0.15)',
                color: service === 'YOUTUBE' ? 'var(--yt)' : '#a78bfa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
            >
              <i
                className={
                  service === 'YOUTUBE' ? 'fa-brands fa-youtube' : 'fa-solid fa-wand-magic-sparkles'
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
                        : 'var(--dis)'
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
                        ? `1px solid ${service === 'YOUTUBE' ? 'var(--yt)' : '#7c3aed'}`
                        : '1px solid var(--border)',
                      background: duration === months
                        ? service === 'YOUTUBE' ? 'rgba(255,59,59,0.1)' : 'rgba(124,58,237,0.1)'
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
        {step === 'payment' && (
          <div style={{ padding: '20px 24px 24px' }}>
            <h3
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1.05rem',
                fontWeight: 700,
                marginBottom: '4px',
              }}
            >
              Méthode de paiement
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '20px' }}>
              Choisissez votre méthode préférée.
            </p>

            {/* Method selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <MethodOption
                id="STRIPE"
                selected={paymentMethod === 'STRIPE'}
                icon="fa-solid fa-credit-card"
                iconColor="#635bff"
                title="CB / Apple Pay / Google Pay"
                subtitle="Paiement sécurisé par Stripe — activation immédiate"
                badge="Recommandé"
                onClick={() => setPaymentMethod('STRIPE')}
              />
              <MethodOption
                id="PAYPAL"
                selected={paymentMethod === 'PAYPAL'}
                icon="fa-brands fa-paypal"
                iconColor="#009cde"
                title="PayPal"
                subtitle='Option "Entre proches" — sans frais'
                onClick={() => setPaymentMethod('PAYPAL')}
              />
              <MethodOption
                id="SOL"
                selected={paymentMethod === 'SOL'}
                icon="fa-solid fa-coins"
                iconColor="#9945ff"
                title="Solana (SOL)"
                subtitle="Réseau Solana — vérification manuelle"
                onClick={() => setPaymentMethod('SOL')}
              />
              <MethodOption
                id="XRP"
                selected={paymentMethod === 'XRP'}
                icon="fa-solid fa-coins"
                iconColor="#346aa9"
                title="XRP (Ripple)"
                subtitle="Réseau XRP Ledger — vérification manuelle"
                onClick={() => setPaymentMethod('XRP')}
              />
              <MethodOption
                id="USDT_TRC20"
                selected={paymentMethod === 'USDT_TRC20'}
                icon="fa-solid fa-coins"
                iconColor="#26a17b"
                title="USDT (TRC-20)"
                subtitle="Réseau TRON uniquement — vérification manuelle"
                onClick={() => setPaymentMethod('USDT_TRC20')}
              />
            </div>

            {/* Stripe block */}
            {paymentMethod === 'STRIPE' && (
              <div style={{
                background: 'rgba(99,91,255,0.06)', border: '1px solid rgba(99,91,255,0.25)',
                borderRadius: '12px', padding: '16px', marginBottom: '20px',
              }}>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px', color: '#635bff' }}>
                  <i className="fa-solid fa-lock" style={{ marginRight: '6px' }} />
                  Paiement 100% sécurisé — Stripe
                </p>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {[
                    '✅ CB Visa/Mastercard, Apple Pay, Google Pay',
                    '✅ Activation immédiate après paiement',
                    `💶 Montant total : ${totalPrice.toFixed(2).replace('.', ',')}€ (${duration} mois)`,
                    '🔒 Vos données bancaires ne nous sont jamais transmises',
                  ].map((line, i) => (
                    <li key={i} style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Payment instructions */}
            {paymentMethod === 'PAYPAL' && (
              <div
                style={{
                  background: 'rgba(0,156,222,0.06)',
                  border: '1px solid rgba(0,156,222,0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    marginBottom: '8px',
                    color: '#009cde',
                  }}
                >
                  <i className="fa-brands fa-paypal" style={{ marginRight: '6px' }} />
                  Instructions PayPal importantes
                </p>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {[
                    '⚠️ Sélectionner "Envoyer à un proche" (pas "Paiement de biens/services")',
                    '🔇 Ne pas mettre de message ni de libellé dans la note',
                    `💶 Montant exact : ${totalPrice.toFixed(2).replace('.', ',')}€ (${duration} mois)`,
                    '📋 Notez votre ID de transaction PayPal après le paiement',
                  ].map((line, i) => (
                    <li key={i} style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {line}
                    </li>
                  ))}
                </ul>

                <a
                  href={`${PAYPAL_BASE}/${totalPrice.toFixed(2)}EUR`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '12px',
                    background: '#009cde',
                    color: '#fff',
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    padding: '10px 18px',
                    borderRadius: '9px',
                    textDecoration: 'none',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.opacity = '0.85')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.opacity = '1')
                  }
                >
                  <i className="fa-brands fa-paypal" />
                  Payer {totalPrice.toFixed(2).replace('.', ',')}€ via PayPal.Me
                  <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.7rem' }} />
                </a>
              </div>
            )}

            {paymentMethod !== 'PAYPAL' && paymentMethod !== 'STRIPE' && (
              <div style={{ marginBottom: '20px' }}>
                {/* RED WARNING */}
                <div style={{
                  background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.4)',
                  borderRadius: '10px', padding: '12px 14px', marginBottom: '12px',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ff3b3b', fontSize: '1rem', marginTop: '2px', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#ff6b6b', lineHeight: 1.6, fontWeight: 600 }}>
                    <strong style={{ color: '#ff3b3b' }}>Attention :</strong> Utilisez exclusivement le réseau mentionné, sinon vos fonds seront <strong>définitivement perdus</strong>.
                  </p>
                </div>
              <div
                style={{
                  background: 'rgba(249,168,11,0.06)',
                  border: '1px solid rgba(249,168,11,0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    marginBottom: '12px',
                    color: '#f59e0b',
                  }}
                >
                  <i className="fa-solid fa-coins" style={{ marginRight: '6px' }} />
                  Adresse de réception
                </p>

                {paymentMethod === 'SOL' && (
                  <WalletAddress
                    label="Solana (SOL)"
                    address={WALLETS.SOL}
                    copiedKey={copiedKey}
                    onCopy={copyToClipboard}
                    copyKey="SOL"
                  />
                )}
                {paymentMethod === 'XRP' && (
                  <WalletAddress
                    label="XRP (Ripple)"
                    address={WALLETS.XRP}
                    copiedKey={copiedKey}
                    onCopy={copyToClipboard}
                    copyKey="XRP"
                  />
                )}
                {paymentMethod === 'USDT_TRC20' && (
                  <WalletAddress
                    label="USDT TRC-20 (TRON)"
                    address={WALLETS.USDT_TRC20}
                    copiedKey={copiedKey}
                    onCopy={copyToClipboard}
                    copyKey="USDT_TRC20"
                  />
                )}

                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '10px' }}>
                  <i className="fa-solid fa-circle-info" style={{ marginRight: '4px' }} />
                  Envoyez exactement{' '}
                  <strong style={{ color: 'var(--text)' }}>{totalPrice.toFixed(2).replace('.', ',')}€</strong>{' '}
                  ({duration} mois) en équivalent {paymentMethod.replace('_TRC20', '')}. Conservez le hash de
                  transaction pour l'étape suivante.
                </p>
              </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep('info')}
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
              {paymentMethod === 'STRIPE' ? (
                <button
                  onClick={handleStripeCheckout}
                  disabled={loading}
                  style={{ ...submitBtnStyle(service), flex: 1, background: 'linear-gradient(135deg,#635bff,#4f46e5)', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? (
                    <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />Redirection...</>
                  ) : (
                    <><i className="fa-solid fa-lock" style={{ marginRight: '8px' }} />Payer {totalPrice.toFixed(2).replace('.', ',')}€ en sécurité</>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => paymentMethod === 'PAYPAL' ? setShowPaypalModal(true) : setStep('declare')}
                  style={{ ...submitBtnStyle(service), flex: 1 }}
                >
                  {paymentMethod === 'PAYPAL' ? (
                    <><i className="fa-brands fa-paypal" style={{ marginRight: '8px' }} />Payer via PayPal</>
                  ) : 'J\'ai payé — Déclarer le paiement'}
                  <i className="fa-solid fa-arrow-right" style={{ marginLeft: '8px' }} />
                </button>
              )}
            </div>
            {error && <ErrorBox message={error} />}
          </div>
        )}

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
                  color: service === 'YOUTUBE' ? 'var(--yt)' : '#a78bfa',
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
          onClick={() => setShowPaypalModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '20px', padding: '32px 28px',
              maxWidth: '420px', width: '100%',
            }}
          >
            {/* Icon */}
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'rgba(0,156,222,0.12)', color: '#009cde',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', margin: '0 auto 20px',
            }}>
              <i className="fa-brands fa-paypal" />
            </div>

            <h3 style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '1.1rem', textAlign: 'center', marginBottom: '20px',
            }}>
              Paiement via PayPal
            </h3>

            {/* Instructions */}
            <div style={{
              background: 'rgba(0,156,222,0.06)', border: '1px solid rgba(0,156,222,0.2)',
              borderRadius: '12px', padding: '16px', marginBottom: '20px',
            }}>
              {[
                { icon: 'fa-user-group', text: 'Envoyez le montant en mode <strong>"Entre proches"</strong> (sans frais).' },
                { icon: 'fa-envelope', text: 'Indiquez votre <strong>adresse email</strong> en note du paiement.' },
                { icon: 'fa-clock', text: 'Activation manuelle sous <strong>12h</strong> après réception.' },
              ].map(({ icon, text }, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  marginBottom: i < 2 ? '12px' : 0,
                }}>
                  <i className={`fa-solid ${icon}`} style={{ color: '#009cde', marginTop: '3px', flexShrink: 0, fontSize: '0.85rem' }} />
                  <span
                    style={{ fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.55 }}
                    dangerouslySetInnerHTML={{ __html: text }}
                  />
                </div>
              ))}
            </div>

            {/* Montant */}
            <div style={{
              textAlign: 'center', fontSize: '1.6rem', fontWeight: 800,
              fontFamily: 'Syne, sans-serif', color: '#009cde', marginBottom: '20px',
            }}>
              {totalPrice.toFixed(2).replace('.', ',')}€
            </div>

            {/* CTA PayPal */}
            <a
              href={`https://paypal.me/AccesPremium89/${totalPrice.toFixed(2)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                width: '100%', padding: '14px', borderRadius: '11px',
                background: 'linear-gradient(135deg,#009cde,#0070ba)',
                color: '#fff', textDecoration: 'none',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.95rem',
                marginBottom: '10px', boxSizing: 'border-box' as const,
              }}
            >
              <i className="fa-brands fa-paypal" />
              Ouvrir mon PayPal
              <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.7rem' }} />
            </a>

            {/* Secondary CTA */}
            <button
              onClick={() => { setShowPaypalModal(false); setStep('declare'); }}
              style={{
                width: '100%', padding: '12px', borderRadius: '11px',
                border: '1px solid var(--border2)', background: 'rgba(255,255,255,0.04)',
                color: 'var(--muted)', fontFamily: 'Syne, sans-serif',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
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
    service === 'YOUTUBE' ? 'var(--yt)' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
  color: '#fff',
  transition: 'opacity 0.2s',
});
