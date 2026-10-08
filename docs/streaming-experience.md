# StreamMalin : parcours streaming

## Périmètre

Refonte du site public autour de la location d'abonnements vidéo et musique.
Les autres services sont séparés du catalogue streaming, sans suppression de
leurs données. La marketplace redondante est remplacée par des fiches permettant
de choisir parmi les accès disponibles et leurs tarifs.

Le code d'accès, les validations commerciales et les trois consentements restent
en place. Aucun indicateur de déploiement n'est activé, aucune donnée de production
n'est modifiée et aucune migration n'est ajoutée. L'administration est inchangée.
Les offres locales de démonstration ne prouvent aucune disponibilité réelle.

## Changements

- Accueil compact, visuel original, catalogue vidéo/musique, disponibilité et aide.
- Fiches : type d'accès, éligibilité, confidentialité, renouvellement et prix choisi.
- Paiement : récapitulatif d'abord sur mobile et dans l'ordre de lecture ; montant
  en euros français, consentements inchangés et e-mails valides avant paiement.
- Connexion client : navigation réservée aux clients connectés, champs accessibles,
  suppression de l'adresse e-mail dans les nouveaux liens d'achat.
- Contact : formulaire avec validation serveur, limitation persistante des envois,
  taille du corps bornée pendant la lecture, piège anti-robot et reprise sans
  effacer le message après une erreur.
- Envoi uniquement au support fixe hello@streammalin.fr, en texte brut, avec
  adresse de réponse validée et clé d'idempotence. Aucune réponse automatique
  envoyée à une adresse arbitraire et aucun secret serveur dans les composants client.
- Confidentialité : description des données du formulaire, sans inscription publicitaire.

## Vérifications du 8 octobre 2026

- `npm test` : 63 tests réussis, dont 6 nouveaux tests de présentation/contact.
- `npm run lint` : aucune erreur ni avertissement.
- `npm run build` : compilation et TypeScript réussis ; génération Prisma uniquement.
- `npm audit --omit=dev --audit-level=high` : aucune vulnérabilité signalée.
- Audit complet : 5 alertes élevées préexistantes dans la chaîne de développement
  ESLint / fast-glob / micromatch / braces (GHSA-vfj7-8cjw-p6xm). Le correctif forcé
  proposé rétrograderait eslint-config-next à 14.2.35 ; il n'est pas appliqué.
- Navigateur local isolé, 1440 × 900 et 390 × 844 : accueil, fiches, connexion,
  contact et paiement ; visuel chargé, aucun débordement horizontal observé.
- Catalogue vide : message de disponibilité, aucun lien d'achat et aucun calcul à zéro.
- Stock épuisé : boutons désactivés ; lien direct de paiement refusé.
- Catalogue en erreur : message distinct avec nouvelle tentative.
- Calculateur : seules les offres disponibles avec comparaison vérifiée sont proposées ;
  sélection et désélection vérifiées.
- Carte et PayPal : bouton bloqué avec 0, 1 ou 2 consentements ; actif avec 3 et
  e-mail valide. PayPal bloqué avec un e-mail invalide. Aucun paiement lancé.
- Option de stock différente : tarif choisi conservé dans le paiement.
- Contact : échec simulé affiché sans faux succès ni effacement du message.
  Acceptation du fournisseur et erreurs testées avec un transport simulé.

Captures locales dans `artifacts/streaming-experience/` (non versionnées).

## À vérifier avant une ouverture commerciale

- Autorisations documentées des fournisseurs et conditions de chaque offre.
- Stock réel, tarifs et sources de comparaison à jour.
- Réception effective du formulaire dans la boîte hello@streammalin.fr et réponse
  au client ; un envoi accepté par Resend n'est pas une preuve de réception.
- Parcours complets en sandbox : carte, PayPal et crypto si proposés, confirmation,
  transmission de l'accès, renouvellement et résiliation.
- Contrôles de déploiement GitHub/Vercel ; l'alerte de dépendances de développement
  peut encore bloquer le contrôle d'audit complet.
- Aucun taux de conversion n'est garanti. Mesurer les visites qualifiées et les
  commandes payées après validation de l'offre et réouverture du site.

## Visuel

`public/images/streaming-hero.webp` : image originale générée avec le générateur
d'images intégré, puis conversion WebP 1800 × 600, 116 440 octets. Illustration
d'équipement, sans logo, témoignage, avis ou preuve d'une offre disponible.

Prompt utilisé :

> Create a wide premium editorial photograph for the compact header of StreamMalin, a French streaming-subscription rental storefront. Aspect ratio 3:1. The actual subject is a clearly visible modern television on the right, showing an original cinematic mountain-and-lake landscape, with a small pair of headphones and a remote on a charcoal shelf. Crisp readable objects, no blur, no bokeh, no glow orbs, no gradients. Contemporary charcoal and muted forest-green environment, with a small natural coral accent on the remote. The LEFT 55 percent is a simple near-black textured wall, unframed, intentionally quiet for website text overlay. Full-bleed composition, not a UI mockup or card. No people, no logos, no famous characters, no copyrighted movie scene, no words, no ratings, no prices, no platform interface. This is illustrative streaming equipment, not a customer testimonial or evidence of an available offer.

## Fichiers

- `app/page.tsx`
- `app/layout.tsx`
- `app/checkout/page.tsx`
- `app/checkout/checkout.css`
- `app/offres/[id]/page.tsx`
- `app/contact/page.tsx`
- `app/api/contact/route.ts`
- `app/politique-confidentialite/page.tsx`
- `app/storefront.css` : remplacé par les styles des composants.
- `components/StreamingStorefront.tsx`
- `components/streaming-storefront.css`
- `components/OfferCard.tsx`
- `components/offer-card.css`
- `components/OfferDetails.tsx`
- `components/PublicShell.tsx`
- `components/public-pages.css`
- `components/ContactForm.tsx`
- `components/Footer.tsx`
- `lib/offerPresentation.ts`
- `lib/contactValidation.ts`
- `public/images/streaming-hero.webp`
- `tests/streaming-experience.test.cjs`
- `docs/streaming-experience.md`
