'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  CirclePause,
  Headphones,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import ServiceMark from './ServiceMark';
import {
  formatEuro,
  hasAvailableOffer,
  prudentCommercialCopy,
} from '@/lib/offerPresentation';

interface Offer {
  id: string;
  name: string;
  tagline: string;
  features: string[];
  price: number;
  availableSlots: number;
  availableStockId: string | null;
  eligibility: string;
  accessType: string;
  privacyNote: string;
  referenceVerified: boolean;
  referenceUrl: string | null;
  referenceCheckedAt: string | null;
}

interface StockChoice {
  id: string;
  serviceId: string;
  price: number;
}

export default function OfferDetails({ id }: { id: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [stocks, setStocks] = useState<StockChoice[]>([]);
  const [stockId, setStockId] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/services', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/stocks/public', {
        cache: 'no-store',
        signal: controller.signal,
      }),
    ])
      .then(async (responses) => {
        if (responses.some((response) => !response.ok)) throw new Error();
        return Promise.all(responses.map((response) => response.json()));
      })
      .then(([catalog, inventory]) => {
        if (
          !catalog.success ||
          !Array.isArray(catalog.services) ||
          !inventory.success ||
          !Array.isArray(inventory.stocks)
        )
          throw new Error();
        setOffer(
          catalog.services.find(
            (item: Offer) =>
              item.id === id && Number.isFinite(item.price) && item.price > 0,
          ) || null,
        );
        setStocks(
          inventory.stocks
            .filter(
              (item: StockChoice) =>
                item.serviceId === id &&
                Number.isFinite(item.price) &&
                item.price > 0,
            )
            .sort((a: StockChoice, b: StockChoice) => a.price - b.price),
        );
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [id]);
  if (status === 'loading') return <p role="status" className="public-page-state">Chargement de l’offre…</p>;
  if (status === 'error')
    return (
      <div role="alert" className="public-page-state">
        <p>Les offres ne peuvent pas être chargées pour le moment.</p>
        <button
          className="btn btn-ghost"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={16} /> Réessayer
        </button>
      </div>
    );
  if (!offer)
    return (
      <div className="public-page-state">
        <h1>Offre indisponible</h1>
        <p>Cette offre n’est pas disponible dans le catalogue actuel.</p>
        <Link href="/#offres" className="btn btn-ghost">
          <ArrowLeft size={16} /> Retour aux offres
        </Link>
      </div>
    );
  const selectedStock =
    stocks.find((stock) => stock.id === stockId) ||
    stocks[0] ||
    stocks.find((stock) => stock.id === offer.availableStockId);
  const available = hasAvailableOffer(offer) && Boolean(selectedStock);
  const price = available ? selectedStock!.price : offer.price;
  return (
    <article className="offer-details">
      <div className="offer-detail-heading">
        <ServiceMark id={offer.id} name={offer.name} />
        <div>
          <p className="public-eyebrow">LOCATION MENSUELLE</p>
          <h1>{offer.name}</h1>
          <p>{prudentCommercialCopy(offer.tagline)}</p>
        </div>
      </div>

      <div className="offer-highlights">
        <div className={`offer-highlight-item ${available ? 'is-available' : ''}`}>
          {available ? <CircleCheck size={16} aria-hidden="true" /> : <CirclePause size={16} aria-hidden="true" />}
          <span>{available ? `${offer.availableSlots} place${offer.availableSlots > 1 ? 's' : ''} disponible${offer.availableSlots > 1 ? 's' : ''}` : 'Actuellement épuisé'}</span>
        </div>
        <div className="offer-highlight-item">
          <RefreshCw size={16} aria-hidden="true" />
          <span>Sans engagement · résiliable avant échéance</span>
        </div>
        <div className="offer-highlight-item">
          <Headphones size={16} aria-hidden="true" />
          <span>Suivi et support en français</span>
        </div>
      </div>

      <div className="offer-detail-layout">
        <div className="offer-detail-cards">
          <section className="offer-detail-card">
            <h2 className="offer-section-head">
              <KeyRound size={18} aria-hidden="true" /> Votre accès
            </h2>
            <p>
              {offer.accessType ||
                'Les modalités de cet accès sont en cours de vérification. Aucune commande n’est ouverte.'}
            </p>
            <ul className="offer-detail-features">
              {offer.features.map((feature, index) => (
                <li key={index}>
                  <Check size={17} aria-hidden="true" />
                  <span>{prudentCommercialCopy(feature)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="offer-detail-card offer-detail-eligibility">
            <h2 className="offer-section-head">
              <ShieldCheck size={18} aria-hidden="true" /> Votre compte est-il éligible ?
            </h2>
            <p>
              {offer.eligibility ||
                'Conditions d’éligibilité en cours de vérification. Aucune commande n’est ouverte.'}
            </p>
            <Link href="/contact">
              <Headphones size={16} aria-hidden="true" /> Un doute ?
              Contactez-nous avant de payer.
            </Link>
          </section>
          <section className="offer-detail-card">
            <h2 className="offer-section-head">
              <RefreshCw size={18} aria-hidden="true" /> Renouvellement et résiliation
            </h2>
            <p>
              Par carte bancaire : prélèvement mensuel automatique jusqu’à
              résiliation, sans durée minimale d’engagement. Demandez la
              résiliation depuis l’espace client avant la prochaine échéance ;
              elle prend effet à la fin de la période payée.
            </p>
            <p>
              Les paiements manuels, lorsqu’ils sont proposés, couvrent un mois
              et nécessitent une vérification du paiement reçu.
            </p>
          </section>
          <section className="offer-detail-card">
            <h2 className="offer-section-head">
              <LockKeyhole size={18} aria-hidden="true" /> Confidentialité et plateformes tierces
            </h2>
            <p>
              {offer.privacyNote ||
                'Les informations éventuellement visibles par d’autres membres et les modalités de partage doivent être confirmées avant toute commande.'}
            </p>
            <p>
              Les règles et la disponibilité du fournisseur tiers peuvent
              évoluer. StreamMalin est un service indépendant des plateformes
              citées. La non-affiliation ne constitue pas une autorisation de
              revente.
            </p>
          </section>
          {offer.referenceVerified &&
            offer.referenceUrl &&
            offer.referenceCheckedAt && (
              <p className="offer-reference">
                Tarif de comparaison vérifié le{' '}
                {new Date(offer.referenceCheckedAt).toLocaleDateString('fr-FR')}{' '}
                :{' '}
                <a
                  href={offer.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  source du fournisseur
                </a>
                . Les économies restent indicatives.
              </p>
            )}
        </div>
        <aside
          className="offer-detail-purchase"
          aria-label="Prix et disponibilité"
        >
          <span className={`offer-detail-status ${available ? 'is-available' : ''}`}>
            {available ? (
              <CircleCheck size={16} aria-hidden="true" />
            ) : (
              <CirclePause size={16} aria-hidden="true" />
            )}
            {available
              ? 'Disponible actuellement'
              : 'Indisponible actuellement'}
          </span>
          <div className="offer-detail-price">
            <strong>{formatEuro(price)}</strong>
            <span>/ mois</span>
          </div>
          <p>
            {available
              ? 'Par carte bancaire : prélèvement mensuel automatique, résiliable à tout moment avant l’échéance.'
              : 'Tarif indicatif hors stock. Aucune place n’est ouverte à la commande pour le moment.'}
          </p>
          {available && stocks.length > 1 && (
            <fieldset className="offer-stock-options">
              <legend>Accès disponibles</legend>
              {stocks.map((stock, index) => {
                const isSelected = selectedStock!.id === stock.id;
                return (
                  <label
                    key={stock.id}
                    className={`offer-stock-option ${isSelected ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="offer-stock"
                      value={stock.id}
                      checked={isSelected}
                      onChange={() => setStockId(stock.id)}
                    />
                    <span className="offer-stock-option-meta">
                      <strong>Accès {index + 1}</strong>
                      {index === 0 && <em className="offer-stock-best">Tarif le plus bas</em>}
                    </span>
                    <span className="offer-stock-option-price">{formatEuro(stock.price)} / mois</span>
                  </label>
                );
              })}
            </fieldset>
          )}
          {available ? (
            <Link
              className="btn btn-primary"
              href={`/checkout?${new URLSearchParams({ service: offer.id, stock: selectedStock!.id })}`}
            >
              Choisir cette offre <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <>
              <p>
                Aucune place disponible actuellement. Contactez-nous pour
                connaître les prochaines disponibilités.
              </p>
              <Link className="btn btn-outline" href="/contact">
                <Headphones size={16} aria-hidden="true" /> Nous contacter
              </Link>
            </>
          )}
          <p className="offer-delivery-note">
            Accès transmis après validation de la commande et du paiement, selon
            disponibilité. Suivi et assistance en français.
          </p>
          <div className="offer-detail-legal">
            <Link href="/cgv">Conditions de vente</Link>
            <Link href="/remboursements">Remboursements</Link>
            <Link href="/retractation">Rétractation</Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
