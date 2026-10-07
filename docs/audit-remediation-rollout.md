# Remediation StreamMalin - 7 octobre 2026

## Etat de livraison

Travail dans `codex/audit-remediation`. La migration est preparee, pas appliquee
en production. Aucun acces Surfshark n'est autorise a la vente par ces changements.
Les ecrans locaux de demonstration utilisent uniquement des donnees fictives.

Ce document n'est pas une certification juridique, une preuve d'autorisation du
fournisseur ou une confirmation que des paiements reels ont ete testes.

## Changements

- Accueil plus compact, fiches d'offre, comparateur mobile sans debordement,
  selection vide du calculateur, messages de stock et de chargement distincts.
- Economies affichees seulement pour une reference HTTPS, datee de moins de
  90 jours, dont le prix correspond et dont l'equivalence a ete verifiee.
- Projection prudente des descriptions deja enregistrees, sans reecriture des donnees.
- Conditions d'acces, eligibilite et confidentialite visibles avant paiement.
- Prix et prelevement mensuel automatique explicites dans le checkout carte.
- Confirmation Stripe verifiee cote serveur, sans livrer des identifiants a
  partir d'une simple adresse e-mail ou d'un parametre `success=true`.
- Trois consentements controles dans l'interface ET sur le serveur.
- CGV identifiees `2026-10-07.1`, archive consultable, piece jointe texte dans
  les nouvelles transmissions traitees par la file durable.
- Exclusions generales de remboursement et de recours reformulees ; les
  droits imperatifs ne peuvent pas etre supprimes par une case a cocher.
- Fonction de retractation en deux etapes avec declaration chiffree en base,
  horodatage serveur et accuse telechargeable. Elle n'accorde pas automatiquement
  un remboursement et ne confirme pas l'identite du demandeur.
- Liens canoniques propres aux pages legales ; pages privees non indexables.
- Navigation admin utilisable sur telephone et ecran de verification des offres,
  transmissions, paiements, demandes de retractation et sessions admin.
- Numero et creation de la facture initiale dans une meme transaction, avec
  verrou de commande pour eviter un second numero en cas de traitement concurrent.
- Instructions de transfert masquees avant reservation et apres son expiration.

## Migration additive autorisee

Fichier de revue : `prisma/remediation/20261007_additive.sql`.
Il cree quatre tables, sans supprimer ni modifier les tables et lignes existantes :

| Table | Utilite |
| --- | --- |
| StockReservation | Place reservee avant paiement, expiration, session Stripe et consommation |
| DeliveryJob | Transmission persistante, tentatives, bail de traitement, erreur non sensible, suivi humain |
| PaymentRecord | Paiement en centimes, reference unique du prestataire, commande, version des CGV, periode |
| AdminSession | Session aleatoire avec expiration et revocation serveur |

Les references de commande et de stock utilisent `ON DELETE RESTRICT` :
elles ne peuvent pas etre supprimees tant que les preuves associees existent.
Les preuves initiales de la commande et les declarations de retractation sont
chiffrees dans la table Setting existante. Elles ne sont pas exposees par les
endpoints publics ni par la liste blanche des parametres admin.

### Procedure avant production

1. Garder toutes les ouvertures commerciales fermees.
2. Verifier une sauvegarde recente et TESTER sa restauration sur une base isolee.
3. Comparer le schema reel, le schema Prisma et le SQL additif. Le projet utilisait
   `db push` et n'a pas de baseline de migrations : ne pas lancer aveuglement
   `prisma migrate deploy` sur la base existante.
4. Appliquer d'abord le SQL sur la copie restauree. Verifier les donnees historiques,
   les contraintes, l'espace disque et les quatre nouvelles tables.
5. Tester les courses sur la derniere place via `npm run test:postgres`, avec
   `TEST_DATABASE_URL` local et un nom de base se terminant par `_test`.
  La CI execute aussi ce test contre PostgreSQL 16 jetable.
  Elle recree la baseline precedente puis applique le SQL additif exact ;
  elle verifie aussi la creation concurrente de la facture initiale.
6. Tester Stripe EN MODE TEST : paiement, retour annule, expiration, rejeu de webhook,
   commande tardive sans stock, refus de paiement, renouvellement et annulation.
7. Tester les e-mails transactionnels sur une boite de test : panne, reprise,
   piece jointe CGV et absence de fausse confirmation de livraison.
8. Expirer/verifier tous les anciens checkouts encore ouverts AVANT l'activation :
   les anciens evenements sont conserves compatibles mais n'avaient pas de reservation.
9. Une fois ces etapes validees, planifier explicitement l'application en production,
   avec sauvegarde verifiee, maintenance et retour arriere du CODE uniquement.
   Ne pas supprimer les tables ou preuves au retour arriere.

Le build ne pousse jamais le schema et ne doit pas se connecter a la base.
La commande `db:push` existante reste un outil manuel ; elle ne doit pas etre
utilisee contre la production pour cette livraison.

## Drapeaux serveur (tous fermes par defaut)

- `REMEDIATION_SCHEMA_ENABLED=true` : seulement apres application et verification
  du schema. Les cookies admin historiques sont alors rejetes ; reconnexion avec 2FA.
- `DELIVERY_WORKER_ENABLED=true` : apres validation du prestataire e-mail et
  du traitement de reprise. Le cron ou une action admin traite les jobs.
- `COMMERCE_ENABLED=true` : apres tests et validation commerciale/juridique.
  Le serveur requiert aussi la migration et une verification par offre.
- `MANUAL_PAYMENTS_ENABLED=true` : opt-in separe, seulement si un operateur sait
  verifier la reception et la reference unique de chaque paiement. PayPal et crypto
  ne sont PAS convertis fictivement en integration automatique par ces changements.
- `CATALOG_SEED_ENABLED=true` : uniquement pour un environnement non production vide.
- Le passage des anciens abonnements au prelevement automatique reste ferme.

La verification d'une offre exige une reference PRIVEE d'autorisation ecrite,
le type d'acces, l'eligibilite et la confidentialite. Un bouton dans l'admin ne
remplace jamais la validite du document du fournisseur. Surfshark reste non verifie.

## Operations a surveiller

- `payment_review` / `refund_needed` : paiement recu sans acces attribuable.
  L'administrateur doit verifier la transaction, arreter l'abonnement chez Stripe
  si la prestation ne peut pas etre fournie, puis resoudre le remboursement chez
  le prestataire. Aucun remboursement automatique ni ordre financier n'est execute.
  Une notification d'alerte et une permanence operationnelle sont indispensables
  AVANT toute ouverture commerciale. L'ecran seul ne constitue pas une permanence.
- `access_revocation` : ne liberer la place qu'apres retrait EFFECTIF de l'acces
  chez le fournisseur. Le retrait est manuel en l'absence d'API fournisseur autorisee.
- `needs_review` : e-mail ambigu, retries epuises, ordre non actif ou tentative
  hors de la fenetre d'idempotence de Resend. Ne pas renvoyer aveuglement les acces.
- Resend conserve une cle d'idempotence pendant 24h. Les tentatives automatiques
  sont arretees avant cette limite. Cela limite les doublons, sans promettre une
  livraison/reception exactement une fois dans tous les incidents reseau.
- Configurer un ordonnanceur compatible avec le forfait d'hebergement pour
  appeler le cron avec son secret et une frequence adaptee au suivi client.
  Aucun changement du forfait Vercel ou cron de production n'est realise ici.
- Telegram peut etre utilise pour le support existant ; verifier minimisation,
  contrats de sous-traitance et transferts. Aucun secret ne doit etre copie dans
  un journal ou une notification.

## Limites a lever avant merge/ouverture

- L'autorisation ecrite de revente/partage pour chaque fournisseur.
- La qualification contenu numerique/service, les conditions de retractation,
  la conformite des CGV et les durees de conservation par un juriste competent.
- L'identite, les numeros d'entreprise, le regime TVA et l'adhesion au mediateur :
  valeurs declarees conservees, pas authentifiees par l'agent.
- Les versions historiques "23 mai 2026" ne sont pas recreees fictivement :
  retrouver les anciennes CGV exactes et leurs dates dans les archives existantes.
- La facturation interne historique conserve une facture par commande.
  PaymentRecord journalise chaque nouveau paiement et sa reference de facture
  Stripe, MAIS ne transforme pas ce modele en facturation comptable multifacture.
  Valider les factures de renouvellement Stripe (identite, TVA, numerotation),
  ou preparer une evolution de facturation distincte et approuvee.
- Les KPI historiques sont indicatifs et ne remplacent pas une comptabilite :
  frais prestataires, remboursements, renouvellements anciens et couts dans le temps
  ne peuvent pas etre reconstruits avec certitude depuis un total de commande.
- La confirmation d'acceptation d'un e-mail par Resend n'est pas une preuve que
  l'e-mail a ete lu ou que l'invitation du fournisseur a ete acceptee.

## Verification reproductible

`npm test`, `npm run lint`, `npm run build`.

Resultats locaux : 44 tests passes, lint sans erreur et build complet reussi.
Le moteur Prisma natif est bloque par la protection Windows locale et le daemon
Docker n'est pas lance : le test PostgreSQL est execute en CI, pas declare passe
sur cette machine. Aucune protection Windows n'a ete desactivee.

`source-map-js` mis a jour en 1.2.2. Audit des dependances de production :
aucune vulnerabilite signalee. L'audit complet reste bloquant sur la chaine
ESLint/fast-glob/micromatch/braces : GHSA-vfj7-8cjw-p6xm, sans correctif officiel
au moment du controle. Ne pas masquer l'alerte ni retrograder Next/ESLint par force.
La CI conserve son controle complet et peut donc rester rouge pour cette raison.

Verification visuelle locale : ordinateur environ 1440 px, mobile 390 px,
catalogue normal/vide/stock epuise/erreur, calculateur, confirmations checkout
0/1/2/3 puis decochage, menu admin et suivi, relecture de la retractation.
Ces donnees sont fictives ; aucune transaction ni demande reelle n'est envoyee.

Preview isolee : `node tests/start-ui-preview.cjs`, puis
`http://127.0.0.1:3101/?fixture=normal`, `?fixture=soldout`, `?fixture=empty`,
`?fixture=error`. Toutes les mutations et tous les paiements sont refuses dans
cette demonstration. Aucune base de production n'y est utilisee.
Pour verifier le build compile, definir `PREVIEW_PRODUCTION=true` avant de lancer
le meme script, apres `npm run build`.

Sources primaires consultees le 7 octobre 2026 :

- https://docs.stripe.com/payments/checkout/managing-limited-inventory
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/delais-de-reflexion-ou-de-retractation-comment-sappliquent-t-ils
- https://surfshark.com/terms-of-service
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-68fv-2mgg-jv7q

Ne pas publier les captures de l'administration de production, les listes de
clients, les secrets ou le rapport prive de l'audit dans la PR.
