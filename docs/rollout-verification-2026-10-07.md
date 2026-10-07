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

L'alerte GHSA-vfj7-8cjw-p6xm affecte `braces <= 3.0.3`, transitivement utilise par
le lint Next via `fast-glob`/`micromatch`. Les dernieres versions officielles
consultees conservent cette dependance ; aucune version corrigee de braces
n'est disponible dans l'avis au moment du controle. Ne pas appliquer le downgrade
automatique du lint vers Next 14 ni masquer l'alerte. L'audit complet reste rouge.
L'audit des seules dependances de production doit etre controle separement.
Controle du 7 octobre 2026 : audit de production sans vulnerabilite signalee.

## Sources

- [Recherche d'entreprises officielle](https://recherche-entreprises.api.gouv.fr/search?q=104981014)
- [CM2C - mentions legales](https://www.cm2c.net/mentions-legales.php)
- [Mentions obligatoires des factures - ministere de l'Economie](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir)
- [Durees de conservation - CNIL](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees)
- [Tests Stripe](https://docs.stripe.com/testing)
- [Tests de facturation Stripe](https://docs.stripe.com/billing/testing)
- [Alerte braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
