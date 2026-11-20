import Link from 'next/link';
import { ArrowRight, Check, KeyRound } from 'lucide-react';
import ServiceMark from './ServiceMark';
import { canCompareOffer, formatEuro, hasAvailableOffer, prudentCommercialCopy } from '@/lib/offerPresentation';
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
  accessType?: string;
}

export default function OfferCard({ offer }: { offer: Offer }) {
  const hasStock = hasAvailableOffer(offer);
  const showReference = canCompareOffer(offer) && offer.original > offer.price;
  const discountPct = showReference ? Math.round(((offer.original - offer.price) / offer.original) * 100) : 0;
  const detailsUrl = `/offres/${encodeURIComponent(offer.id)}`;
  const accessNote = offer.accessType?.trim() ? prudentCommercialCopy(offer.accessType.trim()) : '';

  return (
    <article className="offer-card" data-service={offer.id.split('-')[0]} data-available={hasStock} aria-labelledby={`offer-${offer.id}`}>
      <div className="offer-card-top">
        <ServiceMark id={offer.id} name={offer.name} />
        <div className="offer-identity">
          <h3 id={`offer-${offer.id}`}>{offer.name}</h3>
          <p className="offer-tagline">{prudentCommercialCopy(offer.tagline)}</p>
        </div>
      </div>

      <div className="offer-price-row">
        {hasStock && <p className="offer-price"><strong>{formatEuro(offer.price)}</strong><span>/ mois</span></p>}
        <span className={`offer-availability ${hasStock ? 'available' : ''}`}>
          {hasStock ? `${offer.availableSlots} place${offer.availableSlots > 1 ? 's' : ''} dispo.` : 'Indisponible'}
        </span>
      </div>

      {showReference && (
        <p className="offer-reference-row">
          <span>Tarif public vérifié : <s>{formatEuro(offer.original)}</s></span>
          {discountPct >= 1 && <span className="offer-discount-badge">-{discountPct} %</span>}
        </p>
      )}

      {accessNote && (
        <p className="offer-access-note">
          <KeyRound size={13} aria-hidden="true" />
          <span>{accessNote}</span>
        </p>
      )}

      {offer.features.length > 0 && (
        <ul className="offer-features">
          {offer.features.slice(0, 3).map((feature, index) => (
            <li key={index}><Check size={14} aria-hidden="true" /><span>{prudentCommercialCopy(feature)}</span></li>
          ))}
        </ul>
      )}

      {hasStock ? (
        <Link href={detailsUrl} className="btn btn-primary offer-action" aria-label={`Voir l’offre ${offer.name}`}>
          Voir cette offre <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <Link className="offer-contact" href={detailsUrl} aria-label={`Détails et disponibilités pour ${offer.name}`}>
          Voir les conditions <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}
