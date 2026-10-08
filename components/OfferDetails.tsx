'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, CircleCheck, CirclePause, Headphones, RefreshCw } from 'lucide-react';
import ServiceMark from './ServiceMark';
import { formatEuro, hasAvailableOffer, prudentCommercialCopy } from '@/lib/offerPresentation';

interface Offer {
  id: string; name: string; tagline: string; features: string[]; price: number;
  availableSlots: number; availableStockId: string | null; eligibility: string; accessType: string;
  privacyNote: string; referenceVerified: boolean; referenceUrl: string | null; referenceCheckedAt: string | null;
}

interface StockChoice { id: string; serviceId: string; price: number; }

export default function OfferDetails({ id }: { id: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [stocks, setStocks] = useState<StockChoice[]>([]);
  const [stockId, setStockId] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/services', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/stocks/public', { cache: 'no-store', signal: controller.signal }),
    ]).then(async responses => { if (responses.some(response => !response.ok)) throw new Error(); return Promise.all(responses.map(response => response.json())); })
      .then(([catalog, inventory]) => {
        if (!catalog.success || !Array.isArray(catalog.services) || !inventory.success || !Array.isArray(inventory.stocks)) throw new Error();
        setOffer(catalog.services.find((item: Offer) => item.id === id && Number.isFinite(item.price) && item.price > 0) || null);
        setStocks(inventory.stocks.filter((item: StockChoice) => item.serviceId === id && Number.isFinite(item.price) && item.price > 0));
        setStatus('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [id]);
  if (status === 'loading') return <p role="status">Chargement de l’offre…</p>;
  if (status === 'error') return <div role="alert"><p>Les offres ne peuvent pas être chargées pour le moment.</p><button className="btn btn-ghost" onClick={() => window.location.reload()}><RefreshCw size={16} /> Réessayer</button></div>;
  if (!offer) return <div className="public-page-state"><h1>Offre indisponible</h1><p>Cette offre n’est pas disponible dans le catalogue actuel.</p><Link href="/#offres" className="btn btn-ghost"><ArrowLeft size={16} /> Retour aux offres</Link></div>;
  const selectedStock = stocks.find(stock => stock.id === stockId) || stocks.find(stock => stock.id === offer.availableStockId) || stocks[0];
  const available = hasAvailableOffer(offer) && Boolean(selectedStock);
  const price = available ? selectedStock!.price : offer.price;
  return <article className="offer-details">
    <div className="offer-detail-heading"><ServiceMark id={offer.id} name={offer.name} /><div><p className="public-eyebrow">LOCATION MENSUELLE</p><h1>{offer.name}</h1><p>{prudentCommercialCopy(offer.tagline)}</p></div></div>
    <div className="offer-detail-layout"><div>
      <section><h2>Votre accès</h2><p>{offer.accessType || 'Les modalités de cet accès sont en cours de vérification. Aucune commande n’est ouverte.'}</p><ul className="offer-detail-features">{offer.features.map((feature, index) => <li key={index}><Check size={17} aria-hidden="true" />{prudentCommercialCopy(feature)}</li>)}</ul></section>
      <section className="offer-detail-eligibility"><h2>Votre compte est-il éligible ?</h2><p>{offer.eligibility || 'Conditions d’éligibilité en cours de vérification. Aucune commande n’est ouverte.'}</p><Link href="/contact"><Headphones size={16} aria-hidden="true" /> Un doute ? Contactez-nous avant de payer.</Link></section>
      <section><h2>Renouvellement et résiliation</h2><p>Par carte bancaire : prélèvement mensuel automatique jusqu’à résiliation, sans durée minimale d’engagement. Demandez la résiliation depuis l’espace client avant la prochaine échéance ; elle prend effet à la fin de la période payée.</p><p>Les paiements manuels, lorsqu’ils sont proposés, couvrent un mois et nécessitent une vérification du paiement reçu.</p></section>
      <section><h2>Confidentialité et plateformes tierces</h2><p>{offer.privacyNote || 'Les informations éventuellement visibles par d’autres membres et les modalités de partage doivent être confirmées avant toute commande.'}</p><p>Les règles et la disponibilité du fournisseur tiers peuvent évoluer. StreamMalin est un service indépendant des plateformes citées. La non-affiliation ne constitue pas une autorisation de revente.</p></section>
      {offer.referenceVerified && offer.referenceUrl && offer.referenceCheckedAt && <p className="offer-reference">Tarif de comparaison vérifié le {new Date(offer.referenceCheckedAt).toLocaleDateString('fr-FR')} : <a href={offer.referenceUrl} target="_blank" rel="noopener noreferrer">source du fournisseur</a>. Les économies restent indicatives.</p>}
    </div><aside className="offer-detail-purchase" aria-label="Prix et disponibilité">
      <span className="offer-detail-status">{available ? <CircleCheck size={17} aria-hidden="true" /> : <CirclePause size={17} aria-hidden="true" />}{available ? 'Disponible actuellement' : 'Indisponible actuellement'}</span>
      <div className="offer-detail-price"><strong>{formatEuro(price)}</strong><span>/ mois</span></div><p>Pour un mois d’accès, selon les conditions de cette offre.</p>
      {available && stocks.length > 1 && <label className="offer-stock-choice" htmlFor="offer-stock">Accès disponibles<select id="offer-stock" value={selectedStock!.id} onChange={event => setStockId(event.target.value)}>{stocks.map((stock, index) => <option key={stock.id} value={stock.id}>Option {index + 1} — {formatEuro(stock.price)} / mois</option>)}</select></label>}
      {available ? <Link className="btn btn-primary" href={`/checkout?${new URLSearchParams({ service: offer.id, stock: selectedStock!.id })}`}>Choisir cette offre <ArrowRight size={16} aria-hidden="true" /></Link> : <><p>Aucune place disponible actuellement. Contactez-nous pour connaître les prochaines disponibilités.</p><Link className="btn btn-outline" href="/contact"><Headphones size={16} aria-hidden="true" /> Nous contacter</Link></>}
      <p className="offer-delivery-note">Accès transmis après validation de la commande et du paiement, selon disponibilité. Suivi et assistance en français.</p>
      <div className="offer-detail-legal"><Link href="/cgv">Conditions de vente</Link><Link href="/remboursements">Remboursements</Link><Link href="/retractation">Rétractation</Link></div>
    </aside></div>
  </article>;
}
