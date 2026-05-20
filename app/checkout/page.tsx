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
      <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center text-[#9ca3af] font-light">
        Initialisation du tunnel de paiement sécurisé...
      </div>
    );
  }

  if (!service || !stockId) {
    return (
      <div className="min-h-screen bg-[#0b0c10] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">Session de checkout expirée ou invalide</h2>
        <p className="text-sm text-[#9ca3af] max-w-sm mb-6 font-light">
          Le lien de paiement est erroné ou ce compte de stock n&apos;est plus disponible.
        </p>
        <a href="/" className="btn btn-primary rounded-xl px-6 py-3">← Retour à la boutique</a>
      </div>
    );
  }

  const cryptoPrecision = (coin: CryptoCoin) =>
    coin === 'btc' ? 6 : coin === 'eth' ? 5 : coin === 'usdt' ? 2 : 4;

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#e5e7eb]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0b0c10]/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-extrabold text-lg">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black" style={{ background: 'var(--gradient-primary)' }}>SM</div>
            <span className="gradient-text">StreamMalin</span>
          </a>
          <a href="/" className="text-sm text-[#9ca3af] hover:text-white transition-colors">← Retour à la boutique</a>
        </div>
      </header>

      <main className="pt-28 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-black text-white mb-2">
              Finaliser votre <span className="gradient-text">commande</span>
            </h2>
            <p className="text-[#9ca3af] font-light">Paiement 100% crypté SSL — Activation immédiate de vos accès Premium</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Formulaire */}
            <div className="md:col-span-7 glass-panel rounded-2xl p-8">
              <h3 className="text-xl font-extrabold text-white mb-6">💳 Choisir un moyen de paiement</h3>

              {errorMsg && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{errorMsg}</div>
              )}

              {/* Email */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-[#9ca3af] uppercase tracking-wide mb-2">
                  Adresse email (pour recevoir vos identifiants)
                </label>
                <input
                  type="email"
                  required
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#141524] border border-white/10 text-white placeholder-[#6b7280] focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                {([
                  { id: 'cb' as PayTab, icon: '💳', label: 'Carte Bancaire' },
                  { id: 'paypal' as PayTab, icon: '🅿️', label: 'PayPal' },
                  { id: 'crypto' as PayTab, icon: '₿', label: 'Cryptomonnaies' },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setPayTab(tab.id)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-bold transition-all ${
                      payTab === tab.id ? 'text-white border-transparent' : 'border-white/10 bg-[#141524] text-[#9ca3af] hover:bg-white/5'
                    }`}
                    style={payTab === tab.id ? { background: 'var(--gradient-primary)' } : {}}
                  >
                    <span className="text-xl">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* CB */}
              {payTab === 'cb' && (
                <form onSubmit={handleStripeCheckout} className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                    <p className="font-semibold text-white text-sm mb-1">💳 Redirection sécurisée vers Stripe</p>
                    <p className="text-xs text-[#9ca3af] font-light">Achetez en toute sécurité. Les données bancaires sont cryptées côté serveur par la passerelle Stripe 3D Secure.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !email}
                    className="w-full btn btn-primary py-4 rounded-xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    🔒 {isSubmitting ? 'Redirection...' : `Régler en toute sécurité — ${service.price.toFixed(2)}€`}
                  </button>
                  <p className="text-[10px] text-center text-[#6b7280]">🔒 Cryptage AES-256. Vos coordonnées bancaires ne sont jamais stockées sur nos serveurs.</p>
                </form>
              )}

              {/* PayPal */}
              {payTab === 'paypal' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-xl bg-[#141524] border border-white/5">
                    <p className="font-semibold text-white text-sm mb-3">🅿️ Paiement manuel via PayPal</p>
                    <div className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs font-semibold">
                      ⚠️ Obligatoire : Sélectionner &quot;<strong>Biens et Services</strong>&quot; (Goods &amp; Services) lors de l&apos;envoi — jamais &quot;Entre proches&quot;.
                    </div>
                    <ol className="list-decimal list-inside space-y-2 text-xs text-[#9ca3af] font-light">
                      <li>Connectez-vous à votre compte PayPal.</li>
                      <li>Envoyez <strong className="text-white">{service.price.toFixed(2)}€</strong> à notre email PayPal en mode <strong className="text-white">&quot;Biens et Services&quot;</strong>.</li>
                      <li>Indiquez dans la note : <strong className="text-white">{email || 'votre email de livraison'}</strong>.</li>
                      <li>Vos accès seront activés sous 10–30 minutes après vérification du reçu.</li>
                    </ol>
                  </div>
                  <div className="p-4 rounded-xl bg-[#141524] border border-white/5 text-center">
                    <p className="text-xs text-[#9ca3af] mb-1">Adresse PayPal de réception</p>
                    <p className="font-bold text-white">paiement@streammalin.fr</p>
                  </div>
                  <p className="text-[10px] text-center text-[#6b7280]">🔒 Transaction couverte par la Protection des Achats PayPal (Biens &amp; Services uniquement).</p>
                </div>
              )}

              {/* Crypto */}
              {payTab === 'crypto' && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-white">Sélectionner la devise crypto :</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(CRYPTO_META) as CryptoCoin[]).map(coin => (
                      <button
                        key={coin}
                        onClick={() => setActiveCoin(coin)}
                        className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-bold transition-all ${
                          activeCoin === coin ? 'border-transparent scale-[1.04]' : 'border-white/10 bg-[#141524] text-[#9ca3af]'
                        }`}
                        style={activeCoin === coin ? { borderColor: CRYPTO_META[coin].color, background: `${CRYPTO_META[coin].color}20` } : {}}
                      >
                        <span className="text-2xl" style={{ color: CRYPTO_META[coin].color }}>{CRYPTO_META[coin].symbol}</span>
                        <span className="text-[10px]">{CRYPTO_META[coin].label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="p-5 rounded-xl bg-[#141524] border border-white/5 space-y-3">
                    <p className="text-xs text-[#9ca3af]">Veuillez effectuer le transfert vers l&apos;adresse publique suivante :</p>
                    <div className="p-3 bg-black/40 rounded-lg font-mono text-xs text-white break-all">
                      {cryptoAddr[activeCoin] || 'Adresse non configurée — contactez le support à paiement@streammalin.fr'}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold" style={{ color: CRYPTO_META[activeCoin].color }}>
                        Montant à envoyer : {(service.price * CRYPTO_RATES[activeCoin]).toFixed(cryptoPrecision(activeCoin))} {activeCoin.toUpperCase()}
                      </p>
                      {cryptoAddr[activeCoin] && (
                        <button onClick={() => copyAddr(cryptoAddr[activeCoin], activeCoin)} className="text-xs text-[#9ca3af] hover:text-white">
                          {copied === activeCoin ? '✅ Copié !' : '📋 Copier'}
                        </button>
                      )}
                    </div>
                    <div className="pt-2 border-t border-white/5 text-[10px] text-[#9ca3af]">
                      ⚠️ <strong className="text-white">IMPORTANT :</strong> Envoyez un e-mail à <strong className="text-white">paiement@streammalin.fr</strong> avec le TXID de votre transaction et votre email de livraison pour activer votre slot sous 1h.
                    </div>
                  </div>
                  <p className="text-[10px] text-center text-[#6b7280]">🔒 Le traitement blockchain nécessite généralement 1 à 3 validations réseau (~10 min).</p>
                </div>
              )}
            </div>

            {/* Récapitulatif */}
            <div className="md:col-span-5 glass-panel rounded-2xl p-6">
              <h3 className="text-lg font-extrabold text-white mb-5">📦 Récapitulatif</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0" style={{ background: service.gradient }}>
                  {service.icon}
                </div>
                <div>
                  <h4 className="font-extrabold text-white">{service.name}</h4>
                  <p className="text-xs text-[#9ca3af] font-light mt-0.5">Type : <strong>Accès Officiel</strong> (⭐ 5.0)</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-lg font-black text-white">{service.price.toFixed(2)}€</div>
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4 space-y-2.5 mb-5 border border-white/5">
                <div className="flex justify-between text-sm text-[#9ca3af]">
                  <span>Prix de l&apos;accès</span><span className="text-white font-medium">{service.price.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-sm text-[#9ca3af]">
                  <span>Frais d&apos;activation &amp; Garantie</span><span className="text-cyan-400 font-semibold">Gratuit</span>
                </div>
                <div className="flex justify-between text-sm text-cyan-400">
                  <span>Économie mensuelle estimée</span><span className="font-bold">{savings}€</span>
                </div>
                <div className="flex justify-between text-xs text-[#6b7280] border-t border-white/5 pt-2.5">
                  <span>Fréquence</span><span>Mensuelle, sans engagement</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-t border-b border-white/5 mb-5">
                <span className="font-bold text-white">Total par mois</span>
                <span className="text-xl font-black gradient-text">{service.price.toFixed(2)}€</span>
              </div>

              <div className="p-4 rounded-xl bg-cyan-400/5 border border-cyan-400/20">
                <p className="text-xs text-cyan-400 font-bold mb-1">🛡️ Garanties StreamMalin incluses :</p>
                <p className="text-xs text-[#9ca3af] font-light">Remplacement ou remboursement garanti sous 24 heures en cas de dysfonctionnement du compte.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
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
