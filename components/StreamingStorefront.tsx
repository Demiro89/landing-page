'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Calculator,
  ChevronDown,
  CreditCard,
  FileText,
  Headphones,
  Layers,
  LayoutGrid,
  Music2,
  RefreshCw,
  ShieldCheck,
  Tv,
  UserRound,
} from 'lucide-react';
import OfferCard from './OfferCard';
import Footer from './Footer';
import ServiceMark from './ServiceMark';
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
  accessType?: string;
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
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const streaming = offers.filter(
    (offer) => streamingCategory(offer.id) !== 'other',
  );
  const others = offers.filter(
    (offer) => streamingCategory(offer.id) === 'other',
  );
  const categoryOffers = streaming.filter(
    (offer) => category === 'all' || streamingCategory(offer.id) === category,
  );
  const visible = inStockOnly ? categoryOffers.filter(hasAvailableOffer) : categoryOffers;
  const comparable = streaming.filter(canCompareOffer);
  // A stale selection never survives an availability or reference-price update.
  const comparison = comparable.filter((offer) => selected.includes(offer.id));
  const total = comparison.reduce((sum, offer) => sum + offer.price, 0);
  const reference = comparison.reduce((sum, offer) => sum + offer.original, 0);
  const monthlySavings = Math.max(0, reference - total);
  const available = streaming.some(hasAvailableOffer);

  return (
    <>
    <main className="streaming-storefront">
      <section className="stream-hero">
        <Image
          src="/images/streammalin-cinema.webp"
          alt=""
          fill
          sizes="100vw"
          preload
          className="stream-hero-image"
        />
        <div className="stream-container stream-hero-content">
          <p className="stream-eyebrow">Films, séries &amp; musique</p>
          <h1>Vos abonnements <br className="stream-hero-break" />streaming.</h1>
          <p className="stream-hero-copy">
            Louez un accès au mois à tarif clair. Consultez les disponibilités en direct, les modalités d’accès et résiliez quand vous le souhaitez.
          </p>
          <div className="stream-hero-actions">
            <a className="btn btn-primary" href="#offres">
              Voir les abonnements <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="btn stream-hero-secondary" href="#comment">
              Comment ça marche
            </a>
          </div>
        </div>
      </section>

      <div className="stream-reassurance">
        <div className="stream-container stream-reassurance-grid">
          <Link href="/cgv">
            <span className="stream-reassurance-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
            <span>Sans engagement · résiliable avant échéance</span>
          </Link>
          <Link href="/contact">
            <span className="stream-reassurance-icon"><Headphones size={17} aria-hidden="true" /></span>
            <span>Support réactif en français</span>
          </Link>
          <Link href="/non-affiliation">
            <span className="stream-reassurance-icon"><Layers size={17} aria-hidden="true" /></span>
            <span>Service indépendant des plateformes</span>
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
            <h2 id="catalog-title">Les abonnements</h2>
            <p>Prix mensuels et disponibilités par plateforme.</p>
          </div>
          <a href="#calculateur" className="stream-help"><Calculator size={17} aria-hidden="true" /> Estimer mes économies</a>
        </div>
        {loaded && !error && streaming.length > 0 && (
          <div className="stream-toolbar">
            <div className="stream-filters" role="group" aria-label="Catégorie d’abonnement">
              {([
                { id: 'all', label: 'Tous', Icon: LayoutGrid },
                { id: 'video', label: 'Films & séries', Icon: Tv },
                { id: 'music', label: 'Musique', Icon: Music2 },
              ] as const).map(({ id, label, Icon }) => (
                <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)}>
                  <Icon size={16} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
            <div className="stream-toolbar-actions">
              <span className="stream-count" role="status">{visible.length} offre{visible.length > 1 ? 's' : ''}</span>
              <label className="stream-stock-filter">
                <input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} />
                En stock uniquement
              </label>
            </div>
          </div>
        )}
        {!loaded ? (
          <>
            <p role="status" className="sr-only">
              Chargement des abonnements et des disponibilités…
            </p>
            <div className="stream-offer-grid" aria-hidden="true">
              {[0, 1, 2].map((item) => (
                <div key={item} className="offer-skeleton">
                  <div className="offer-skeleton-head">
                    <span className="offer-skeleton-mark" />
                    <div className="offer-skeleton-lines">
                      <span className="offer-skeleton-line wide" />
                      <span className="offer-skeleton-line medium" />
                    </div>
                  </div>
                  <span className="offer-skeleton-price" />
                  <span className="offer-skeleton-line wide" />
                  <span className="offer-skeleton-line short" />
                  <span className="offer-skeleton-btn" />
                </div>
              ))}
            </div>
          </>
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
            {!available && !(inStockOnly && categoryOffers.length > 0) && (
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
            ) : inStockOnly && categoryOffers.length > 0 ? (
              <div className="stream-state">
                <h3>Aucune place disponible actuellement.</h3>
                <p>Vous pouvez consulter les détails des offres de cette catégorie.</p>
                <button type="button" className="btn btn-outline" onClick={() => setInStockOnly(false)}>
                  Afficher aussi les offres épuisées
                </button>
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
          <div className="stream-section-head">
            <div>
              <h2>Comment ça marche</h2>
              <p>Un parcours clair en trois étapes, sans surprise sur le renouvellement.</p>
            </div>
          </div>
          <ol className="stream-steps">
            <li>
              <div className="stream-step-head">
                <span className="stream-step-num">01</span>
                <span className="stream-step-icon"><FileText size={20} aria-hidden="true" /></span>
              </div>
              <h3>Vérifiez votre offre</h3>
              <p>
                Consultez le type d’accès, le prix et l’éligibilité de votre
                compte avant de commander.
              </p>
            </li>
            <li>
              <div className="stream-step-head">
                <span className="stream-step-num">02</span>
                <span className="stream-step-icon"><CreditCard size={20} aria-hidden="true" /></span>
              </div>
              <h3>Validez votre commande</h3>
              <p>
                Choisissez votre paiement et confirmez les conditions
                applicables.
              </p>
            </li>
            <li>
              <div className="stream-step-head">
                <span className="stream-step-num">03</span>
                <span className="stream-step-icon"><UserRound size={20} aria-hidden="true" /></span>
              </div>
              <h3>Retrouvez votre suivi</h3>
              <p>
                Accès transmis après validation, assistance et gestion dans
                l’espace client.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section id="calculateur" className="stream-section stream-container" aria-labelledby="simulator-title">
        <div className="stream-calculator">
          <div>
            <h2 id="simulator-title">Estimer vos économies</h2>
            <p>Comparez les offres disponibles avec leurs tarifs publics de référence vérifiés.</p>
            <div className="stream-calculator-options" role="group" aria-label="Offres à comparer">
              {comparable.map((offer) => (
                <label key={offer.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(offer.id)}
                    onChange={(event) =>
                      setSelected((ids) =>
                        event.target.checked ? [...ids, offer.id] : ids.filter((id) => id !== offer.id),
                      )
                    }
                  />
                  <ServiceMark id={offer.id} name={offer.name} />
                  <span>{offer.name}</span>
                  <strong>{formatEuro(offer.price)} <small>/ mois</small></strong>
                </label>
              ))}
            </div>
          </div>
          <div className="stream-calculator-summary" aria-live="polite" aria-atomic="true">
            <h3>Économie estimée par mois</h3>
            {comparison.length === 0 ? (
              <>
                <p className="stream-calculator-empty">Sélectionnez une ou plusieurs offres ci-contre pour comparer avec leur tarif public de référence vérifié.</p>
                {loaded && comparable.length === 0 && <p className="stream-calculator-empty">Aucune offre comparable disponible pour le moment.</p>}
              </>
            ) : (
              <>
                <p className="stream-calculator-saving">{formatEuro(monthlySavings)}</p>
                <p className="stream-calculator-annual">Soit {formatEuro(monthlySavings * 12)} estimés sur 12 mois</p>
                <dl className="stream-calculator-result">
                  <div><dt>Tarif public vérifié / mois</dt><dd>{formatEuro(reference)}</dd></div>
                  <div><dt>StreamMalin / mois</dt><dd>{formatEuro(total)}</dd></div>
                </dl>
                <a href="#offres" className="btn stream-calculator-cta">
                  Voir les offres <ArrowRight size={16} aria-hidden="true" />
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="stream-section stream-container"
        aria-labelledby="faq-title"
      >
        <div className="stream-faq-layout">
          <div>
            <h2 id="faq-title">Questions fréquentes</h2>
            <p className="stream-faq-intro">Les réponses essentielles sur l’accès, le paiement et la résiliation.</p>
            <Link className="stream-help" href="/contact">
              Contacter le support <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="stream-faq-list">
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
    </main>
    <Footer />
    </>
  );
}
