'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface ServiceDetails {
  id: string;
  name: string;
  tagline: string;
  price: number;
  original: number;
  icon: string;
  gradient: string;
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
  const [email, setEmail] = useState('');
  const [payTab, setPayTab] = useState<PayTab>('cb');
  const [activeCoin, setActiveCoin] = useState<CryptoCoin>('btc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!serviceId) { setLoadingService(false); return; }
    fetch('/api/services')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const found = d.services.find((s: any) => s.id === serviceId);
          if (found) setService(found);
        }
      })
      .finally(() => setLoadingService(false));

    // Fetch crypto addresses from settings (OPTIONS = public)
    fetch('/api/admin/settings', { method: 'OPTIONS' })
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
  }, [serviceId]);

  const handleStripeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !serviceId || !stockId || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/checkout/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, stockAccountId: stockId, email: email.trim().toLowerCase() }),
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

  if (!service || !stockId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div className="dash-empty-icon" style={{ marginBottom: 24 }}>⚠️</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 10 }}>Session de checkout invalide</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-gray)', maxWidth: 420, marginBottom: 24 }}>
          Le lien de paiement est erroné ou ce compte de stock n&apos;est plus disponible.
        </p>
        <a href="/" className="btn btn-primary">← Retour à la boutique</a>
      </div>
    );
  }

  const cryptoPrecision = (coin: CryptoCoin) =>
    coin === 'btc' ? 6 : coin === 'eth' ? 5 : coin === 'usdt' ? 2 : 4;

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: 60, left: '-15%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, hsla(262,88%,64%,0.16), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: 300, right: '-12%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, hsla(190,95%,50%,0.12), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Navbar */}
      <header className="navbar">
        <div className="nav-inner">
          <a href="/" className="nav-logo">
            <div className="nav-logo-icon">SM</div>
            <span className="gradient-text">StreamMalin</span>
          </a>
          <a href="/" className="btn btn-ghost btn-sm">← Boutique</a>
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
          <p>Paiement 100% sécurisé — activation immédiate de vos accès Premium</p>
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
                  onClick={() => setPayTab(tab.id)}
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
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', letterSpacing: 0, textTransform: 'none', marginLeft: 8 }}>(pour recevoir vos identifiants)</span>
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
                  disabled={isSubmitting || !email}
                  className="btn-pay"
                >
                  🔒 {isSubmitting ? 'Redirection…' : `Régler ${service.price.toFixed(2)}€ par carte`}
                </button>
                <div className="trust-row">
                  <span>🔐 Cryptage AES-256</span>
                  <span>✓ 3D Secure</span>
                  <span>⚡ Activation immédiate</span>
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
                    <li>Vos accès sont activés sous <strong style={{ color: 'var(--text-white)' }}>10 à 30 min</strong> après vérification.</li>
                  </ol>
                </div>

                <div className="crypto-addr-box" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Adresse PayPal de réception
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-white)', fontFamily: "'SF Mono', Menlo, monospace" }}>
                      paiement@streammalin.fr
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText('paiement@streammalin.fr'); setCopied('paypal'); setTimeout(() => setCopied(''), 2000); }}
                      className={`copy-btn ${copied === 'paypal' ? 'copied' : ''}`}
                    >
                      {copied === 'paypal' ? '✅ Copié' : '📋 Copier'}
                    </button>
                  </div>
                </div>

                <div className="trust-row">
                  <span>🛡️ Protection Achats PayPal</span>
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
                    {cryptoAddr[activeCoin] || '⚠️ Adresse non configurée — contactez paiement@streammalin.fr'}
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

                <div className="warn-box" style={{ marginTop: 16 }}>
                  <strong>⚠️ Important :</strong> Une fois la transaction envoyée, transmettez le <strong>TXID</strong> à <strong>paiement@streammalin.fr</strong> avec votre email de livraison. Votre slot sera activé sous 1h max après {activeCoin === 'btc' ? '1-3' : '2-12'} confirmation{activeCoin === 'btc' ? 's' : ''} réseau.
                </div>

                <div className="trust-row">
                  <span>🔗 Confirmations on-chain</span>
                  <span>⚡ Activation &lt; 1h</span>
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
                <div className="sub">⭐ 5.0 · Accès Officiel · Stable</div>
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
              <div className="guarantee-box-title">🛡️ Garanties StreamMalin incluses</div>
              <div className="guarantee-box-text">
                Remplacement ou remboursement garanti sous 24h en cas de dysfonctionnement du compte. Support 7j/7.
              </div>
            </div>

            <div className="trust-row" style={{ marginTop: 18 }}>
              <span>🔒 Paiement SSL</span>
              <span>⚡ Activation instantanée</span>
              <span>💬 Support 7j/7</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center text-[#9ca3af] font-light">
        Chargement du tunnel de paiement...
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
