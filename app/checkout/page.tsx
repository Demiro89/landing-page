'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Footer from '@/components/Footer';
import SiteHeader from '@/components/SiteHeader';
import { CURRENT_TERMS_VERSION, CURRENT_TERMS_URL } from '@/lib/termsVersion';
import { formatEuro, matchesServiceFilter } from '@/lib/offerPresentation';
import ServiceMark from '@/components/ServiceMark';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { CRYPTO_COINS, isCryptoCoin, type CryptoCoin } from '@/lib/manualPayment';
import { Bitcoin, CreditCard, WalletCards, ListChecks, Headphones, LockKeyhole, CircleCheck, CircleAlert, PlayCircle } from 'lucide-react';
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
  const stripeCancelled = searchParams.get('cancelled') === 'true';

  const [service, setService] = useState<ServiceDetails | null>(null);
  const [configuredCoins, setConfiguredCoins] = useState<CryptoCoin[]>([]);
  const [manualDestination, setManualDestination] = useState('');
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
  const [ratesError, setRatesError] = useState('');
  const [ratesReload, setRatesReload] = useState(0);

  const consentOk = acceptedCgv && acceptedImmediate && acceptedEligibility;

  useEffect(() => {
    fetch('/api/client/me?profile=1', { cache: 'no-store' }).then(response => response.json()).then(data => {
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
      setManualDestination(''); setConfiguredCoins([]);
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

    // Public settings contain availability only, never payment destinations.
    fetch('/api/settings/public', { cache: 'no-store', signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.success) {
          const coins = Array.isArray(d.settings.crypto_coins) ? d.settings.crypto_coins.filter(isCryptoCoin) : [];
          setConfiguredCoins(coins);
          setActiveCoin(coins[0] ?? 'btc');
          const enabled = { cb: d.settings.gateway_cb === 'true', paypal: d.settings.gateway_paypal === 'true', crypto: d.settings.gateway_crypto === 'true' && coins.length > 0 };
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
    let active = true;
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,tether&vs_currencies=eur')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: Record<string, { eur: number }>) => {
        if (!active) return;
        const btcEur = d.bitcoin?.eur;
        const ethEur = d.ethereum?.eur;
        const ltcEur = d.litecoin?.eur;
        const usdtEur = d.tether?.eur;
        if ([btcEur, ethEur, ltcEur, usdtEur].every(rate => Number.isFinite(rate) && rate > 0)) {
          setCryptoRates({ btc: 1 / btcEur, eth: 1 / ethEur, usdt: 1 / usdtEur, ltc: 1 / ltcEur });
          setRatesLive(true);
          setRatesError('');
          setRatesUpdatedAt(new Date());
        } else {
          setRatesLive(false);
          setRatesError('Le taux de change crypto est momentanément indisponible. Réessayez ou utilisez la carte bancaire.');
        }
      })
      .catch(() => {
        if (!active) return;
        setRatesLive(false);
        setRatesError('Le taux de change crypto est momentanément indisponible. Réessayez ou utilisez la carte bancaire.');
      });
    return () => { active = false; };
  }, [payTab, gateways.crypto, ratesReload]);

  const isYoutube = Boolean(serviceId && matchesServiceFilter(serviceId, ['youtube']));
  const identityOk = Boolean(normalizeEmail(email)) && (!isYoutube || Boolean(normalizeEmail(youtubeEmail)));
  const missingIdentityLabel = !normalizeEmail(email)
    ? 'Saisissez une adresse e-mail valide pour continuer'
    : 'Saisissez votre adresse e-mail YouTube pour continuer';

  const handleStripeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeEmail(email) || !serviceId || !stockId || !service || isSubmitting) return;
    if (isYoutube && !normalizeEmail(youtubeEmail)) {
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
          amountMinor: Math.round(service.price * 100),
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
    if (!serviceId || !stockId || !normalizeEmail(email)) {
      setErrorMsg('Merci de renseigner votre adresse email.');
      return null;
    }
    if (isYoutube && !normalizeEmail(youtubeEmail)) {
      setErrorMsg('Merci d\'indiquer votre adresse e-mail YouTube.');
      return null;
    }
    if (!consentOk) {
      setErrorMsg('Merci d\'accepter les CGV, la demande d\'exécution immédiate et la confirmation d\'éligibilité.');
      return null;
    }
    if (!service || !stockAvailable) {
      setErrorMsg('Cette offre n\'est plus disponible. Merci de sélectionner une autre offre.');
      return null;
    }
    if (!gateways[method] || manualBusy) return null;
    if (method === 'crypto' && (!configuredCoins.includes(activeCoin) || !ratesLive || !ratesAreFresh(ratesUpdatedAt))) {
      setErrorMsg('Le taux de conversion doit être actualisé avant de continuer. Rechargez la page ou contactez le support.');
      return null;
    }
    setManualBusy(true);
    setErrorMsg('');
    const amountMinor = Math.round(service.price * 100);
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
          amountMinor,
          cryptoCoin: method === 'crypto' ? activeCoin : undefined,
          acceptedCgv,
          acceptedImmediateExecution: acceptedImmediate,
          acceptedEligibility,
          termsVersion: CURRENT_TERMS_VERSION,
          attemptId: attemptId(method === 'crypto' ? `crypto:${activeCoin}` : method),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && typeof data.orderId === 'string' &&
          typeof data.destination === 'string' && data.destination && data.amountMinor === amountMinor &&
          typeof data.expiresAt === 'string' && Date.parse(data.expiresAt) > Date.now()) {
        setManualDestination(data.destination);
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
      <div className="site-theme min-h-screen">
        <SiteHeader checkout />
        <main className="checkout-state"><p role="status">Chargement de votre commande…</p></main>
      </div>
    );
  }

  if (!service || !stockId || (stockChecked && !stockAvailable)) {
    return (
      <div className="site-theme min-h-screen">
        <SiteHeader checkout />
        <main className="checkout-state">
          <CircleAlert size={25} aria-hidden="true" />
          <h1>{loadError ? 'Paiement temporairement indisponible' : 'Cette offre n’est plus disponible'}</h1>
          <p>{loadError ? 'Nous n’avons pas pu charger votre commande. Réessayez dans quelques instants.' : 'Contactez-nous pour connaître les prochaines disponibilités ou choisissez une autre offre.'}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link href="/#offres" className="btn btn-primary">Voir les abonnements</Link>
            <Link href="/contact" className="btn btn-outline">Nous contacter</Link>
          </div>
        </main>
      </div>
    );
  }

  const cryptoPrecision = (coin: CryptoCoin) =>
    coin === 'btc' ? 6 : coin === 'eth' ? 5 : coin === 'usdt' ? 2 : 4;

  const orderRef = manualOrderId ? manualOrderId.slice(0, 8).toUpperCase() : '';
  const paypalUrl = manualOrderId && !manualExpired && manualDestination
    ? `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(manualDestination)}&amount=${service.price.toFixed(2)}&currency_code=EUR&item_name=StreamMalin+-+${encodeURIComponent(service.name)}&no_shipping=1`
    : '';

  return (
    <div className="site-theme checkout-page">
      <SiteHeader checkout />

      <main className="checkout-wrap">
        {/* Header */}
        <div className="checkout-head">
          <ol className="checkout-steps" aria-label="Étapes de commande">
            <li className="done"><span className="checkout-step-dot">1</span> Offre choisie</li>
            <li className="active" aria-current="step"><span className="checkout-step-dot">2</span> Coordonnées &amp; paiement</li>
            <li><span className="checkout-step-dot">3</span> Suivi &amp; accès</li>
          </ol>
          <h1>Finaliser votre commande</h1>
          <p>Vérifiez le prix et le renouvellement. Accès transmis après validation de la commande et selon disponibilité.</p>
        </div>

        <div className="checkout-grid">
          {/* ── Récapitulatif ── */}
          <div className="glass-panel checkout-card checkout-summary fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="checkout-card-head">
              <div className="icon-bubble">
                <ListChecks size={20} aria-hidden="true" />
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
              <div className="recap-service-price">{formatEuro(service.price)}</div>
            </div>

            <div className="recap-line-list">
              <div className="recap-line">
                <span>Prix de l&apos;accès</span>
                <strong>{formatEuro(service.price)}</strong>
              </div>
              <div className="recap-line">
                <span>Frais d&apos;activation</span>
                <strong style={{ color: 'var(--accent-green)' }}>Gratuit</strong>
              </div>
              {savings !== null && <div className="recap-line savings">
                <span>Économie estimée</span>
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
              <span className="recap-total-value">{formatEuro(service.price)}</span>
            </div>

            <div className="guarantee-box">
              <div className="guarantee-box-title"><Headphones size={16} aria-hidden="true" /> Suivi StreamMalin inclus</div>
              <div className="guarantee-box-text">
                Suivi des accès et assistance en cas de dysfonctionnement, avec traitement selon les CGV et les disponibilités.
              </div>
            </div>

            <div className="trust-row" style={{ marginTop: 18 }}>
              <span><LockKeyhole size={14} aria-hidden="true" /> Paiement via prestataire</span>
              <span><CircleCheck size={14} aria-hidden="true" /> Accès après validation</span>
              <span><Headphones size={14} aria-hidden="true" /> Assistance en français</span>
            </div>
          </div>

          {/* ── Formulaire ── */}
          <div className="glass-panel checkout-card checkout-form fade-in-up">
            <div className="checkout-card-head">
              <div className="icon-bubble">
                <CreditCard size={20} aria-hidden="true" />
              </div>
              Choisir un moyen de paiement
            </div>

            {stripeCancelled && !errorMsg && (
              <div className="info-box" role="status" style={{ borderLeft: '3px solid var(--site-blue)', paddingLeft: 12 }}>
                Le paiement par carte a été annulé. Aucun débit n’a été effectué ; vous pouvez réessayer ou choisir un autre moyen.
              </div>
            )}
            {errorMsg && <div className="error-box" role="alert">{errorMsg}</div>}
            {!Object.values(gateways).some(Boolean) && <p role="status">Aucun moyen de paiement disponible actuellement.</p>}

            {/* Pay tabs */}
            <div className="pay-tabs">
              {([
                { id: 'cb' as PayTab, Icon: CreditCard, label: 'Carte bancaire' },
                { id: 'paypal' as PayTab, Icon: WalletCards, label: 'PayPal' },
                { id: 'crypto' as PayTab, Icon: Bitcoin, label: 'Crypto' },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setPayTab(tab.id); setManualOrderId(null); setErrorMsg(''); }}
                  className={`pay-tab ${payTab === tab.id ? 'active' : ''}`}
                  disabled={!gateways[tab.id] || manualBusy || isSubmitting || Boolean(manualOrderId)}
                  aria-pressed={payTab === tab.id}
                >
                  <tab.Icon size={18} aria-hidden="true" />
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
                <div className="checkout-callout-youtube">
                  <div className="checkout-callout-title">
                    <PlayCircle size={17} aria-hidden="true" />
                    YouTube Premium fonctionne par invitation famille
                  </div>
                  <div className="checkout-callout-text">
                    YouTube Premium nécessite une invitation dans un groupe famille compatible. Indiquez ci-dessous l&apos;<strong>adresse e-mail Google associée à votre compte YouTube</strong>. L&apos;invitation est envoyée après validation du paiement et selon disponibilité ; il vous suffira de l&apos;accepter pour activer l&apos;accès si votre compte est éligible.
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
                    disabled={Boolean(manualOrderId)}
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
            <div className="checkout-consents">
              <label className="checkout-consent-item">
                <input
                  type="checkbox"
                  checked={acceptedCgv}
                  disabled={Boolean(manualOrderId)}
                  onChange={e => setAcceptedCgv(e.target.checked)}
                />
                <span>
                  J&apos;ai lu et j&apos;accepte les{' '}
                  <a href={CURRENT_TERMS_URL} target="_blank" rel="noopener noreferrer">
                    CGV
                  </a>{' '}
                  de StreamMalin.
                </span>
              </label>
              <label className="checkout-consent-item">
                <input
                  type="checkbox"
                  checked={acceptedImmediate}
                  disabled={Boolean(manualOrderId)}
                  onChange={e => setAcceptedImmediate(e.target.checked)}
                />
                <span>
                  Je demande l&apos;exécution immédiate et reconnais que la perte du droit de rétractation n&apos;intervient que si les conditions légales applicables à cette offre sont réunies, comme expliqué dans les CGV.
                </span>
              </label>
              <label className="checkout-consent-item">
                <input
                  type="checkbox"
                  checked={acceptedEligibility}
                  disabled={Boolean(manualOrderId)}
                  onChange={e => setAcceptedEligibility(e.target.checked)}
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
                  <div className="info-box-title"><LockKeyhole size={16} aria-hidden="true" /> Paiement sur Stripe</div>
                  <div className="info-box-text">
                    Vous serez redirigé vers Stripe. <strong>Prélèvement mensuel automatique de {formatEuro(service.price)}.</strong> Résiliation avant la prochaine échéance depuis votre espace client. Les informations complètes de carte sont traitées par Stripe, pas par StreamMalin.
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !gateways.cb || !identityOk || !consentOk || !stockAvailable}
                  className="btn-pay"
                >
                  {isSubmitting ? 'Redirection…' : !stockAvailable ? 'Offre indisponible' : !consentOk ? 'Cochez les 3 confirmations pour continuer' : !identityOk ? missingIdentityLabel : `S’abonner pour ${formatEuro(service.price)}/mois avec obligation de paiement`}
                </button>
                <div className="trust-row">
                  <span>Paiement traité par Stripe</span>
                  <span><CircleCheck size={14} aria-hidden="true" /> Accès après validation</span>
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
                    <li>Envoyez <strong style={{ color: 'var(--text-white)' }}>{formatEuro(service.price)}</strong> en mode <strong style={{ color: 'var(--accent-yellow)' }}>« Biens et Services »</strong>.</li>
                    <li>Dans la note, indiquez la référence <strong style={{ color: 'var(--text-white)' }}>{orderRef}</strong>.</li>
                    <li>Vos accès sont traités rapidement après vérification du paiement et selon disponibilité.</li>
                  </ol>
                </div>

                <div className="crypto-addr-box" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Adresse PayPal de réception
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-white)', fontFamily: "'SF Mono', Menlo, monospace" }}>
                      {manualDestination}
                    </span>
                    {manualDestination && (
                      <button
                      onClick={() => copyAddr(manualDestination, 'paypal')}
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
                    disabled={!gateways.paypal || !consentOk || manualBusy || !identityOk || !stockAvailable}
                    onClick={() => createManualOrder('paypal')}
                    className="btn btn-primary"
                    style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 12, background: '#0070ba' }}
                  >
                    {manualBusy ? 'Enregistrement…' : !stockAvailable ? 'Offre indisponible' : !consentOk ? 'Cochez les 3 confirmations pour continuer' : !identityOk ? missingIdentityLabel : `Payer ${formatEuro(service.price)} via PayPal avec obligation de paiement`}
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
                  {CRYPTO_COINS.map(coin => (
                    <button
                      key={coin}
                      disabled={manualBusy || !!manualOrderId || !configuredCoins.includes(coin)}
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

                {ratesError && (
                  <div className="error-box" role="alert" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span>{ratesError}</span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setRatesReload(n => n + 1)}>
                      Réessayer
                    </button>
                  </div>
                )}

                {manualOrderId && !manualExpired && <div className="crypto-addr-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Montant à envoyer
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: "'Outfit',sans-serif", color: CRYPTO_META[activeCoin].color, marginTop: 4 }}>
                        {ratesLive ? `${(service.price * cryptoRates[activeCoin]).toFixed(cryptoPrecision(activeCoin))} ${activeCoin.toUpperCase()}` : 'Conversion indisponible'}
                      </div>
                      <div style={{ fontSize: '0.68rem', marginTop: 4, color: ratesLive ? 'var(--accent-green)' : 'var(--accent-yellow)', fontWeight: 600 }}>
                        {ratesLive
                          ? `✅ Taux live · ${ratesUpdatedAt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Contactez le support avant tout transfert.'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>≈ EUR</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{formatEuro(service.price)}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 14, marginBottom: 0 }}>
                    Adresse de réception
                  </div>
                  <div className="crypto-addr">
                    {manualDestination}
                  </div>
                  {manualDestination && (
                    <button
                      onClick={() => copyAddr(manualDestination, activeCoin)}
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
                    disabled={!gateways.crypto || !ratesLive || !consentOk || manualBusy || !identityOk || !configuredCoins.includes(activeCoin) || !stockAvailable}
                    onClick={() => createManualOrder('crypto')}
                    className="btn btn-primary"
                    style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 14 }}
                  >
                    {manualBusy ? 'Enregistrement…' : !stockAvailable ? 'Offre indisponible' : !consentOk ? 'Cochez les 3 confirmations pour continuer' : !identityOk ? missingIdentityLabel : !ratesLive ? 'Chargement du taux de conversion…' : `Payer ${formatEuro(service.price)} en crypto avec obligation de paiement`}
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

        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="site-theme min-h-screen">
        <SiteHeader checkout />
        <main className="checkout-state"><p role="status">Chargement de votre commande…</p></main>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
