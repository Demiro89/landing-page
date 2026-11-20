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
      <div className="offer-card-header">
        <div className="offer-card-top">
          <ServiceMark id={offer.id} name={offer.name} />
          <div className="offer-identity">
            <h3 id={`offer-${offer.id}`}>{offer.name}</h3>
            <p className="offer-tagline">{prudentCommercialCopy(offer.tagline)}</p>
          </div>
        </div>

        <div className="offer-card-right">
          {hasStock ? (
            <p className="offer-price">
              <strong>{formatEuro(offer.price)}</strong>
              <span>/ mois</span>
            </p>
          ) : (
            <span className="offer-availability">Complet</span>
          )}
        </div>
      </div>

      {hasStock && (
        <div className="offer-meta-row">
          <span className="offer-availability available">
            {offer.availableSlots} place{offer.availableSlots > 1 ? 's' : ''} disponible{offer.availableSlots > 1 ? 's' : ''}
          </span>
          {showReference && (
            <p className="offer-reference-row">
              <span>Tarif public vérifié : <s>{formatEuro(offer.original)}</s></span>
              {discountPct >= 1 && <span className="offer-discount-badge">-{discountPct} %</span>}
            </p>
          )}
        </div>
      )}

      {accessNote && (
        <p className="offer-access-note">
          <KeyRound size={14} aria-hidden="true" />
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
          <span>Voir cette offre</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <Link className="offer-contact" href={detailsUrl} aria-label={`Détails et disponibilités pour ${offer.name}`}>
          <span>Voir les conditions</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}
