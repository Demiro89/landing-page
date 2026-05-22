/**
 * Configuration légale & commerciale centralisée de StreamMalin.
 *
 * ⚠️ Les valeurs entre crochets [À COMPLÉTER] doivent être renseignées
 * manuellement par l'exploitant avant la mise en production.
 */

export const COMPANY = {
  /** Nom commercial */
  brandName: 'StreamMalin',
  /** Identité de l'exploitant (entrepreneur individuel) */
  legalName: 'Said Ouarzazi',
  /** Forme juridique */
  status: 'Entrepreneur individuel (EI) — Micro-entreprise',
  /** Numéro SIREN (identique au numéro RCS) */
  siren: '104 981 014',
  /** Immatriculation au Registre du Commerce et des Sociétés */
  rcs: 'RCS Auxerre 104 981 014',
  /** Numéro SIRET du siège (14 chiffres = SIREN + code établissement NIC) */
  siret: '104 981 014 00012',
  /** Code d'activité (NAF/APE) */
  nafCode: '4791A',
  /** Adresse professionnelle déclarée */
  address: '4 rue des Acacias, 89200 Avallon',
  /** Contact officiel */
  email: 'hello@streammalin.fr',
  /** Directeur de la publication */
  publicationDirector: 'Said Ouarzazi',
  /** Site web */
  websiteUrl: 'https://www.streammalin.fr',
} as const;

export const HOST = {
  name: 'Vercel Inc.',
  address: '340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis',
  website: 'https://vercel.com',
  contact: 'https://vercel.com/contact',
} as const;

export const MEDIATION = {
  /** Médiateur de la consommation — à souscrire et compléter */
  name: '[NOM DU MÉDIATEUR DE LA CONSOMMATION — À COMPLÉTER]',
  address: '[ADRESSE DU MÉDIATEUR — À COMPLÉTER]',
  website: '[SITE WEB DU MÉDIATEUR — À COMPLÉTER]',
} as const;

/** Mention de franchise en base de TVA — modifiable si le régime change. */
export const CURRENT_VAT_EXEMPTION_TEXT = 'TVA non applicable, art. 293 B du CGI';

/** Clause de non-affiliation courte (pied de page). */
export const NON_AFFILIATION_SHORT =
  "StreamMalin est un service indépendant. StreamMalin n'est ni affilié, ni partenaire, ni revendeur officiel des plateformes citées. Les marques appartiennent à leurs propriétaires respectifs.";

/** Clause de non-affiliation longue (CGV / mentions légales). */
export const NON_AFFILIATION_LONG =
  "StreamMalin est un service indépendant. StreamMalin n'est ni affilié, ni partenaire, ni revendeur officiel des plateformes ou marques citées, notamment Netflix, Disney+, YouTube, Spotify, Google, Apple, Duolingo ou toute autre plateforme mentionnée. L'ensemble des marques, logos et noms commerciaux demeurent la propriété exclusive de leurs titulaires respectifs.";

/** Description normalisée du service (CGV, factures, emails). */
export const SERVICE_DESCRIPTION =
  "Le service proposé consiste en une mise à disposition temporaire d'un accès numérique, pour une durée déterminée, selon l'offre choisie par le client.";

export const SERVICE_NATURE =
  "L'accès fourni ne constitue pas une vente définitive d'un abonnement, d'un compte ou d'un droit de propriété. Le client bénéficie uniquement d'un droit d'accès temporaire et personnel pendant la durée de l'offre souscrite.";

/** Date de dernière mise à jour des documents légaux. */
export const LEGAL_LAST_UPDATED = '22 mai 2026';

/** Libellé de facture pour une offre donnée. */
export function invoiceLineLabel(offerName: string, durationLabel = '1 mois'): string {
  return `Mise à disposition temporaire d'un accès numérique — Offre ${offerName} — Durée ${durationLabel}`;
}
