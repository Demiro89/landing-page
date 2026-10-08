import { ArrowRight, Check, CircleCheck, CirclePause } from 'lucide-react';
import ServiceMark from './ServiceMark';
import { formatEuro, hasAvailableOffer, prudentCommercialCopy } from '@/lib/offerPresentation';
import './offer-card.css';

interface Offer {
  id: string;
  name: string;
  tagline: string;
  price: number;
  original: number;
  features: string[];
  availableSlots: number;
  availableStockId: string | null;
  referenceVerified?: boolean;
  eligibility?: string;
}

export default function OfferCard({ offer }: { offer: Offer }) {
  const hasStock = hasAvailableOffer(offer);
  const savings = Math.max(0, offer.original - offer.price);
  const detailsUrl = `/offres/${encodeURIComponent(offer.id)}`;

  return (
    <article className="offer-card" aria-labelledby={`offer-${offer.id}`}>
      <div className="offer-card-top">
        <ServiceMark id={offer.id} name={offer.name} />
        <span className={`offer-availability ${hasStock ? 'available' : ''}`}>
          {hasStock ? <CircleCheck size={14} aria-hidden="true" /> : <CirclePause size={14} aria-hidden="true" />}
          {hasStock ? `${offer.availableSlots} place${offer.availableSlots > 1 ? 's' : ''}` : 'Indisponible'}
        </span>
      </div>
      <h3 id={`offer-${offer.id}`}>{offer.name}</h3>
      <p className="offer-tagline">{prudentCommercialCopy(offer.tagline)}</p>
      <div className="offer-price"><strong>{formatEuro(offer.price)}</strong><span>/ mois</span></div>
      {offer.referenceVerified && <p className="offer-public-price">Tarif public de référence : <span>{formatEuro(offer.original)}</span></p>}
      {hasStock && offer.referenceVerified && savings > 0 && <p className="offer-savings">{formatEuro(savings)} d’économie estimée / mois</p>}
      <ul className="offer-features">
        {offer.features.slice(0, 3).map((feature, index) => <li key={index}><Check size={15} aria-hidden="true" /><span>{prudentCommercialCopy(feature)}</span></li>)}
      </ul>
      {offer.eligibility && <p className="offer-eligibility">{offer.eligibility}</p>}
      <p className="offer-billing-note">Renouvellement et type d’accès précisés sur la fiche.</p>
      {hasStock ? (
        <a href={detailsUrl} className="btn btn-primary offer-action" aria-label={`Voir l’offre ${offer.name}`}>
          Voir cette offre <ArrowRight size={16} aria-hidden="true" />
        </a>
      ) : <><button disabled className="btn offer-action offer-action-disabled">Aucune place disponible</button><a className="offer-contact" href={detailsUrl}>Détails et disponibilités <ArrowRight size={14} aria-hidden="true" /></a></>}
    </article>
  );
}
