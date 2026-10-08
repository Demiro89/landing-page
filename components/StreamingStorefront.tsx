'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronDown,
  FileText,
  Headphones,
  LayoutGrid,
  Music2,
  RefreshCw,
  Tv,
} from 'lucide-react';
import OfferCard from './OfferCard';
import Footer from './Footer';
import {
  canCompareOffer,
  formatEuro,
  hasAvailableOffer,
  streamingCategory,
} from '@/lib/offerPresentation';
import './streaming-storefront.css';

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

const questions = [
  [
    'Quel type d’accès vais-je recevoir ?',
    'Cela dépend de l’offre : invitation sur votre compte ou accès défini sur la fiche. Vérifiez le type d’accès, les fonctionnalités et la confidentialité avant de commander. StreamMalin est indépendant des plateformes citées.',
  ],
  [
    'Mon compte est-il compatible ?',
    'Le pays, le foyer, un groupe familial ou l’historique de votre compte peuvent limiter l’accès. Les conditions figurent sur chaque fiche. En cas de doute, contactez le support avant de payer.',
  ],
  [
    'Quand mon accès sera-t-il transmis ?',
    'Après validation de la commande et du paiement, selon disponibilité. Un paiement manuel doit être vérifié avant transmission. La confirmation et le suivi sont accessibles depuis votre espace client.',
  ],
  [
    'L’abonnement se renouvelle-t-il automatiquement ?',
    'Par carte bancaire, le prélèvement est mensuel et automatique jusqu’à résiliation. Vous pouvez demander la résiliation depuis l’espace client avant la prochaine échéance ; elle prend effet à la fin de la période payée. Les paiements manuels proposés couvrent un mois.',
  ],
  [
    'Que faire si l’accès ne fonctionne plus ?',
    'Contactez le support avec votre référence de commande. Nous analysons le dysfonctionnement et recherchons une solution selon les disponibilités et les CGV. Les règles des plateformes tierces peuvent évoluer.',
  ],
];

export default function StreamingStorefront({
  offers,
  loaded,
  error,
  retry,
}: {
  offers: Offer[];
  loaded: boolean;
  error: string;
  retry: () => void;
}) {
  const [category, setCategory] = useState<'all' | 'video' | 'music'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const streaming = offers.filter(
    (offer) => streamingCategory(offer.id) !== 'other',
  );
  const others = offers.filter(
    (offer) => streamingCategory(offer.id) === 'other',
  );
  const visible = streaming.filter(
    (offer) => category === 'all' || streamingCategory(offer.id) === category,
  );
  const comparable = streaming.filter(canCompareOffer);
  // A stale selection never survives an availability or reference-price update.
  const comparison = comparable.filter((offer) => selected.includes(offer.id));
  const total = comparison.reduce((sum, offer) => sum + offer.price, 0);
  const reference = comparison.reduce((sum, offer) => sum + offer.original, 0);
  const available = streaming.some(hasAvailableOffer);

  return (
    <main className="streaming-storefront">
      <section className="stream-hero">
        <Image
          src="/images/streaming-hero.webp"
          alt="Téléviseur avec un paysage de montagne, casque audio et télécommande"
          fill
          sizes="100vw"
          preload
          className="stream-hero-image"
        />
        <div className="stream-container stream-hero-content">
          <p className="stream-eyebrow">LOCATION D’ABONNEMENTS STREAMING</p>
          <h1>StreamMalin</h1>
          <p className="stream-hero-copy">
            Vos films, séries et musique.
            <br />
            Une offre adaptée à votre compte.
          </p>
          <a className="btn btn-primary" href="#offres">
            Voir les abonnements <ArrowRight size={17} aria-hidden="true" />
          </a>
          <p className="stream-hero-note">
            Prix mensuels · Conditions précisées pour chaque accès
          </p>
        </div>
      </section>

      <div className="stream-reassurance">
        <div className="stream-container">
          <span>
            <FileText size={17} aria-hidden="true" /> Conditions avant paiement
          </span>
          <span>
            <Headphones size={17} aria-hidden="true" /> Assistance en français
          </span>
          <Link href="/non-affiliation">
            Service indépendant des plateformes{' '}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <section
        id="offres"
        className="stream-section stream-container"
        aria-labelledby="catalog-title"
      >
        <div className="stream-section-head">
          <div>
            <p className="stream-eyebrow">LE CATALOGUE</p>
            <h2 id="catalog-title">Choisissez votre abonnement</h2>
            <p>
              Vidéo ou musique : comparez les prix et vérifiez les conditions de
              votre compte.
            </p>
          </div>
          <Link href="/contact" className="stream-help">
            <Headphones size={17} aria-hidden="true" /> Une question avant de
            choisir ?
          </Link>
        </div>
        <div
          className="stream-filters"
          role="group"
          aria-label="Catégorie d’abonnement"
        >
          {(
            [
              { id: 'all', label: 'Tous', Icon: LayoutGrid },
              { id: 'video', label: 'Films & séries', Icon: Tv },
              { id: 'music', label: 'Musique', Icon: Music2 },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {!loaded ? (
          <p role="status" className="stream-state">
            Chargement des abonnements et des disponibilités…
          </p>
        ) : error ? (
          <div role="alert" className="stream-state">
            <h3>Le catalogue est momentanément indisponible</h3>
            <p>{error}</p>
            <button className="btn btn-outline" onClick={retry}>
              <RefreshCw size={16} aria-hidden="true" /> Réessayer
            </button>
          </div>
        ) : (
          <>
            {!available && (
              <div className="stream-stock-note" role="status">
                <Tv size={22} aria-hidden="true" />
                <div>
                  <strong>Aucune place disponible actuellement.</strong>
                  <p>
                    Contactez-nous pour connaître les prochaines disponibilités.
                  </p>
                </div>
                <Link href="/contact">
                  Nous contacter <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            )}
            {visible.length > 0 ? (
              <div className="stream-offer-grid">
                {visible.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>
            ) : available ? (
              <p className="stream-state">
                Aucune offre dans cette catégorie actuellement.
              </p>
            ) : null}
            {others.length > 0 && (
              <details className="stream-other">
                <summary>
                  Autres services numériques <span>{others.length}</span>
                  <ChevronDown size={17} aria-hidden="true" />
                </summary>
                <div className="stream-offer-grid">
                  {others.map((offer) => (
                    <OfferCard key={offer.id} offer={offer} />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
        <p className="stream-catalog-note">
          Les accès dépendent des règles et de la disponibilité des plateformes.
          Le type d’accès et les restrictions sont indiqués sur la fiche de
          chaque offre.
        </p>
      </section>

      <section id="comment" className="stream-process">
        <div className="stream-container">
          <p className="stream-eyebrow">VOTRE LOCATION</p>
          <h2>Du choix au suivi de votre accès</h2>
          <ol className="stream-steps">
            <li>
              <span>01</span>
              <h3>Vérifiez votre offre</h3>
              <p>
                Consultez le type d’accès, le prix et l’éligibilité de votre
                compte.
              </p>
            </li>
            <li>
              <span>02</span>
              <h3>Validez votre commande</h3>
              <p>
                Choisissez votre paiement et confirmez les conditions
                applicables.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>Retrouvez votre suivi</h3>
              <p>
                Accès transmis après validation, assistance et gestion dans
                l’espace client.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section id="calculateur" className="stream-section stream-container">
        <details className="stream-calculator">
          <summary>
            <Calculator size={19} aria-hidden="true" />
            <h2>Estimer vos économies</h2>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <p>
            Comparaison avec les tarifs publics vérifiés pour des offres
            équivalentes. Les montants restent indicatifs.
          </p>
          <div className="stream-calculator-options">
            {comparable.map((offer) => (
              <label key={offer.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(offer.id)}
                  onChange={(event) =>
                    setSelected((ids) =>
                      event.target.checked
                        ? [...ids, offer.id]
                        : ids.filter((id) => id !== offer.id),
                    )
                  }
                />
                {offer.name}
              </label>
            ))}
          </div>
          {comparison.length === 0 ? (
            <p role="status">
              Sélectionnez une offre pour calculer vos économies.
            </p>
          ) : (
            <dl className="stream-calculator-result">
              <div>
                <dt>Tarif public / mois</dt>
                <dd>{formatEuro(reference)}</dd>
              </div>
              <div>
                <dt>StreamMalin / mois</dt>
                <dd>{formatEuro(total)}</dd>
              </div>
              <div>
                <dt>Économie estimée / mois</dt>
                <dd>{formatEuro(reference - total)}</dd>
              </div>
            </dl>
          )}
          {comparable.length === 0 && (
            <p>
              Aucune offre disponible avec un tarif de comparaison vérifié pour
              le moment.
            </p>
          )}
        </details>
      </section>

      <section
        id="faq"
        className="stream-section stream-container"
        aria-labelledby="faq-title"
      >
        <div className="stream-faq-layout">
          <div>
            <p className="stream-eyebrow">AVANT DE COMMANDER</p>
            <h2 id="faq-title">Les réponses utiles</h2>
            <p>Un doute sur votre compte ou votre accès ?</p>
            <Link className="stream-help" href="/contact">
              Contacter le support <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div>
            {questions.map(([question, answer]) => (
              <details className="stream-faq-item" key={question}>
                <summary>
                  {question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <div className="stream-support-band">
        <div className="stream-container">
          <Check size={23} aria-hidden="true" />
          <div>
            <h2>Choisissez en connaissance de cause</h2>
            <p>
              Éligibilité, renouvellement, confidentialité : le support peut
              vous aider avant la commande.
            </p>
          </div>
          <Link className="btn btn-outline" href="/contact">
            Poser une question <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
