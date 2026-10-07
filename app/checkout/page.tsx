'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Footer from '@/components/Footer';
import { CURRENT_TERMS_VERSION, CURRENT_TERMS_URL } from '@/lib/termsVersion';
import { formatEuro, matchesServiceFilter } from '@/lib/offerPresentation';
import ServiceMark from '@/components/ServiceMark';
import './checkout.css';

interface ServiceDetails {
  id: string;
  name: string;
  tagline: string;
  price: number;
  original: number;
  icon: string;
  gradient: string;
  eligibility: string;
  accessType: string;
  privacyNote: string;
  referenceVerified: boolean;
}

interface PublicStockSummary {
  id: string;
  serviceId: string;
  price: number;
}

type PayTab = 'cb' | 'paypal' | 'crypto';
type CryptoCoin = 'btc' | 'eth' | 'usdt' | 'ltc';

const CRYPTO_META: Record<CryptoCoin, { label: string; color: string; symbol: string }> = {
  btc: { label: 'Bitcoin (BTC)', color: '#F7931A', symbol: '₿' },
  eth: { label: 'Ethereum (ETH)', color: '#627EEA', symbol: '⟠' },
  usdt: { label: 'USDT (TRC20)', color: '#26A17B', symbol: '₮' },
  ltc: { label: 'Litecoin (LTC)', color: '#345D9D', symbol: 'Ł' },
};

const ratesAreFresh = (updatedAt: Date | null) => updatedAt !== null && Date.now() - updatedAt.getTime() <= 300000;

function CheckoutContent() {
  const searchParams = useSearchParams();
  const serviceId = searchParams.get('service');
  const stockId = searchParams.get('stock');

  const [service, setService] = useState<ServiceDetails | null>(null);
  const [cryptoAddr, setCryptoAddr] = useState<Record<string, string>>({ btc: '', eth: '', usdt: '', ltc: '' });
  const [paypalEmail, setPaypalEmail] = useState('');
  const [loadingService, setLoadingService] = useState(true);
  const [email, setEmail] = useState('');
  const attempt = useRef<{ identity: string; id: string } | null>(null);
  const attemptId = (method: string) => {
    const identity = JSON.stringify([serviceId, stockId, email.trim().toLowerCase(), youtubeEmail.trim().toLowerCase(), method, CURRENT_TERMS_VERSION]);
    if (!attempt.current || attempt.current.identity !== identity) attempt.current = { identity, id: crypto.randomUUID() };
    return attempt.current.id;
  };
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
  const [loadError, setLoadError] = useState(false);
  const [gateways, setGateways] = useState<Record<PayTab, boolean>>({ cb: false, paypal: false, crypto: false });
  const [manualOrderId, setManualOrderId] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualExpiresAt, setManualExpiresAt] = useState<string | null>(null);
  const [manualExpired, setManualExpired] = useState(false);
  const [cryptoRates, setCryptoRates] = useState<Record<CryptoCoin, number>>({ btc: 0, eth: 0, usdt: 0, ltc: 0 });
  const [ratesLive, setRatesLive] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<Date | null>(null);

  const consentOk = acceptedCgv && acceptedImmediate && acceptedEligibility;

  useEffect(() => {
    fetch('/api/client/me', { cache: 'no-store' }).then(response => response.json()).then(data => {
      if (data.authenticated && data.customer?.email) setEmail(value => value || data.customer.email);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    if (!serviceId || !stockId) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setLoadingService(false);
        setStockChecked(true);
        setService(null); setStockAvailable(false);
      });
      return () => { cancelled = true; controller.abort(); };
    }

    const loadCheckoutData = async () => {
      if (cancelled) return;
      setLoadingService(true); setStockAvailable(false); setService(null); setLoadError(false);
      setStockChecked(false); setManualOrderId(null); setManualExpiresAt(null); setManualExpired(false);
      setGateways({ cb: false, paypal: false, crypto: false });
      setAcceptedCgv(false); setAcceptedImmediate(false); setAcceptedEligibility(false);
      try {
        const [servicesRes, stocksRes] = await Promise.all([
          fetch('/api/services', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/stocks/public', { cache: 'no-store', signal: controller.signal }),
        ]);
        const [servicesData, stocksData] = await Promise.all([
          servicesRes.json() as Promise<{ success?: boolean; services?: ServiceDetails[] }>,
          stocksRes.json() as Promise<{ success?: boolean; stocks?: PublicStockSummary[] }>,
        ]);
        if (cancelled) return;
        if (!servicesRes.ok || !stocksRes.ok || !servicesData.success || !stocksData.success) throw new Error('Checkout data unavailable');
        const found = servicesData.services?.find((s) => s.id === serviceId);
        const selectedStock = stocksData.stocks?.find((stock) => stock.id === stockId && stock.serviceId === serviceId);
        if (found && selectedStock && Number.isFinite(selectedStock.price) && selectedStock.price > 0) {
          setService({ ...found, price: selectedStock.price });
          setStockAvailable(true);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) { setStockChecked(true); setLoadingService(false); }
      }
    };
    void Promise.resolve().then(loadCheckoutData);

    // Récupère les paramètres publics du paiement (adresses crypto, passerelles).
    fetch('/api/settings/public', { cache: 'no-store', signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.success) {
          setCryptoAddr({
            btc: d.settings.crypto_btc || '',
            eth: d.settings.crypto_eth || '',
            usdt: d.settings.crypto_usdt || '',
            ltc: d.settings.crypto_ltc || '',
          });
          setPaypalEmail(d.settings.paypal_email || '');
          const enabled = { cb: d.settings.gateway_cb === 'true', paypal: d.settings.gateway_paypal === 'true' && Boolean(d.settings.paypal_email), crypto: d.settings.gateway_crypto === 'true' && Boolean(d.settings.crypto_btc || d.settings.crypto_eth || d.settings.crypto_usdt || d.settings.crypto_ltc) };
          setGateways(enabled);
          setPayTab(enabled.cb ? 'cb' : enabled.paypal ? 'paypal' : 'crypto');
        } else {
          setErrorMsg('Les moyens de paiement sont temporairement indisponibles.');
        }
      })
      .catch(() => { if (!cancelled) setErrorMsg('Les moyens de paiement sont temporairement indisponibles.'); });

    // Do not display a payment amount if live conversion is unavailable.
    // Rates are loaded only after a user selects an enabled crypto gateway.
    return () => { cancelled = true; controller.abort(); };
  }, [serviceId, stockId]);

  useEffect(() => {
    if (!manualExpiresAt) return;
    const timer = setTimeout(() => setManualExpired(true), Math.max(0, new Date(manualExpiresAt).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [manualExpiresAt]);

  useEffect(() => {
    if (payTab !== 'crypto' || !gateways.crypto) return;
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,tether&vs_currencies=eur')
      .then(r => r.json())
      .then((d: Record<string, { eur: number }>) => {
        const btcEur = d.bitcoin?.eur;
        const ethEur = d.ethereum?.eur;
        const ltcEur = d.litecoin?.eur;
        const usdtEur = d.tether?.eur;
        if ([btcEur, ethEur, ltcEur, usdtEur].every(rate => Number.isFinite(rate) && rate > 0)) {
          setCryptoRates({ btc: 1 / btcEur, eth: 1 / ethEur, usdt: 1 / usdtEur, ltc: 1 / ltcEur });
          setRatesLive(true);
          setRatesUpdatedAt(new Date());
        }
      })
      .catch(() => {});
  }, [payTab, gateways.crypto]);

  const isYoutube = Boolean(serviceId && matchesServiceFilter(serviceId, ['youtube']));

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
    if (!gateways.cb) { setErrorMsg('Ce moyen de paiement est indisponible.'); return; }
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
          termsVersion: CURRENT_TERMS_VERSION,
          attemptId: attemptId('cb'),
        }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.assign(data.url);
      } else {
        setErrorMsg(data.error || 'Erreur lors du traitement de la transaction.');
        setIsSubmitting(false);
      }
    } catch {
      setErrorMsg('Erreur de communication avec le serveur.');
      setIsSubmitting(false);
    }
  };

  const copyAddr = async (addr: string, coin: string) => {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(coin);
      setTimeout(() => setCopied(''), 2000);
    } catch { setErrorMsg('La copie est indisponible. Sélectionnez le texte pour le copier.'); }
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
    if (!gateways[method] || manualBusy) return null;
    if (method === 'crypto' && (!ratesLive || !ratesAreFresh(ratesUpdatedAt))) {
      setErrorMsg('Le taux de conversion doit être actualisé avant de continuer. Rechargez la page ou contactez le support.');
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
          cryptoCoin: method === 'crypto' ? activeCoin : undefined,
          acceptedCgv,
          acceptedImmediateExecution: acceptedImmediate,
          acceptedEligibility,
          termsVersion: CURRENT_TERMS_VERSION,
          attemptId: attemptId(method),
        }),
      });
      const data = await res.json();
      if (data.success && data.orderId) {
        setManualOrderId(data.orderId);
        setManualExpiresAt(data.expiresAt || null);
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

  const savings = service?.referenceVerified && service.original > service.price ? service.original - service.price : null;

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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 10 }}>{loadError ? 'Paiement temporairement indisponible' : 'Cette offre n’est plus disponible'}</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-gray)', maxWidth: 420, marginBottom: 24 }}>
          {loadError ? 'Nous n’avons pas pu charger votre commande. Réessayez dans quelques instants.' : 'Contactez-nous pour connaître les prochaines disponibilités ou choisissez une autre offre.'}
        </p>
        <Link href="/" className="btn btn-primary">← Retour à la boutique</Link>
      </div>
    );
  }

  const cryptoPrecision = (coin: CryptoCoin) =>
    coin === 'btc' ? 6 : coin === 'eth' ? 5 : coin === 'usdt' ? 2 : 4;

  const orderRef = manualOrderId ? manualOrderId.slice(0, 8).toUpperCase() : '';
  const paypalUrl = paypalEmail
    ? `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(paypalEmail)}&amount=${service.price.toFixed(2)}&currency_code=EUR&item_name=StreamMalin+-+${encodeURIComponent(service.name)}&no_shipping=1`
    : '';

  return (
    <div className="checkout-page" style={{ minHeight: '100vh', position: 'relative' }}>
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
              <div className="icon-bubble">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              Choisir un moyen de paiement
            </div>

            {errorMsg && <div className="error-box" role="alert">{errorMsg}</div>}
            {!Object.values(gateways).some(Boolean) && <p role="status">Aucun moyen de paiement disponible actuellement.</p>}

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
                  disabled={!gateways[tab.id] || manualBusy || isSubmitting || Boolean(manualOrderId)}
                  aria-pressed={payTab === tab.id}
                >
                  <span className="pay-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Email */}
            <div className="form-field">
              <label className="form-label" htmlFor="checkout-email">
                Adresse email <span className="required">*</span>
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', letterSpacing: 0, textTransform: 'none', marginLeft: 8 }}>(pour recevoir votre confirmation)</span>
              </label>
              <input
                id="checkout-email"
                type="email"
                required
                disabled={Boolean(manualOrderId)}
                autoComplete="email"
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
                  <label className="form-label" htmlFor="checkout-youtube-email">
                    Adresse e-mail YouTube (Google) <span className="required">*</span>
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', letterSpacing: 0, textTransform: 'none', marginLeft: 8 }}>(pour recevoir l&apos;invitation)</span>
                  </label>
                  <input
                    id="checkout-youtube-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="votre.compte@gmail.com"
                    value={youtubeEmail}
                    onChange={e => setYoutubeEmail(e.target.value)}
                    className="dash-input"
                  />
                </div>
              </>
            )}

            {/* Consentements obligatoires — CGV + exécution immédiate + éligibilité */}
            <div className="checkout-conditions">
              <h2>Conditions de cette offre</h2>
              <p><strong>Type d’accès :</strong> {service.accessType}</p>
              <p><strong>Éligibilité :</strong> {service.eligibility}</p>
              <p><strong>Confidentialité :</strong> {service.privacyNote}</p>
              <Link href={`/offres/${encodeURIComponent(service.id)}`}>Consulter les détails de l’offre</Link>
            </div>
            <div
              style={{
                margin: '4px 0 18px',
                padding: '14px 0',
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
                  <a href={CURRENT_TERMS_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
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
                  Je demande l&apos;exécution immédiate et reconnais que la perte du droit de rétractation n&apos;intervient que si les conditions légales applicables à cette offre sont réunies, comme expliqué dans les CGV.
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
                    Vous serez redirigé vers Stripe. <strong>Prélèvement mensuel automatique de {formatEuro(service.price)}.</strong> Résiliation avant la prochaine échéance depuis votre espace client. Les informations complètes de carte sont traitées par Stripe, pas par StreamMalin.
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !gateways.cb || !email || (isYoutube && !youtubeEmail.trim()) || !consentOk || !stockAvailable}
                  className="btn-pay"
                >
                  {isSubmitting ? 'Redirection…' : !consentOk ? 'Cochez les 3 confirmations pour continuer' : !stockAvailable ? 'Offre indisponible' : `S’abonner pour ${formatEuro(service.price)}/mois avec obligation de paiement`}
                </button>
                <div className="trust-row">
                  <span>Paiement traité par Stripe</span>
                  <span>⚡ Accès après validation</span>
                </div>
              </form>
            )}

            {/* PayPal */}
            {payTab === 'paypal' && (
              <div>
                <p>PayPal : paiement manuel pour un mois, sans prélèvement automatique. Attendez l’enregistrement de la commande avant d’effectuer un transfert.</p>
                {manualOrderId && !manualExpired && <><div className="warn-box">
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
                      {paypalEmail || '⚠️ Adresse non configurée — contactez hello@streammalin.fr'}
                    </span>
                    {paypalEmail && (
                      <button
                      onClick={() => copyAddr(paypalEmail, 'paypal')}
                        className={`copy-btn ${copied === 'paypal' ? 'copied' : ''}`}
                      >
                        {copied === 'paypal' ? '✅ Copié' : '📋 Copier'}
                      </button>
                    )}
                  </div>
                </div>

                </>}
                {manualOrderId ? (
                  <div className="info-box" style={{ marginTop: 12, borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
                    <div className="info-box-title" style={{ color: 'var(--accent-green)' }}>
                      ✅ Commande enregistrée — référence {orderRef}
                    </div>
                    <div className="info-box-text">
                      {manualExpired ? 'Ne payez pas cette réservation expirée. Contactez le support avec la référence ' : 'Avant l’expiration, effectuez le paiement PayPal en indiquant la référence '}
                      <strong style={{ color: 'var(--text-white)' }}>{orderRef}</strong> dans la note.
                      Vos accès seront traités après vérification du paiement reçu et selon disponibilité.
                      {manualExpiresAt && <> Réservation jusqu’au {new Date(manualExpiresAt).toLocaleString('fr-FR')}. Après cette heure, contactez le support avant de payer.</>}
                    </div>
                    {!manualExpired && <a
                      href={paypalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ display: 'block', textAlign: 'center', marginTop: 10, background: '#0070ba' }}
                    >
                      🅿️ Ouvrir PayPal →
                    </a>}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!gateways.paypal || !consentOk || manualBusy || !email || !stockAvailable || !paypalEmail}
                    onClick={async () => {
                      const id = await createManualOrder('paypal');
                      if (id) window.open(paypalUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="btn btn-primary"
                    style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 12, background: consentOk && stockAvailable && paypalEmail ? '#0070ba' : undefined, opacity: consentOk && stockAvailable && paypalEmail ? 1 : 0.5, cursor: consentOk && stockAvailable && paypalEmail ? 'pointer' : 'not-allowed' }}
                  >
                    {manualBusy ? 'Enregistrement…' : !consentOk ? 'Cochez les 3 confirmations pour continuer' : !stockAvailable ? 'Offre indisponible' : !paypalEmail ? 'PayPal non configuré' : `🅿️ Payer ${service.price.toFixed(2)}€ via PayPal →`}
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
                      disabled={manualBusy || !!manualOrderId || !cryptoAddr[coin]}
                      aria-pressed={activeCoin === coin}
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

                {manualOrderId && !manualExpired && <div className="crypto-addr-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Montant à envoyer
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: "'Outfit',sans-serif", color: CRYPTO_META[activeCoin].color, marginTop: 4 }}>
                        {ratesLive ? `${(service.price * cryptoRates[activeCoin]).toFixed(cryptoPrecision(activeCoin))} ${activeCoin.toUpperCase()}` : 'Conversion indisponible'}
                      </div>
                      <div style={{ fontSize: '0.68rem', marginTop: 4, color: ratesLive ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                        {ratesLive
                          ? `✅ Taux live · ${ratesUpdatedAt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Contactez le support avant tout transfert.'}
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
                </div>}

                {manualOrderId ? (
                  <div className="info-box" style={{ marginTop: 14, borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
                    <div className="info-box-title" style={{ color: 'var(--accent-green)' }}>
                      ✅ Commande enregistrée — référence {orderRef}
                    </div>
                    <div className="info-box-text">
                      {manualExpired ? 'La réservation a expiré : n’envoyez aucun paiement. Contactez ' : 'Avant l’expiration de la réservation, envoyez le paiement à l’adresse ci-dessus, puis transmettez votre TXID à '}
                      <strong style={{ color: 'var(--text-white)' }}>hello@streammalin.fr</strong> en précisant la
                      référence <strong style={{ color: 'var(--text-white)' }}>{orderRef}</strong>.
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!gateways.crypto || !ratesLive || !consentOk || manualBusy || !email || !cryptoAddr[activeCoin] || !stockAvailable}
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
            {manualExpired && <p role="alert" className="warn-box">Réservation expirée. N’effectuez aucun transfert ; contactez le support pour vérifier la disponibilité.</p>}
          </div>

          {/* ── Récapitulatif ── */}
          <div className="glass-panel checkout-card fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="checkout-card-head">
              <div className="icon-bubble">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              </div>
              Récapitulatif
            </div>

            <div className="recap-service">
              <div className="recap-service-icon">
                <ServiceMark id={service.id} name={service.name} />
              </div>
              <div className="recap-service-info">
                <div className="name">{service.name}</div>
                <div className="sub">Accès numérique · Un mois</div>
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
              {savings !== null && <div className="recap-line savings">
                <span>💰 Économie estimée</span>
                <strong>{formatEuro(savings)}/mois</strong>
              </div>}
              <div className="recap-divider" />
              <div className="recap-line" style={{ fontSize: '0.78rem' }}>
                <span>Fréquence</span>
                <strong>{payTab === 'cb' ? 'Prélèvement mensuel automatique' : 'Paiement manuel pour un mois'}</strong>
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
