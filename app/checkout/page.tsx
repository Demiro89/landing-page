'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Footer from '@/components/Footer';

interface ServiceDetails {
  id: string;
  name: string;
  tagline: string;
  price: number;
  original: number;
  icon: string;
  gradient: string;
}

interface PublicStockSummary {
  id: string;
  serviceId: string;
}

type PayTab = 'cb' | 'paypal' | 'crypto';
type CryptoCoin = 'btc' | 'eth' | 'usdt' | 'ltc';

const CRYPTO_META: Record<CryptoCoin, { label: string; color: string; symbol: string }> = {
  btc: { label: 'Bitcoin (BTC)', color: '#F7931A', symbol: '₿' },
  eth: { label: 'Ethereum (ETH)', color: '#627EEA', symbol: '⟠' },
  usdt: { label: 'USDT (TRC20)', color: '#26A17B', symbol: '₮' },
  ltc: { label: 'Litecoin (LTC)', color: '#345D9D', symbol: 'Ł' },
};

const CRYPTO_RATES: Record<CryptoCoin, number> = {
  btc: 0.000017, eth: 0.00028, usdt: 1.0, ltc: 0.012,
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const serviceId = searchParams.get('service');
  const stockId = searchParams.get('stock');

  const [service, setService] = useState<ServiceDetails | null>(null);
  const [cryptoAddr, setCryptoAddr] = useState<Record<string, string>>({ btc: '', eth: '', usdt: '', ltc: '' });
  const [loadingService, setLoadingService] = useState(true);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [youtubeEmail, setYoutubeEmail] = useState('');
  const [payTab, setPayTab] = useState<PayTab>('cb');
  const [activeCoin, setActiveCoin] = useState<CryptoCoin>('btc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [acceptedCgv, setAcceptedCgv] = useState(false);
  const [acceptedImmediate, setAcceptedImmediate] = useState(false);
  const [acceptedEligibility, setAcceptedEligibility] = useState(false);
  const [stockChecked, setStockChecked] = useState(false);
  const [stockAvailable, setStockAvailable] = useState(false);
  const [manualOrderId, setManualOrderId] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  const consentOk = acceptedCgv && acceptedImmediate && acceptedEligibility;

  useEffect(() => {
    if (!serviceId || !stockId) {
      void Promise.resolve().then(() => {
        setLoadingService(false);
        setStockChecked(true);
      });
      return;
    }

    const loadCheckoutData = async () => {
      try {
        const [servicesRes, stocksRes] = await Promise.all([
          fetch('/api/services', { cache: 'no-store' }),
          fetch('/api/stocks/public', { cache: 'no-store' }),
        ]);
        const [servicesData, stocksData] = await Promise.all([
          servicesRes.json() as Promise<{ success?: boolean; services?: ServiceDetails[] }>,
          stocksRes.json() as Promise<{ success?: boolean; stocks?: PublicStockSummary[] }>,
        ]);
        if (servicesData.success) {
          const found = servicesData.services?.find((s) => s.id === serviceId);
          if (found) setService(found);
        }
        if (stocksData.success) {
          setStockAvailable(
            Boolean(stocksData.stocks?.some((stock) => stock.id === stockId && stock.serviceId === serviceId))
          );
        }
      } finally {
        setStockChecked(true);
        setLoadingService(false);
      }
    };
    loadCheckoutData();

    // Récupère les paramètres publics du paiement (adresses crypto, passerelles).
    fetch('/api/settings/public')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setCryptoAddr({
            btc: d.settings.crypto_btc || '',
            eth: d.settings.crypto_eth || '',
            usdt: d.settings.crypto_usdt || '',
            ltc: d.settings.crypto_ltc || '',
          });
        }
      })
      .catch(() => {});
  }, [serviceId, stockId]);

  const isYoutube = serviceId === 'youtube';

  const handleStripeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !serviceId || !stockId || isSubmitting) return;
    if (isYoutube && !youtubeEmail.trim()) {
      setErrorMsg('Merci d\'indiquer votre adresse e-mail YouTube pour recevoir l\'invitation.');
      return;
    }
    if (!consentOk) {
      setErrorMsg('Merci d\'accepter les CGV, la demande d\'exécution immédiate et la confirmation d\'éligibilité.');
      return;
    }
    if (!stockAvailable) {
      setErrorMsg('Cette offre n\'est plus disponible. Merci de sélectionner une autre offre.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/checkout/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          stockAccountId: stockId,
          email: email.trim().toLowerCase(),
          youtubeEmail: isYoutube ? youtubeEmail.trim().toLowerCase() : undefined,
          acceptedCgv,
          acceptedImmediateExecution: acceptedImmediate,
          acceptedEligibility,
        }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setErrorMsg(data.error || 'Erreur lors du traitement de la transaction.');
        setIsSubmitting(false);
      }
    } catch {
      setErrorMsg('Erreur de communication avec le serveur.');
      setIsSubmitting(false);
    }
  };

  const copyAddr = (addr: string, coin: string) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(coin);
    setTimeout(() => setCopied(''), 2000);
  };

  // Enregistre une commande « en attente » pour les paiements PayPal / crypto.
  const createManualOrder = async (method: 'paypal' | 'crypto'): Promise<string | null> => {
    if (!serviceId || !stockId || !email) {
      setErrorMsg('Merci de renseigner votre adresse email.');
      return null;
    }
    if (isYoutube && !youtubeEmail.trim()) {
      setErrorMsg('Merci d\'indiquer votre adresse e-mail YouTube.');
      return null;
    }
    if (!consentOk) {
      setErrorMsg('Merci d\'accepter les CGV, la demande d\'exécution immédiate et la confirmation d\'éligibilité.');
      return null;
    }
    if (!stockAvailable) {
      setErrorMsg('Cette offre n\'est plus disponible. Merci de sélectionner une autre offre.');
      return null;
    }
    setManualBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/checkout/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          stockAccountId: stockId,
          email: email.trim().toLowerCase(),
          youtubeEmail: isYoutube ? youtubeEmail.trim().toLowerCase() : undefined,
          paymentMethod: method,
          acceptedCgv,
          acceptedImmediateExecution: acceptedImmediate,
          acceptedEligibility,
        }),
      });
      const data = await res.json();
      if (data.success && data.orderId) {
        setManualOrderId(data.orderId);
        return data.orderId;
      }
      setErrorMsg(data.error || 'Erreur lors de l\'enregistrement de la commande.');
      return null;
    } catch {
      setErrorMsg('Erreur de communication avec le serveur.');
      return null;
    } finally {
      setManualBusy(false);
    }
  };

  const savings = service ? (service.original - service.price).toFixed(2) : '0.00';

  if (loadingService) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-gray)', fontSize: '0.92rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="hero-badge-dot" /> Initialisation du tunnel de paiement sécurisé…
        </div>
      </div>
    );
  }

  if (!service || !stockId || (stockChecked && !stockAvailable)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div className="dash-empty-icon" style={{ marginBottom: 24 }}>⚠️</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 10 }}>Session de checkout invalide</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-gray)', maxWidth: 420, marginBottom: 24 }}>
          Le lien de paiement est erroné ou cette offre n&apos;est plus disponible actuellement.
        </p>
        <Link href="/" className="btn btn-primary">← Retour à la boutique</Link>
      </div>
    );
  }

  const cryptoPrecision = (coin: CryptoCoin) =>
    coin === 'btc' ? 6 : coin === 'eth' ? 5 : coin === 'usdt' ? 2 : 4;

  const orderRef = manualOrderId ? manualOrderId.slice(0, 8).toUpperCase() : '';
  const paypalUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=novateurlabeille%40gmail.com&amount=${service.price.toFixed(2)}&currency_code=EUR&item_name=StreamMalin+-+${encodeURIComponent(service.name)}&no_shipping=1`;

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: 60, left: '-15%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, hsla(258,90%,66%,0.16), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: 300, right: '-12%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, hsla(239,84%,67%,0.12), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Navbar */}
      <header className="navbar">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">SM</div>
            <span className="gradient-text">StreamMalin</span>
          </Link>
          <Link href="/" className="btn btn-ghost btn-sm">← Boutique</Link>
        </div>
      </header>

      <div className="checkout-wrap">
        {/* Header */}
        <div className="checkout-head fade-in-up">
          <div className="eyebrow">
            <span className="hero-badge-dot" style={{ width: 6, height: 6 }} />
            CHECKOUT SÉCURISÉ · SSL CHIFFRÉ
          </div>
          <h1>
            Finaliser votre <span className="gradient-text">commande</span>
          </h1>
          <p>Paiement sécurisé — accès transmis après validation de la commande et selon disponibilité</p>
        </div>

        <div className="checkout-grid">
          {/* ── Formulaire ── */}
          <div className="glass-panel checkout-card fade-in-up">
            <div className="checkout-card-head">
              <div className="icon-bubble">💳</div>
              Choisir un moyen de paiement
            </div>

            {errorMsg && <div className="error-box">⚠️ {errorMsg}</div>}

            {/* Pay tabs */}
            <div className="pay-tabs">
              {([
                { id: 'cb' as PayTab, icon: '💳', label: 'Carte Bancaire' },
                { id: 'paypal' as PayTab, icon: '🅿️', label: 'PayPal' },
                { id: 'crypto' as PayTab, icon: '₿', label: 'Cryptomonnaies' },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setPayTab(tab.id); setManualOrderId(null); setErrorMsg(''); }}
                  className={`pay-tab ${payTab === tab.id ? 'active' : ''}`}
                >
                  <span className="pay-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Email */}
            <div className="form-field">
              <label className="form-label">
                Adresse email <span className="required">*</span>
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', letterSpacing: 0, textTransform: 'none', marginLeft: 8 }}>(pour recevoir votre confirmation)</span>
              </label>
              <input
                type="email"
                required
                placeholder="vous@exemple.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="dash-input"
              />
            </div>

            {/* YouTube — adresse e-mail Google associée */}
            {isYoutube && (
              <>
                <div className="info-box" style={{ borderColor: 'rgba(255,0,0,0.3)', background: 'rgba(255,0,0,0.06)' }}>
                  <div className="info-box-title">▶️ YouTube Premium fonctionne par invitation famille</div>
                  <div className="info-box-text">
                    YouTube Premium nécessite une invitation dans un groupe famille compatible. Indiquez ci-dessous l&apos;<strong style={{ color: 'var(--text-white)' }}>adresse e-mail Google associée à votre compte YouTube</strong>. L&apos;invitation est envoyée après validation du paiement et selon disponibilité ; il vous suffira de l&apos;accepter pour activer l&apos;accès si votre compte est éligible.
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">
                    Adresse e-mail YouTube (Google) <span className="required">*</span>
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', letterSpacing: 0, textTransform: 'none', marginLeft: 8 }}>(pour recevoir l&apos;invitation)</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="votre.compte@gmail.com"
                    value={youtubeEmail}
                    onChange={e => setYoutubeEmail(e.target.value)}
                    className="dash-input"
                  />
                </div>
              </>
            )}

            {/* Consentements obligatoires — CGV + exécution immédiate + éligibilité */}
            <div
              style={{
                margin: '4px 0 18px',
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(168,85,247,0.06)',
                border: '1px solid rgba(168,85,247,0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <label style={{ display: 'flex', gap: 10, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-gray)', lineHeight: 1.55 }}>
                <input
                  type="checkbox"
                  checked={acceptedCgv}
                  onChange={e => setAcceptedCgv(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--primary)' }}
                />
                <span>
                  J&apos;ai lu et j&apos;accepte les{' '}
                  <a href="/cgv" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    CGV
                  </a>{' '}
                  de StreamMalin.
                </span>
              </label>
              <label style={{ display: 'flex', gap: 10, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-gray)', lineHeight: 1.55 }}>
                <input
                  type="checkbox"
                  checked={acceptedImmediate}
                  onChange={e => setAcceptedImmediate(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--primary)' }}
                />
                <span>
                  Je demande l&apos;exécution immédiate du service et reconnais renoncer à mon droit de rétractation une fois l&apos;accès numérique transmis.
                </span>
              </label>
              <label style={{ display: 'flex', gap: 10, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-gray)', lineHeight: 1.55 }}>
                <input
                  type="checkbox"
                  checked={acceptedEligibility}
                  onChange={e => setAcceptedEligibility(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--primary)' }}
                />
                <span>
                  Je confirme avoir vérifié que mon compte est éligible à l&apos;offre choisie et qu&apos;il n&apos;est pas soumis à une restriction récente de groupe familial, de pays, de foyer ou d&apos;historique d&apos;utilisation.
                </span>
              </label>
            </div>

            {/* CB */}
            {payTab === 'cb' && (
              <form onSubmit={handleStripeCheckout}>
                <div className="info-box">
                  <div className="info-box-title">🔒 Redirection sécurisée vers Stripe</div>
                  <div className="info-box-text">
                    Vous serez redirigé vers la passerelle de paiement <strong style={{ color: 'var(--text-white)' }}>Stripe 3D Secure</strong>. Vos données bancaires sont cryptées et ne transitent jamais par nos serveurs.
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !email || (isYoutube && !youtubeEmail.trim()) || !consentOk || !stockAvailable}
                  className="btn-pay"
                >
                  🔒 {isSubmitting ? 'Redirection…' : !consentOk ? 'Cochez les 3 confirmations pour continuer' : !stockAvailable ? 'Offre indisponible' : `Régler ${service.price.toFixed(2)}€ par carte`}
                </button>
                <div className="trust-row">
                  <span>🔐 Cryptage AES-256</span>
                  <span>✓ 3D Secure</span>
                  <span>⚡ Accès après validation</span>
                </div>
              </form>
            )}

            {/* PayPal */}
            {payTab === 'paypal' && (
              <div>
                <div className="warn-box">
                  <strong>⚠️ OBLIGATOIRE :</strong> Sélectionnez exclusivement « <strong>Biens et Services</strong> » (Goods &amp; Services) lors de l&apos;envoi. Conservez votre <strong>ID de transaction PayPal</strong>.
                </div>

                <div className="info-box">
                  <div className="info-box-title">🅿️ Étapes du paiement PayPal</div>
                  <ol style={{ listStyle: 'decimal', paddingLeft: 20, fontSize: '0.84rem', color: 'var(--text-gray)', lineHeight: 1.8 }}>
                    <li>Connectez-vous à votre compte PayPal.</li>
                    <li>Envoyez <strong style={{ color: 'var(--text-white)' }}>{service.price.toFixed(2)}€</strong> en mode <strong style={{ color: 'var(--accent-yellow)' }}>« Biens et Services »</strong>.</li>
                    <li>Dans la note : indiquez <strong style={{ color: 'var(--text-white)' }}>{email || 'votre email de livraison'}</strong>.</li>
                    <li>Vos accès sont traités rapidement après vérification du paiement et selon disponibilité.</li>
                  </ol>
                </div>

                <div className="crypto-addr-box" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Adresse PayPal de réception
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-white)', fontFamily: "'SF Mono', Menlo, monospace" }}>
                      novateurlabeille@gmail.com
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText('novateurlabeille@gmail.com'); setCopied('paypal'); setTimeout(() => setCopied(''), 2000); }}
                      className={`copy-btn ${copied === 'paypal' ? 'copied' : ''}`}
                    >
                      {copied === 'paypal' ? '✅ Copié' : '📋 Copier'}
                    </button>
                  </div>
                </div>

                {manualOrderId ? (
                  <div className="info-box" style={{ marginTop: 12, borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
                    <div className="info-box-title" style={{ color: 'var(--accent-green)' }}>
                      ✅ Commande enregistrée — référence {orderRef}
                    </div>
                    <div className="info-box-text">
                      Effectuez le paiement PayPal en indiquant la référence{' '}
                      <strong style={{ color: 'var(--text-white)' }}>{orderRef}</strong> dans la note.
                      Vos accès seront traités après vérification du paiement reçu et selon disponibilité.
                    </div>
                    <a
                      href={paypalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ display: 'block', textAlign: 'center', marginTop: 10, background: '#0070ba' }}
                    >
                      🅿️ Rouvrir PayPal →
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!consentOk || manualBusy || !email || !stockAvailable}
                    onClick={async () => {
                      const id = await createManualOrder('paypal');
                      if (id) window.open(paypalUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="btn btn-primary"
                    style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 12, background: consentOk && stockAvailable ? '#0070ba' : undefined, opacity: consentOk && stockAvailable ? 1 : 0.5, cursor: consentOk && stockAvailable ? 'pointer' : 'not-allowed' }}
                  >
                    {manualBusy ? 'Enregistrement…' : !consentOk ? 'Cochez les 3 confirmations pour continuer' : !stockAvailable ? 'Offre indisponible' : `🅿️ Payer ${service.price.toFixed(2)}€ via PayPal →`}
                  </button>
                )}

                <div className="trust-row">
                  <span>🛡️ Paiement PayPal traçable</span>
                  <span>✓ Biens &amp; Services</span>
                </div>
              </div>
            )}

            {/* Crypto */}
            {payTab === 'crypto' && (
              <div>
                <label className="form-label">Sélectionner la devise crypto</label>
                <div className="crypto-grid">
                  {(Object.keys(CRYPTO_META) as CryptoCoin[]).map(coin => (
                    <button
                      key={coin}
                      onClick={() => setActiveCoin(coin)}
                      className={`crypto-tile ${activeCoin === coin ? 'active' : ''}`}
                      style={activeCoin === coin ? {
                        borderColor: CRYPTO_META[coin].color,
                        background: `linear-gradient(135deg, ${CRYPTO_META[coin].color}22, ${CRYPTO_META[coin].color}08)`,
                        boxShadow: `0 8px 24px ${CRYPTO_META[coin].color}30`,
                      } : {}}
                    >
                      <span className="crypto-symbol" style={{ color: CRYPTO_META[coin].color }}>{CRYPTO_META[coin].symbol}</span>
                      <span>{CRYPTO_META[coin].label}</span>
                    </button>
                  ))}
                </div>

                <div className="crypto-addr-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Montant à envoyer
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: "'Outfit',sans-serif", color: CRYPTO_META[activeCoin].color, marginTop: 4 }}>
                        {(service.price * CRYPTO_RATES[activeCoin]).toFixed(cryptoPrecision(activeCoin))} {activeCoin.toUpperCase()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>≈ EUR</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{service.price.toFixed(2)}€</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 14, marginBottom: 0 }}>
                    Adresse de réception
                  </div>
                  <div className="crypto-addr">
                    {cryptoAddr[activeCoin] || '⚠️ Adresse non configurée — contactez hello@streammalin.fr'}
                  </div>
                  {cryptoAddr[activeCoin] && (
                    <button
                      onClick={() => copyAddr(cryptoAddr[activeCoin], activeCoin)}
                      className={`copy-btn ${copied === activeCoin ? 'copied' : ''}`}
                    >
                      {copied === activeCoin ? '✅ Adresse copiée' : '📋 Copier l\'adresse'}
                    </button>
                  )}
                </div>

                {manualOrderId ? (
                  <div className="info-box" style={{ marginTop: 14, borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
                    <div className="info-box-title" style={{ color: 'var(--accent-green)' }}>
                      ✅ Commande enregistrée — référence {orderRef}
                    </div>
                    <div className="info-box-text">
                      Envoyez le paiement à l&apos;adresse ci-dessus, puis transmettez votre TXID à{' '}
                      <strong style={{ color: 'var(--text-white)' }}>hello@streammalin.fr</strong> en précisant la
                      référence <strong style={{ color: 'var(--text-white)' }}>{orderRef}</strong>.
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!consentOk || manualBusy || !email || !cryptoAddr[activeCoin] || !stockAvailable}
                    onClick={() => createManualOrder('crypto')}
                    className="btn btn-primary"
                    style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 14, opacity: (consentOk && cryptoAddr[activeCoin] && stockAvailable) ? 1 : 0.5, cursor: (consentOk && cryptoAddr[activeCoin] && stockAvailable) ? 'pointer' : 'not-allowed' }}
                  >
                    {manualBusy ? 'Enregistrement…' : !consentOk ? 'Cochez les 3 confirmations pour continuer' : !stockAvailable ? 'Offre indisponible' : '✅ Enregistrer ma commande crypto'}
                  </button>
                )}

                <div className="warn-box" style={{ marginTop: 16 }}>
                  <strong>⚠️ Important :</strong> Une fois la transaction envoyée, transmettez le <strong>TXID</strong> à <strong>hello@streammalin.fr</strong> avec votre email de livraison. Votre demande sera traitée après les confirmations réseau nécessaires et selon disponibilité.
                </div>

                <div className="trust-row">
                  <span>🔗 Confirmations on-chain</span>
                  <span>⚡ Validation manuelle</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Récapitulatif ── */}
          <div className="glass-panel checkout-card fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="checkout-card-head">
              <div className="icon-bubble">📦</div>
              Récapitulatif
            </div>

            <div className="recap-service">
              <div className="recap-service-icon" style={{ background: service.gradient }}>
                {service.icon}
              </div>
              <div className="recap-service-info">
                <div className="name">{service.name}</div>
                <div className="sub">⭐ 5.0 · Accès vérifié · Stable</div>
              </div>
              <div className="recap-service-price">{service.price.toFixed(2)}€</div>
            </div>

            <div className="recap-line-list">
              <div className="recap-line">
                <span>Prix de l&apos;accès</span>
                <strong>{service.price.toFixed(2)}€</strong>
              </div>
              <div className="recap-line">
                <span>Frais d&apos;activation</span>
                <strong style={{ color: 'var(--accent-green)' }}>Gratuit</strong>
              </div>
              <div className="recap-line savings">
                <span>💰 Économie estimée</span>
                <strong>{savings}€/mois</strong>
              </div>
              <div className="recap-divider" />
              <div className="recap-line" style={{ fontSize: '0.78rem' }}>
                <span>Fréquence</span>
                <strong>Mensuelle · Sans engagement</strong>
              </div>
            </div>

            <div className="recap-total">
              <span className="recap-total-label">Total à payer</span>
              <span className="recap-total-value gradient-text">{service.price.toFixed(2)}€</span>
            </div>

            <div className="guarantee-box">
              <div className="guarantee-box-title">🛡️ Suivi StreamMalin inclus</div>
              <div className="guarantee-box-text">
                Suivi des accès et assistance en cas de dysfonctionnement, avec traitement selon les CGV et les disponibilités.
              </div>
            </div>

            <div className="trust-row" style={{ marginTop: 18 }}>
              <span>🔒 Paiement SSL</span>
              <span>⚡ Accès après validation</span>
              <span>💬 Support client réactif</span>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center text-[#94A3B8] font-light">
        Chargement du tunnel de paiement...
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
