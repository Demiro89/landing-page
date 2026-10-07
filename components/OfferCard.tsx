import { ArrowRight, Check, CircleCheck, CirclePause, FileText } from 'lucide-react';
import ServiceMark from './ServiceMark';
import { formatEuro, hasAvailableOffer, prudentCommercialCopy } from '@/lib/offerPresentation';

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
  const checkoutUrl = `/checkout?${new URLSearchParams({ service: offer.id, stock: offer.availableStockId || '' })}`;

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
      {offer.referenceVerified && savings > 0 && <p className="offer-savings">{formatEuro(savings)} d’économie estimée / mois</p>}
      <ul className="offer-features">
        {offer.features.map((feature, index) => <li key={index}><Check size={15} aria-hidden="true" /><span>{prudentCommercialCopy(feature)}</span></li>)}
      </ul>
      {offer.eligibility && <p className="offer-eligibility">{offer.eligibility}</p>}
      <div className="offer-conditions"><FileText size={14} aria-hidden="true" /><a href={`/offres/${encodeURIComponent(offer.id)}`}>Détails et éligibilité</a></div>
      {hasStock ? (
        <a href={checkoutUrl} className="btn btn-primary offer-action" aria-label={`Choisir ${offer.name}`}>
          Choisir cette offre <ArrowRight size={16} aria-hidden="true" />
        </a>
      ) : <><button disabled className="btn offer-action offer-action-disabled">Aucune place disponible</button><a className="offer-contact" href={`mailto:hello@streammalin.fr?subject=${encodeURIComponent(`Disponibilité : ${offer.name}`)}`}>Me renseigner sur cette offre <ArrowRight size={14} aria-hidden="true" /></a></>}
    </article>
  );
}
