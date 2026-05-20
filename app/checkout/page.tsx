'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  ArrowLeft,
  Mail,
  Lock,
  ExternalLink,
  Copy,
  CheckCircle,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface ServiceDetails {
  id: string;
  name: string;
  tagline: string;
  price: number;
  icon: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const serviceId = searchParams.get('service');
  const stockId = searchParams.get('stock');

  const [service, setService] = useState<ServiceDetails | null>(null);
  const [loadingService, setLoadingService] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('card'); // 'card', 'paypal', 'crypto'
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Crypto state
  const [copiedText, setCopiedText] = useState<string>('');

  useEffect(() => {
    if (serviceId) {
      fetchServiceDetails(serviceId);
    }
  }, [serviceId]);

  const fetchServiceDetails = async (id: string) => {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (data.success) {
        const found = data.services.find((s: any) => s.id === id);
        if (found) {
          setService({
            id: found.id,
            name: found.name,
            tagline: found.tagline,
            price: found.price,
            icon: found.icon,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load service details:', err);
    } finally {
      setLoadingService(false);
    }
  };

  const handleStripeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !serviceId || !stockId || isSubmitting) return;

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
        }),
      });

      const data = await res.json();
      if (data.success && data.url) {
        // Redirection vers la session de paiement Stripe (réelle ou simulée)
        window.location.href = data.url;
      } else {
        setErrorMsg(data.error || 'Erreur lors du traitement de la transaction.');
        setIsSubmitting(false);
      }
    } catch (err) {
      setErrorMsg('Erreur de communication avec le serveur Stripe.');
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(''), 2000);
  };

  if (loadingService) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-[#e5e7eb] flex items-center justify-center font-light">
        Initialisation du tunnel de paiement sécurisé...
      </div>
    );
  }

  if (!service || !stockId) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-[#e5e7eb] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Session de checkout expirée ou invalide</h2>
        <p className="text-sm text-[#9ca3af] max-w-sm mb-6 font-light">
          Le lien de paiement utilisé est erroné ou ce compte de stock n&apos;est plus disponible.
        </p>
        <a href="/" className="btn btn-primary gap-2">
          <ArrowLeft className="w-4 h-4" /> Retour à la boutique
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-[#9ca3af] hover:text-white mb-8 group transition-colors">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Retour à la boutique
        </a>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Checkout Steps Form */}
          <div className="md:col-span-7 glass-panel p-8 space-y-6">
            <h2 className="text-2xl font-extrabold text-white">Tunnel d&apos;achat</h2>
            
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: Client Email */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
                1. Votre adresse email de livraison
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="votre-email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#141524] border border-white/10 text-white placeholder-[#6b7280] focus:outline-none focus:border-purple-500 transition-all text-sm"
                  required
                />
                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-[#9ca3af]" />
              </div>
              <p className="text-[10px] text-[#9ca3af] font-light">
                C&apos;est sur cet email que vous recevrez vos identifiants d&apos;accès immédiats.
              </p>
            </div>

            {/* Step 2: Payment Selector */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
                2. Méthode de paiement
              </label>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'card', label: 'CB / Stripe', icon: '💳' },
                  { id: 'paypal', label: 'PayPal', icon: '🅿️' },
                  { id: 'crypto', label: 'Crypto', icon: '🪙' },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      paymentMethod === method.id
                        ? 'bg-purple-500/15 border-purple-500 text-white font-bold'
                        : 'bg-[#141524]/50 border-white/5 text-[#9ca3af] hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xl mb-1">{method.icon}</span>
                    <span className="text-[10px] tracking-wide uppercase">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Execution Panels */}
            <div className="pt-4 border-t border-white/5">
              {paymentMethod === 'card' && (
                <form onSubmit={handleStripeCheckout} className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs font-light text-[#9ca3af] leading-relaxed">
                    <p className="flex items-center gap-2 text-white font-semibold mb-1">
                      <CreditCard className="w-4 h-4 text-purple-400" /> Redirection sécurisée vers Stripe
                    </p>
                    Achetez en toute sécurité. Les données bancaires sont cryptées côté serveur par la passerelle internationale Stripe 3D Secure.
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !email}
                    className="w-full btn btn-primary py-3.5 rounded-xl font-bold uppercase tracking-wider text-sm disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" /> {isSubmitting ? 'Redirection...' : `Payer ${service.price.toFixed(2)}€ par CB`}
                  </button>
                </form>
              )}

              {paymentMethod === 'paypal' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#141524] border border-white/5 text-xs text-[#9ca3af] font-light leading-relaxed">
                    <p className="font-semibold text-white mb-2 flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4 text-blue-400" /> Paiement direct sans frais via paypal.me
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>Cliquez sur le bouton ci-dessous pour ouvrir notre lien PayPal.</li>
                      <li>Envoyez le montant exact de <strong className="text-white">{service.price.toFixed(2)}€</strong> en choisissant l&apos;option <strong className="text-white">&ldquo;Envoi entre proches&rdquo;</strong> (pour éviter les commissions).</li>
                      <li><strong>Indiquez votre adresse email ({email || 'saisie ci-dessus'}) dans la note</strong> du paiement pour que nous puissions générer vos accès.</li>
                    </ol>
                  </div>

                  <a
                    href={`https://paypal.me/streammalin/${service.price.toFixed(2)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full btn btn-outline py-3.5 rounded-xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 border-blue-500 hover:bg-blue-500/10 text-white"
                  >
                    Ouvrir paypal.me <ExternalLink className="w-4 h-4 text-blue-400" />
                  </a>

                  <p className="text-[9px] text-[#6b7280] text-center italic mt-2">
                    Vos accès seront configurés manuellement sous 10 à 30 minutes après vérification du reçu PayPal.
                  </p>
                </div>
              )}

              {paymentMethod === 'crypto' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#141524] border border-white/5 space-y-4 text-xs font-light text-[#9ca3af]">
                    <p className="font-semibold text-white flex items-center gap-2">
                      🪙 Cryptomonnaies acceptées
                    </p>
                    
                    {/* Bitcoin */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-yellow-500">
                        <span>Bitcoin (BTC)</span>
                        <button
                          onClick={() => copyToClipboard('bc1qxy2kg3ut5g43adrl7t2w49pq5t5w32j2hjxyz', 'btc')}
                          className="flex items-center gap-1 text-[#9ca3af] hover:text-white"
                        >
                          {copiedText === 'btc' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          Copier
                        </button>
                      </div>
                      <div className="p-2.5 bg-black/60 rounded border border-white/5 font-mono text-[10px] text-white break-all">
                        bc1qxy2kg3ut5g43adrl7t2w49pq5t5w32j2hjxyz
                      </div>
                    </div>

                    {/* USDT (TRC-20) */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-emerald-400">
                        <span>USDT (TRC20 / Tron Network)</span>
                        <button
                          onClick={() => copyToClipboard('TYG1h49k324gdhfjksldhfa9w384fhjkLd', 'usdt')}
                          className="flex items-center gap-1 text-[#9ca3af] hover:text-white"
                        >
                          {copiedText === 'usdt' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          Copier
                        </button>
                      </div>
                      <div className="p-2.5 bg-black/60 rounded border border-white/5 font-mono text-[10px] text-white break-all">
                        TYG1h49k324gdhfjksldhfa9w384fhjkLd
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 text-[10px] leading-relaxed text-[#9ca3af]">
                      ⚠️ <strong>IMPORTANT :</strong> Envoyez un e-mail à <strong className="text-white">paiement@streammalin.com</strong> avec le hachage (TXID) de votre transaction et l&apos;e-mail de livraison saisi pour activer votre slot sous 1h.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cart Summary Card */}
          <div className="md:col-span-5 space-y-4">
            <h3 className="text-lg font-bold text-white mb-2">Récapitulatif</h3>
            
            <div className="glass-panel p-6 space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{service.icon}</span>
                <div>
                  <h4 className="font-extrabold text-white text-base leading-tight">
                    {service.name}
                  </h4>
                  <p className="text-xs text-[#9ca3af] font-light mt-0.5">
                    {service.tagline}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-2 text-xs font-light text-[#9ca3af]">
                <div className="flex justify-between">
                  <span>Abonnement de stock :</span>
                  <span className="text-white font-medium">{service.price.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span>Frais de service :</span>
                  <span className="text-emerald-400 font-semibold uppercase tracking-wider">Gratuit</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-white/5 text-sm font-bold text-white">
                  <span>Total à payer :</span>
                  <span className="text-purple-400">{service.price.toFixed(2)}€ / mois</span>
                </div>
              </div>
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
      <div className="min-h-screen bg-[#0b0c10] text-[#e5e7eb] flex items-center justify-center font-light">
        Chargement du tunnel de paiement...
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
