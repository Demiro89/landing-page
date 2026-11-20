# StreamMalin - Rapport de transmission de Codex a Gemini

Rapport prepare le 13 novembre 2026 pour le proprietaire du projet.
Objet : transmettre les travaux, leurs preuves et les sujets a reprendre.
Ce document est un bilan de transmission, pas un nouvel audit de production.

## 1. Etat exact a la transmission

- Depot : https://github.com/Demiro89/landing-page
- Site : https://www.streammalin.fr/ ; administration : /admin.
- Activite retenue par le proprietaire : location d'abonnements streaming.
- Branche de travail : `codex/account-email-hardening`.
- Dernier commit de code : `67742532c14093a4c10fdffc40f7d4e06dacbc4c`.
- PR de livraison : https://github.com/Demiro89/landing-page/pull/85
- Base actuelle de cette PR : `main`.
- Statut GitHub verifie le 13 novembre : **ouverte, non fusionnee**.
- La PR consolidee compte 100 fichiers modifies et contient les travaux des
  PR #82, #83, #84 et #85. Les quatre PR sont encore ouvertes au controle.
- Les derniers controles GitHub de ce commit ont reussi, ainsi que sa preview
  Vercel. **Une preview reussie ne prouve pas un deploiement en production.**
- La fusion avait ete demandee par le proprietaire ; elle n'a pas ete effectuee.
  Ne pas presenter les corrections de cette PR comme deja presentes sur le site.

Ordre historique : #82 site public, #83 administration, #84 AppSec,
#85 comptes/e-mails/sessions puis suppression de la dependance vulnerable.
La PR #85 a ete reorientee vers main pour permettre une seule livraison finale.
Eviter de fusionner les memes changements plusieurs fois ou dans une mauvaise base.

Les PR #51 a #54 et les premiers correctifs Claude ont ete evoques par le
proprietaire dans la conversation. Leur detail historique n'a pas ete reaudite
pendant la preparation de ce rapport : verifier le depot, pas seulement les resumes.

## 2. Stack et regles de travail

- Next.js 16.3.8, App Router, React 19.2.4, TypeScript.
- Prisma et client Prisma 5.13.0 ; PostgreSQL chez Neon.
- Stripe 22.x ; paiements manuels PayPal/crypto selon les options activees.
- Resend pour les e-mails ; Telegram pour certaines alertes/support.
- Vercel pour l'hebergement et GitHub Actions pour les controles.
- Sessions signees HMAC ; mots de passe scrypt ; TOTP ; chiffrement AES-GCM.
- Lire `AGENTS.md` et la documentation de la version installee dans
  `node_modules/next/dist/docs/` avant toute modification Next.
- `npm run build` execute `prisma generate && next build`.
- `vercel.json` impose `npm ci` puis `npm run build`.
- `npm run db:push` existe separement : ce n'est pas une commande de build.
- Aucun secret, mot de passe, cookie, chaine PostgreSQL ou export client n'est
  necessaire dans ce rapport ou dans un prompt transmis a un autre assistant.

## 3. Site public et experience d'achat

### Presentation et navigation

- Accueil recentre sur la video et la musique, plus compact et plus lisible.
- Autres services separes du catalogue streaming, sans supprimer leurs donnees.
- Nouveau composant `StreamingStorefront`, cartes et fiches d'offres detaillees.
- Visuel original optimise en WebP : `public/images/streaming-hero.webp`.
- La marketplace redondante est remplacee par la selection des acces disponibles.
- Prix, type d'acces, disponibilite, eligibilite, confidentialite et renouvellement
  presentes avant l'achat ; tarif de l'option choisie conserve jusqu'au checkout.
- Espace client et navigation adaptes selon la connexion.
- Suppression de l'adresse e-mail dans les nouveaux liens d'achat.
- Tests visuels sur ordinateur et mobile, avec donnees fictives.

### Stock et calculateur

- Etats distincts pour catalogue vide, erreur de chargement et stock epuise.
- Message de disponibilite plutot qu'une page vide ; achat bloque sans stock.
- Refus serveur d'un checkout direct sans place disponible.
- Calculateur sans resultat artificiel a zero lorsqu'aucune offre valable n'existe.
- Comparaison conditionnee a une reference HTTPS datee et a une equivalence verifiee.
- Pas d'economie annoncee sur la seule base d'un prix catalogue non justifie.

### Checkout et contact

- Recapitulatif et montant lisibles en premier dans le parcours mobile.
- Montants au format francais ; reconduction et prelevement mensuels explicites.
- Trois consentements controles dans l'interface et cote serveur : CGV,
  execution immediate/renonciation applicable et eligibilite de l'utilisateur.
- E-mail valide et consentements reels requis ; une chaine de caracteres n'est
  pas acceptee comme un booleen de consentement.
- Pas de livraison fondee sur un simple parametre de retour `success=true`.
- Formulaire contact avec validation serveur, borne de taille, limitation
  persistante, piege anti-robot et conservation du brouillon apres un echec.
- Destination support fixe, contenu echappe/texte brut et idempotence d'envoi.
- Pas de reponse automatique envoyee a une adresse arbitraire saisie dans le formulaire.

Fichiers principaux : `app/page.tsx`, `app/checkout/`, `app/offres/[id]/`,
`app/contact/`, `app/api/contact/`, `components/StreamingStorefront.tsx`,
`OfferCard.tsx`, `OfferDetails.tsx`, `ContactForm.tsx`, `PublicShell.tsx`,
`Footer.tsx`, `lib/offerPresentation.ts`, `lib/contactValidation.ts` et leurs styles.

## 4. Textes, preuves contractuelles et pages legales

- Reduction des promesses commerciales absolues et des formulations de livraison
  ou de disponibilite trompeuses ; independance vis-a-vis des plateformes.
- Relecture des CGV : dependance aux tiers, eligibilite, non-affiliation,
  remboursement/reclamation ; les droits imperatifs ne sont pas supprimes.
- Version des CGV `2026-10-07.1` archivee ; version controlee cote serveur.
- Conservation des preuves de consentement et du contexte de commande : dates,
  version des CGV, IP/user-agent, offre, e-mail, paiement, montant et identifiant.
- Fonction de retractation en deux etapes, declaration chiffree, horodatage et
  accuse telechargeable. Ce n'est pas une decision automatique de remboursement.
- Politique de confidentialite enrichie sur les traitements et le formulaire contact.
- Footer et pages : `/cgv`, `/mentions-legales`, `/politique-confidentialite`,
  `/cookies`, `/reclamation`, `/mediation`, `/non-affiliation`, `/retractation`,
  `/remboursements`.
- Correction du code NAF historique d'apres le registre consulte en octobre.
- Aucune certification des droits de revente, de l'immatriculation complete,
  du regime de TVA ou de l'adhesion effective au mediateur.
- Surfshark et toute offre dont l'autorisation est absente/non verifiee doivent
  rester indisponibles selon l'instruction du proprietaire.

## 5. Administration : design et fiabilite

- Navigation regroupee par taches, interface claire et etats d'alerte distincts.
- Priorite aux commandes a traiter ; recherches, filtres, pagination et compteurs.
- Formulaires de creation replies ; tableaux et menu utilisables sur mobile.
- Fenetres de dialogue avec focus clavier, fermeture par Echap et retour au declencheur.
- Vues distinctes : offres, transmissions, paiements, sessions et retractations.
- Statuts inconnus/en attente non presentes comme actifs.
- Indicateurs renommes en montants initiaux valides et marge indicative ; ils ne
  constituent pas un chiffre d'affaires exhaustif ou un benefice comptable.
- Montants non valides exclus des totaux clients et exports correspondants.
- Un echec reseau/HTTP ou une reponse non JSON ne produit plus un faux succes.
- Brouillons du support conserves apres refus ; erreurs groupees rendues explicites.
- Actions au resultat incertain bloquees jusqu'a actualisation des donnees.
- Validation manuelle d'un paiement Stripe refusee avant toute transaction.
- Regularisation manuelle durable exigeant une nouvelle reference de paiement,
  enregistree dans la meme transaction que le changement de statut.

Fichiers principaux : `app/admin/`, `components/admin/`, `lib/adminPresentation.ts`,
`lib/adminResponse.ts` et routes `app/api/admin/`.

## 6. Securite applicative corrigee

### Comptes clients et concurrence

- Invalidation des anciens resets lors d'un changement d'adresse e-mail.
- Emission conditionnelle d'un reset pour bloquer une demande concurrente devenue obsolete.
- Ancien lien d'inscription inutilisable apres changement/reset de mot de passe.
- Consommation unique et atomique des liens ; controle d'expiration a l'ecriture.
- Mise a jour du mot de passe et invalidation des sessions dans la meme transaction.
- Suppression de compte exigeant le mot de passe actuel et refusant les identifiants
  devenus obsoletes avant l'ecriture ; aucune commande detachee dans ce cas.
- Compteur de mauvais mots de passe incremente atomiquement ; verrouillage concurrent.
- Reponses publiques plus neutres pour reduire l'enumeration des comptes.
- Verification de session/propriete avant recherche de commandes dans le chat.
- Nettoyage conditionnel evitant de supprimer un compte confirme entre-temps.

### Acces admin et donnees sensibles

- Identifiants fournisseur retires des listes stock/commandes et relations imbriquees.
- Consultation unitaire authentifiee, limitee et journalisee avant transmission du secret.
- Refus de consultation si le journal obligatoire est indisponible.
- Edition protegee contre les donnees perimees et les champs masques ecrases a vide.
- Confirmation admin recente par mot de passe et TOTP si active, valable dix minutes
  et liee a la session, avant les operations sensibles selectionnees.
- Annuler la confirmation n'execute pas l'action ; reprise unique seulement apres
  le refus explicite emis avant mutation. Aucun rejeu generique des erreurs reseau.
- Sessions admin revocables cote serveur, y compris lorsque le schema commercial
  est desactive, avec registre de secours dans la table `Setting` existante.
- Anciennes sessions sans identifiant refusees : reconnexion necessaire au deploiement.
- Panne du registre ou des limitations sensibles : refus de l'action.
- Les codes TOTP restent a usage unique, y compris lors d'une reauthentification.

### Entrees, reponses et configuration

- Lecteur JSON partage : media type, UTF-8, type objet et taille reelle du flux.
- Refus des objets invalides, tableaux, scalaires et corps excessifs ; 400/413/415.
- Le webhook Stripe conserve son corps brut pour verifier la signature.
- Durcissement CSV contre les formules precedees d'espaces ou caracteres de controle.
- CSP et cache appliques aussi sur plusieurs reponses precoces du proxy.
- Documents admin et donnees sensibles en `private, no-store`.
- Referer limite pour les liens secrets ; format canonique des signatures de cookies.
- HSTS, anti-cadrage, nosniff et controles d'origine conserves.
- Recherche des secrets courants dans les fichiers suivis et analyse des graphes
  d'import client : aucune exposition confirmee dans les chemins examines.
- Aucune injection SQL/OS ou XSS exploitable confirmee dans ce perimetre ; ce constat
  n'equivaut pas a un pentest exhaustif ni a une preuve d'absence de failles.

Fichiers importants : routes `app/api/client/`, `app/api/admin/credentials/`,
`app/api/admin/auth/`, `app/api/chat/`, `app/api/cron/cleanup/`, `proxy.ts`,
`next.config.ts`, `lib/requestJson.ts`, `lib/clientAuth.ts`, `lib/adminFreshness.ts`,
`lib/adminCredentials.ts`, `lib/revocableAdminSession.ts`.

## 7. E-mails de compte et jetons

- Renvoi de confirmation maintenant accessible avant connexion avec une adresse e-mail.
- Limitation par IP et empreinte d'adresse, reponse neutre et ecriture conditionnelle.
- Nouveaux jetons stockes sous forme d'empreintes SHA-256 liees a leur usage.
- Expiration des nouveaux liens : 24 h pour confirmation/changement d'e-mail,
  1 h pour reset ; anciens liens compatibles jusqu'a leur expiration historique.
- Envois de compte geres par Next `after`, avec delais bornes, trois tentatives
  maximum en cas d'erreur temporaire et cle d'idempotence conservee.
- Acceptation technique seulement avec identifiant du prestataire.
- Changement d'e-mail : refus explicite si l'envoi n'est pas confirme, sans annoncer
  que l'adresse principale a deja change.
- Message de suppression du compte clarifie sur les commandes/factures/support
  conserves et sur les abonnements qui ne sont pas automatiquement resilies.

Limite : les tentatives des e-mails de compte ne forment pas une file persistante
resistante a un arret du processus. Elles sont distinctes des jobs durables de
commandes. Une acceptation Resend n'est pas une preuve de reception/activation.

Fichiers : `lib/accountTokens.ts`, `lib/accountEmail.ts`, `lib/nodemailer.ts`,
routes de comptes, `components/admin/AdminReauthentication.tsx` et `app/page.tsx`.

## 8. Commandes, livraison, migration et essais anterieurs

Les elements suivants proviennent des comptes rendus du 7 octobre ; les comptes
cloud et donnees de production n'ont pas ete recontroles pour cette transmission.

- Preparation d'un schema additif : `StockReservation`, `DeliveryJob`,
  `PaymentRecord`, `AdminSession` ; script `prisma/remediation/20261007_additive.sql`.
- Reservations avant paiement, expiration et traitement des paiements tardifs.
- Historique de paiements avec reference unique et montants en centimes.
- Jobs de livraison/relance avec reprises, idempotence et prise en charge concurrente.
- Facture initiale et numero crees atomiquement ; preuve de facturation chiffree.
- Place conservee jusqu'a confirmation du retrait effectif d'acces fournisseur.
- Relances devenues obsoletes apres paiement/annulation : pas de nouvel envoi.
- Endpoints de livraison/cron proteges ; alertes Telegram minimisees.
- Snapshot Neon puis restauration sur une branche distincte et comparaison des
  12 tables historiques. Le compte rendu indique ensuite l'application du SQL
  additif en production avec quatre tables ajoutees et preuves de donnees inchangees.
- Les interventions #82 a #85 n'ont pas ajoute de nouvelle migration de production.
- Snapshot fournisseur teste, pas un export independant de Neon ; politique de
  sauvegarde actuelle et capacite de restauration a reverifier.
- Tests directs Stripe en sandbox : paiement accepte/refuse, renouvellement,
  echec et resiliation fictifs, sans debit reel.
- Test Resend autorise : domaine verifie a cette date, message technique sans
  commande recu en boite principale selon confirmation du proprietaire ;
  idempotence du rejeu verifiee.
- Ces essais directs ne reliaient pas un webhook sandbox a une instance isolee
  du site. Ils ne prouvent donc pas le parcours applicatif complet.
- Aucun ordonnanceur frequent de livraison n'a ete valide en exploitation.
  Le cron quotidien de nettoyage ne suffit pas a prouver une livraison rapide.

Sources : `docs/rollout-verification-2026-10-07.md` et `docs/audit-remediation-rollout.md`.
Le premier est posterieur aux etapes de preparation du second : ne pas confondre
"migration preparee" puis "migration appliquee" avec une contradiction simultanee.

## 9. Dependances : alerte historique resolue dans la branche

L'ancienne chaine `eslint-config-next -> plugin Next -> fast-glob -> micromatch ->
braces` remontait comme cinq paquets affectes par une meme vulnerabilite.

Correction du 14 octobre : implementation retiree du graphe installe, remplacee
uniquement pour le plugin Next 16.3.8 par `tooling/next-lint-glob` et tinyglobby
0.2.17. L'adaptateur preserve les dossiers litteraux et l'absence d'expansion
implicite, et refuse les formes d'appel non supportees.

- Override limite a la version de plugin examinee et fichier de verrouillage mis a jour.
- Installation propre `npm ci` verifiee sur Windows et dans la CI Linux.
- Tests du graphe de dependances et des vraies regles Next, pas seulement du helper.
- Pas de retrogradation vers Next 14, d'exception d'audit ou de regle retiree.
- Audit complet repasse avec zero alerte connue a cette date.
- Le plugin n'est pas un remplacement general de toutes les API fast-glob.
  Reexaminer cet adaptateur lors d'une mise a jour Next, puis le retirer quand
  une chaine officielle compatible est disponible.

Les anciens rapports disant que l'audit est rouge decrivent l'etat anterieur a
ce correctif. **Relancer l'audit aujourd'hui : le resultat d'octobre peut vieillir.**

## 10. Dernieres validations disponibles

Commit : `67742532c14093a4c10fdffc40f7d4e06dacbc4c`, le 14 octobre 2026.

| Controle | Dernier resultat constate |
| --- | --- |
| Installation propre | npm ci reussi |
| Tests unitaires | 104/104, aucun echec |
| Tests PostgreSQL | 15/15 sur base jetable |
| Lint | Reussi |
| Build de production et TypeScript | Reussis |
| Audit complet des dependances | Zero alerte connue a cette execution |
| Pipeline Quality #21 | Termine avec succes |
| Preview Vercel du commit | Succes |
| Fusion dans main | Non effectuee, PR encore ouverte au 13 novembre |
| Parcours d'achat applicatif complet avec vrais services de test | Reste a valider |

Pipeline : https://github.com/Demiro89/landing-page/actions/runs/38528364381

Preview : https://vercel.com/demiro89s-projects/landing-page/C4o7foFnFTt39rw3NF95LUoRX3Bk

Les tests couvrent notamment derniere place concurrente, notifications signees,
rejeu de paiement, reservation tardive, livraison en echec/reprise, regularisation,
liens de compte rejoues, changements simultanes, verrouillage et revocation.
Les prestataires sont simules dans les tests PostgreSQL, meme quand le vrai SDK
verifie une signature. Ne pas assimiler ces tests a un paiement sandbox de bout en bout.

Controles navigateur anterieurs : accueil, offres, checkout, consentements,
contact, compte, admin, erreurs/vides/stock epuise, clavier et mobile.
Les fixtures affichent des donnees de demonstration et ne prouvent ni stock reel,
ni fonctionnement des prestataires en production.

## 11. Reprise d'audit demandee a Gemini

Tu es charge de poursuivre independamment l'audit de StreamMalin et d'appliquer
les correctifs justifies. Ce rapport fournit des pistes et des preuves historiques,
pas des conclusions a accepter sans examen du code courant.

### Premiere passe : etablir la situation reelle

1. Lire les instructions du depot, les rapports et la PR #85 ; recuperer main et
   la branche de travail. Verifier les modifications utilisateur avant toute edition.
2. Identifier le commit reel de main, de la preview et de la production. Signaler
   les differences. Ne pas supposer que le site public correspond a la branche.
3. Actualiser les alertes de dependances et verifier l'adaptateur ESLint sur une
   installation propre. Ne pas refaire une refonte deja terminee sans probleme constate.

### Priorites fonctionnelles et de securite

1. Tester une instance isolee avec base de test et sandbox Stripe : paiement
   accepte/refuse, retour navigateur, webhook, stock reserve/expire, paiement
   concurrent/tardif, facture, livraison, reprise, renouvellement et resiliation.
2. Verifier les vrais jobs et la frequence du traitement de livraison, leurs
   alertes, l'idempotence et les procedures de revue/remboursement.
3. Tester reception des e-mails inscription/reset/changement d'adresse avec une
   boite autorisee ; liens expires/rejoues ; renvoi sans connexion ; interruption serveur.
4. Verifier authentification, MFA, fixation/revocation de sessions, confirmation
   recente et controles de propriete sur commandes, factures, chat et exports.
5. Rechercher injections/XSS, fuite de secrets dans imports/bundles/logs, CSRF,
   corps excessifs, erreurs detaillees et contournements de limitation distribues.
6. Verifier les en-tetes reels, cookies et reponses precoces sur l'environnement
   deployee pertinent, sans scanner agressivement ou tester sur des clients reels.
7. Examiner la suppression de compte avec abonnement actif, le droit d'effacement,
   les preuves conservees, leur acces et leurs durees de conservation effectives.
8. Verifier facturation des renouvellements, remboursements et rapprochement
   PayPal/crypto si proposes. Une reference saisie n'est pas une preuve autonome.
9. Examiner la pagination serveur des grandes listes et les courses non couvertes,
   y compris nettoyage de compte pendant une recuperation d'acces.

### Design, accessibilite, performance et conversion

1. Tester accueil, fiches, choix d'offre, checkout, connexion et support sur mobile
   et ordinateur, y compris chargement lent, erreur, vide et stock epuise.
2. Verifier lisibilite, prix total, duree/reconduction, type d'acces, eligibilite,
   focus, clavier, contraste, messages d'erreur et absence de chevauchement.
3. Examiner navigation et formulaires admin sur des volumes realistes, sans
   enlever les protections de confirmation ou changer la logique des paiements.
4. Controler images, poids JavaScript, chargements et Core Web Vitals avec mesures.
5. Revoir les URL canoniques des pages secondaires, metadata et sitemap ; les
   espaces prives doivent rester exclus de l'indexation.
6. Proposer une mesure du tunnel respectueuse du consentement : visites qualifiees,
   consultations d'offre, debuts de checkout, paiements confirmes, abandons et erreurs.
   Aucun taux de conversion de 2 a 3 % ne peut etre garanti sans donnees et offre validee.

### Contraintes a respecter

- Le proprietaire souhaite une execution autonome et econome : corriger par lots
  coherents, eviter les recherches redondantes et garder les tests lies aux risques.
- L'autorisation de corriger et fusionner a ete donnee dans la conversation.
  Revalider les checks et la bonne base avant fusion ; expliquer le resultat exact.
- Ne pas detruire de donnees, supprimer l'historique ou exposer de secrets.
- Ne pas lancer `db push`/migration sur la production par automatisme. Pour une
  evolution importante, proposer les champs/contraintes et la procedure avant application,
  avec sauvegarde recente et restauration verifiee.
- Conserver les offres sans autorisation de distribution indisponibles ; ne pas
  approuver soi-meme les droits fournisseur, la TVA ou l'adhesion au mediateur.
- Faire saisir les mots de passe et nouveaux secrets par le proprietaire dans les
  services concernes. Ne pas les demander dans le chat ou les ajouter au depot.
- Garder le code d'acces et les interrupteurs commerciaux selon leur configuration
  autorisee ; leur activation n'est pas deduite d'un build reussi.
- Tester paiements et suppressions sur donnees fictives, sans debit reel.
- Aucun avis invente, faux compteur, urgence artificielle ou promesse absolue.

### Livrable attendu de Gemini

Pour chaque constat : gravite, fichier/ligne, condition de reproduction, impact,
correctif applique, preuve de test et limite restante. Distinguer observation,
hypothese et test non execute ; ne pas declarer "tout est securise".

Executer installation propre si necessaire, lint, tests, audit des dependances et
build ; integration PostgreSQL uniquement sur base isolee. Ajouter des tests de
regression utiles aux failles et contrats modifies, puis verifier le rendu des UI changees.

Terminer par le commit, la branche/PR, l'etat reel de fusion/deploiement, les
resultats de controles et les actions necessitant encore une preuve externe.

## 12. Sources a lire dans le depot

- `docs/security-design-audit.md` : audit initial.
- `docs/audit-remediation-rollout.md` : architecture et preparation du schema.
- `docs/rollout-verification-2026-10-07.md` : controles Neon et essais prestataires.
- `docs/streaming-experience.md` : refonte publique et tests visuels.
- `docs/admin-security-design-audit-2026-10-08.md` : admin et risques restants a cette date.
- `docs/appsec-audit-2026-10-09.md` : constats AS-01 a AS-11 et extraits de patches.
- `docs/account-email-hardening-2026-10-12.md` : comptes, e-mails, sessions et cloture
  ulterieure de l'alerte de developpement.
- `tooling/next-lint-glob/README.md` : justification et limites de l'adaptateur.
- Diff de la PR #85 : inventaire complet des 100 fichiers de la livraison.

Les rapports sont dates et cumulatifs. Les constats de la version courante et le
pipeline final prennent le pas sur un avertissement historique deja corrige.
