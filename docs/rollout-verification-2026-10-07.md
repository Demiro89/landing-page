# Verification du deploiement - 7 octobre 2026

Portee demandee : sauvegarde/migration, tests Stripe, livraison, controles legaux
et alerte de dependance. Aucune ouverture des ventes, approbation fournisseur,
transaction reelle ou suppression de donnees de production.

## Base de donnees

- Projet Neon `streammalin-db`, PostgreSQL 17, region Francfort.
- La connexion de production Vercel a ete recoupee avec le compute de la branche
  Neon `production`, sans conserver ni publier la chaine de connexion.
- Snapshot manuel cree le 7 octobre 2026 a 10:23:44 UTC, sans expiration indiquee.
- Restauration multi-etapes effectuee dans une branche distincte. Les connexions
  de production n'ont pas ete migrees vers cette branche.
- Les 12 tables historiques ont ete controlees par comptage et empreintes
  agregees. Aucune donnee personnelle, cle de parametre ou mot de passe n'a ete
  lu pour ces controles. Empreintes identiques avant/apres migration sur la copie.
- Script teste : `prisma/remediation/20261007_additive.sql`, empreinte SHA-256
  apres normalisation des fins de ligne et suppression des espaces de bord :
  `e2a497aa17717f1c293c9a6116d51fb6d03440b61836bfc47e7910fd1c354ae3`.
- Ce meme script a ensuite ete applique a la branche de production et valide
  par `COMMIT`. Les quatre nouvelles tables sont presentes et vides. Les 12
  tables historiques ont exactement les memes comptages et empreintes avant/apres.
- Les connexions Vercel et les interrupteurs de commerce/livraison n'ont pas ete
  modifies. La presence des tables ne constitue pas une autorisation de vendre.
- Ce snapshot est un point de retour dans Neon, pas une sauvegarde exportee
  independante du fournisseur. L'historique automatique observe est de six heures.
- Le compte gratuit ne permet pas de creer un deuxieme snapshot sans changement
  de formule. Aucune formule payante n'a ete souscrite.

Ne pas remplacer les URLs de production par celles de la copie restauree.
Ne pas utiliser `db push` ou `migrate deploy` sans baseline sur la production.
Les fonctions nouvelles restent fermees tant que les tests de prestataires,
la configuration des envois et les autorisations commerciales ne sont pas valides.

## Paiement et livraison

Les nouveaux tests PostgreSQL utilisent une base locale jetable terminee par
`_test`. Ils refusent les bases distantes et ne lisent pas `DATABASE_URL`.
La verification des signatures utilise le vrai SDK Stripe ; les appels aux
prestataires Stripe/Resend sont simules et ne remplacent pas un essai en sandbox.

Scenarios couverts : signature invalide, checkout impaye, expiration de reservation,
rejeu concurrent d'un paiement, une seule place/commande/livraison, echec d'envoi
puis reprise, prise en charge concurrente d'un envoi, reference de paiement et
facturation, renouvellement, paiement echoue, resiliation et liberation de place
seulement apres confirmation de revocation de l'acces fournisseur. Un paiement
tardif ne prend pas la place reservee par une autre commande : revue manuelle.

Resultats techniques verifies sur le commit `175bc98` :

- 57 tests unitaires reussis, sans echec ni test ignore.
- 5 tests d'integration reussis sur PostgreSQL 17 dans GitHub Actions, sans echec
  ni test ignore. La migration additive est appliquee sur le schema historique
  avant ces tests ; les appels aux prestataires y restent simules.
- `npm run lint` et `npm run build` reussis en local ; compilation et verification
  TypeScript egalement reussies dans GitHub Actions avec Next.js 16.3.8.
- Execution GitHub Actions : [Quality 37770829308](https://github.com/Demiro89/landing-page/actions/runs/37770829308).
  Son statut global reste en echec a cause de l'audit des dependances de
  developpement. Ce n'est pas un echec des tests PostgreSQL ou du build.

La collecte d'adresse est demandee a Stripe. Le nom et l'adresse issus du webhook
signe sont conserves dans une preuve chiffree immuable, reutilisee pour la facture
initiale et disponible dans l'export du client proprietaire. Les anciennes factures
ne sont pas modifiees et aucune migration supplementaire n'est necessaire.

`/api/cron/deliveries` traite uniquement les livraisons, sans nettoyage de comptes
ou journaux. Authentification Bearer `CRON_SECRET`, reponses non mises en cache,
fonctions fermees par defaut. Les alertes Telegram contiennent uniquement des
comptages ; un refus fournisseur est signale comme echec et ne contient pas de
message client ni de secret dans les journaux.

Le cron quotidien existant ne suffit pas a une livraison rapide. Il faut un
ordonnanceur autorise appelant la route de livraison toutes les quelques minutes
ou un traitement equivalent, puis prouver sa regularite. Aucun ordonnanceur,
secret partage ou abonnement payant n'a ete cree dans cette intervention.

Un identifiant Resend prouve l'acceptation par le prestataire, pas la reception
dans la boite du client ni l'activation effective d'une invitation fournisseur.
Les essais reels necessitent un destinataire autorise et les acces sandbox.

### Essais de prestataires du 7 octobre 2026

Stripe : essais exclusivement dans le sandbox existant
`acct_1TJtPRHUYpGBxmnO`, sans utiliser les cles de production ni une carte reelle.
Le connecteur Stripe ne presentant que le compte live, les essais sandbox ont
ete effectues avec Stripe Shell dans le tableau de bord authentifie.

- Paiement fictif de 300 centimes EUR : `pi_3UNsYgHUYpGBxmnO1udYy6AE`,
  `livemode: false`, `status: succeeded`.
- Carte de refus officielle : `card_declined` / `generic_decline` ; aucun paiement
  reussi n'est annonce.
- Client fictif sans adresse e-mail : `cus_VOfy1BbgTBW7Vm`, horloge
  `clock_1UNsadHUYpGBxmnOf0Ejxfle`, abonnement
  `sub_1UNse7HUYpGBxmnOzJPF80g5`.
- Premiere facture `in_1UNse7HUYpGBxmnOYKWGcnEx` : `subscription_create`,
  `amount_paid: 300`, `status: paid`, numero `2HZEQRVE-0001`.
- Apres avance de l'horloge, facture `in_1UNsgcHUYpGBxmnOe0nl3fJW` :
  `subscription_cycle`, `amount_paid: 300`, `status: paid`, numero `2HZEQRVE-0002`.
- Apres passage a une carte de test qui refuse les prelevements, facture
  `in_1UNsjfHUYpGBxmnOnjBbCgGd` : `amount_paid: 0`, `amount_remaining: 300`,
  `status: open`, numero `2HZEQRVE-0003`. Abonnement verifie `past_due`.
- Abonnement fictif ensuite resilie sans prorata ni nouvelle facturation :
  `livemode: false`, `status: canceled`. Aucun abonnement reel n'a ete touche.
- Les lectures d'abonnement/facture avec la version demandee par le site
  `2026-04-22.dahlia` ont reussi. Les elements d'abonnement exposent bien
  `current_period_start` et `current_period_end` ; la facture expose `parent`.

Resend : domaine `streammalin.fr` verifie, envoi autorise, region `eu-west-1`,
suivi des ouvertures et clics desactive. Un message de test sans commande,
identifiant d'acces ou donnee client a ete envoye depuis `hello@streammalin.fr`
a une adresse autorisee par le proprietaire. Reference
`01a11607-f71a-7c18-a8c3-6180a86881ef`, statut fournisseur `delivered`.
Le proprietaire a confirme sa reception dans la boite principale. Le rejeu exact
avec la meme cle d'idempotence a retourne cette meme reference, sans second envoi.
L'adresse personnelle de reception n'est pas conservee dans le depot.

Ces essais de prestataires sont distincts des tests de l'application : aucun
webhook sandbox n'a ete branche sur une instance isolee du site, et le message
de test Resend n'a pas ete emis par un job de commande. Ils ne valident donc pas
encore le parcours reel checkout -> webhook -> reservation -> facture -> acces
ni les alertes Telegram en exploitation. Aucun compte client ou acces fournisseur
de production n'a ete utilise. Ne pas reouvrir les ventes sur cette seule preuve.

### Suivi des relances d'impayes

Les relances Stripe et les deux actions admin `mark_unpaid`/`send_reminder` sont
desormais ajoutees a `DeliveryJob` dans la meme transaction que le changement
d'etat de la commande, lorsque le schema de remediation est active. Aucune
nouvelle table ou migration n'est necessaire. Le mode historique conserve son
envoi direct lorsque cet interrupteur est ferme.

Les reprises conservent la meme cle d'idempotence. Une commande regularisee,
annulee, une relance remplacee par un niveau suivant ou un nouvel episode
d'impaye rend la relance precedente obsolete (`skipped`, sans envoi). Une erreur
permanente du prestataire passe en revue manuelle ; les erreurs temporaires et
limitations de debit restent reprises. Une facture deja confirmee payee ne peut
pas etre retrogradee par un ancien evenement d'echec de cette meme facture.

Le message ne contient aucun identifiant d'acces ni adresse de paiement PayPal
fixe. Il renvoie vers l'espace client et demande de contacter le support avant
un autre reglement si le paiement a deja ete regularise. Il comporte des versions
texte et HTML avec echappement des valeurs. L'admin indique une relance
"enregistree", et ne pretend plus que l'e-mail a ete recu ou envoye.

Validation locale et CI : 57 tests unitaires reussis, lint et build reussis. Le
cinquieme test PostgreSQL couvre les relances, reprises concurrentes,
regularisations, actions admin et annulations ; les cinq tests PostgreSQL sont
reussis sans test ignore sur `175bc98`. Les prestataires y sont simules.
L'apercu UI utilise exclusivement des donnees fictives et refuse toute mutation.
Affichage controle a 390 x 843 et 1440 x 1000 pixels CSS : libelles "enregistree",
dates, deux niveaux de relance et absence de quatrieme rappel. Aucun debordement
horizontal de la page constate ; les captures sont locales, hors depot.

## Identite, mediation et comptabilite

Les informations existantes de l'exploitant et de CM2C sont conservees. Aucun
justificatif d'immatriculation ou certificat d'adhesion n'a ete retrouve dans
les fichiers de travail de cette intervention.

L'API officielle Recherche d'entreprises retourne un etablissement actif pour
le SIRET declare, une entreprise individuelle et le code actuel **47.91B**.
Le code NAF du site etait 4791A : il est corrige en 4791B. Le registre ne diffuse
pas l'identite et l'adresse de cette entreprise : leur concordance, le RCS et
la franchise de TVA ne peuvent pas etre certifies par cette recherche.

L'adresse et les coordonnees de CM2C correspondent aux informations du mediateur.
L'adhesion jusqu'au 22 mai 2029 est une declaration deja presente dans le projet,
pas une attestation verifiee par Codex. Le regime de TVA et l'adhesion effective
restent a confirmer avec les justificatifs de l'exploitant.

La numerotation initiale reste atomique et idempotente. Le modele actuel autorise
une seule facture interne par commande ; les references de factures de
renouvellement Stripe sont conservees dans l'historique de paiements. Verifier
les mentions, la numerotation et l'envoi des factures Stripe dans la sandbox,
puis avec le comptable. Une vraie serie interne par renouvellement demanderait
une modification de modele : elle n'est pas improvisee ici.

## Conservation des donnees

- Factures : conservation comptable de dix ans ; pas de reecriture d'une facture
  deja emise. Le traitement fiscal effectif reste a confirmer.
- Preuves contractuelles, IP/user-agent, demandes de retractation, support et
  historique : definir les durees par finalite et les exceptions de litige, avec
  archivage a acces limite. Ne pas copier par defaut la duree des factures sur
  toutes les donnees personnelles. Aucune nouvelle purge de ces preuves n'est lancee.
- Le nettoyage existant vise les marqueurs webhook apres 90 jours et le journal
  administrateur apres 180 jours ; controler son execution, les sauvegardes et
  l'absence de besoin de conservation specifique en cas de litige.
- Valider les contrats de sous-traitance et transferts applicables a Vercel,
  Stripe, Resend, Neon et Telegram. La localisation principale de Neon ne prouve
  pas a elle seule la localisation de tous les traitements des prestataires.

## Dependances

Le controle CI sur `1585bf0` a signale des avis Next.js supplementaires affectant
16.3.7. Le correctif officiel minimal 16.3.8 et sa configuration lint correspondante
sont appliques dans `package.json` et le fichier de verrouillage, sans mise a
jour majeure ni modification de base. Les tests, le lint et le build passent
avec cette version. Controle apres correction : `npm audit --omit=dev` ne signale
aucune vulnerabilite. Cela concerne les dependances de cette branche, pas une
attestation de securite complete du site. Le correctif n'est pas encore deploye
en production puisque la PR reste non mergee.

L'alerte GHSA-vfj7-8cjw-p6xm affecte `braces <= 3.0.3`, transitivement utilise par
le lint Next via `fast-glob`/`micromatch`. Les dernieres versions officielles
consultees conservent cette dependance ; aucune version corrigee de braces
n'est disponible dans l'avis au moment du controle. Ne pas appliquer le downgrade
automatique du lint vers Next 14 ni masquer l'alerte. L'audit complet reste rouge.
Les cinq entrees de l'audit complet correspondent a cette chaine de dependances
de developpement. L'audit de production reste un controle distinct et reussit
apres le correctif Next.js ; l'audit complet est conserve en echec dans la CI.

## Restant avant ouverture des ventes

1. Brancher une instance isolee du site sur une base de test et le sandbox Stripe,
   sans partager les connexions de production. Tester le parcours complet et les
   receptions/rejeux des webhooks, puis les factures et envois issus des vrais jobs.
2. Configurer et verifier un traitement regulier des livraisons ainsi que la
   reception des alertes d'exploitation. Les tests unitaires prouvent les gardes
   et reprises ; aucun ordonnanceur frequent ni canal Telegram n'a ete valide
   en exploitation dans cette intervention. La reprise des relances d'impayes
   est preparee dans cette branche, mais reste a verifier avec les vrais jobs
   de l'instance de test et cet ordonnanceur.
3. Fournir les justificatifs d'identite/immatriculation, l'attestation CM2C et le
   regime de TVA. Verifier les factures de renouvellement et les durees de
   conservation avec les professionnels concernes.
4. Traiter l'alerte de dependance de developpement des qu'un correctif compatible
   est disponible, ou faire examiner explicitement une mitigation maintenue.
   Ne pas masquer le controle en echec pour annoncer une validation complete.
5. Conserver les offres sans autorisation fournisseur indisponibles. La migration,
   les essais Stripe et la reception d'un e-mail de test ne prouvent pas que la
   revente d'un acces tiers est autorisee.

Un export chiffre independant de Neon et un second exercice de restauration
restent recommandes ; la seule sauvegarde constatee ici est le snapshot Neon
restaure et controle. La PR reste en brouillon, non mergee, et les interrupteurs
commerce/livraison restent fermes.

## Fichiers modifies dans la PR

- `.github/workflows/quality.yml`
- `app/admin/page.tsx`
- `app/api/admin/stock/route.ts`
- `app/api/checkout/stripe/route.ts`
- `app/api/client/export-data/route.ts`
- `app/api/cron/cleanup/route.ts`
- `app/api/cron/deliveries/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/politique-confidentialite/page.tsx`
- `docs/rollout-verification-2026-10-07.md`
- `lib/billingSnapshot.ts`
- `lib/cronAuth.ts`
- `lib/deliveryAlerts.ts`
- `lib/deliveryWorker.ts`
- `lib/invoice.ts`
- `lib/legalConfig.ts`
- `lib/nodemailer.ts`
- `lib/reservedStripeOrder.ts`
- `lib/telegram.ts`
- `lib/unpaidReminders.ts`
- `package-lock.json`
- `package.json`
- `proxy.ts`
- `tests/postgres-payments.cjs`
- `tests/order-security.test.cjs`
- `tests/rollout-verification.test.cjs`
- `tests/security.test.cjs`
- `tests/start-ui-preview.cjs`
- `tests/ui-preview.cjs`

## Sources

- [Recherche d'entreprises officielle](https://recherche-entreprises.api.gouv.fr/search?q=104981014)
- [CM2C - mentions legales](https://www.cm2c.net/mentions-legales.php)
- [Mentions obligatoires des factures - ministere de l'Economie](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir)
- [Durees de conservation - CNIL](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees)
- [Tests Stripe](https://docs.stripe.com/testing)
- [Tests de facturation Stripe](https://docs.stripe.com/billing/testing)
- [Alerte braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Correctifs de securite Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8)
