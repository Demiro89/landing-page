'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Mail, RefreshCw } from 'lucide-react';
import ServiceMark from './ServiceMark';
import { formatEuro, hasAvailableOffer, prudentCommercialCopy } from '@/lib/offerPresentation';

interface Offer {
  id: string; name: string; tagline: string; features: string[]; price: number;
  availableSlots: number; availableStockId: string | null; eligibility: string; accessType: string;
  privacyNote: string; referenceVerified: boolean; referenceUrl: string | null; referenceCheckedAt: string | null;
}

export default function OfferDetails({ id }: { id: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/services', { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!data.success) throw new Error(); setOffer(data.services.find((item: Offer) => item.id === id) || null); setStatus('ready'); })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [id]);
  if (status === 'loading') return <p role="status">Chargement de l’offre…</p>;
  if (status === 'error') return <div role="alert"><p>Les offres ne peuvent pas être chargées pour le moment.</p><button className="btn btn-ghost" onClick={() => window.location.reload()}><RefreshCw size={16} /> Réessayer</button></div>;
  if (!offer) return <div><p>Cette offre n’est pas disponible dans le catalogue actuel.</p><Link href="/#services" className="btn btn-ghost"><ArrowLeft size={16} /> Retour aux offres</Link></div>;
  const available = hasAvailableOffer(offer);
  return <div className="offer-details">
    <div className="offer-details-brand"><ServiceMark id={offer.id} name={offer.name} /><h2>{offer.name}</h2></div>
    <p>{prudentCommercialCopy(offer.tagline)}</p>
    <p><strong>{formatEuro(offer.price)}</strong> pour un mois d’accès. La carte bancaire implique un prélèvement mensuel automatique, résiliable avant la prochaine échéance depuis l’espace client.</p>
    <h2>Ce qui est proposé</h2><ul>{offer.features.map((feature, index) => <li key={index}>{prudentCommercialCopy(feature)}</li>)}</ul>
    <h2>Type d’accès</h2><p>{offer.accessType || 'Les modalités de cet accès sont en cours de vérification. Aucune commande n’est ouverte.'}</p>
    <h2>Conditions d’éligibilité</h2><p>{offer.eligibility}</p>
    <h2>Confidentialité de l’accès</h2><p>{offer.privacyNote || 'Les éventuelles informations visibles par les autres membres et les modalités de partage doivent être confirmées avant toute commande.'}</p>
    <p>Les règles et la disponibilité du fournisseur tiers peuvent évoluer. StreamMalin est un service indépendant des plateformes citées. La non-affiliation ne constitue pas une autorisation de revente.</p>
    {offer.referenceVerified && offer.referenceUrl && <p>Tarif de comparaison vérifié le {new Date(offer.referenceCheckedAt!).toLocaleDateString('fr-FR')} : <a href={offer.referenceUrl} target="_blank" rel="noopener noreferrer">source du fournisseur</a>. Les économies restent indicatives.</p>}
    {available ? <Link className="btn btn-primary" href={`/checkout?${new URLSearchParams({ service: offer.id, stock: offer.availableStockId! })}`}>Choisir cette offre <ArrowRight size={16} /></Link> : <div><p>Aucune place disponible actuellement. Contactez-nous pour connaître les prochaines disponibilités.</p><a className="btn btn-primary" href={`mailto:hello@streammalin.fr?${new URLSearchParams({ subject: `Disponibilité : ${offer.name}` })}`}><Mail size={16} /> Contacter le support</a></div>}
    <p><Link href="/cgv">Conditions de vente</Link> · <Link href="/remboursements">Remboursements</Link> · <Link href="/retractation">Rétractation</Link></p>
  </div>;
}
