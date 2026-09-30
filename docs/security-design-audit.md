# StreamMalin : audit securite et interface

Date : 30 septembre 2026. Base : `origin/main`, commit `765fedf` (PR #78).
Branche : `codex/security-design-audit`.

Cet audit porte sur le code, les dependances et une execution locale isolee.
Ce n'est ni une certification de securite ni une validation juridique.
Aucun paiement, envoi reel, changement de secret, nettoyage de production ou
migration de donnees n'a ete execute. Le schema Prisma reste inchange.

## Problemes corriges

| Priorite | Probleme constate | Correction |
| --- | --- | --- |
| P1 | Next.js 16.2.6 affecte par des avis de securite, dont RCE Windows et traitement AVIF | Next.js et eslint-config-next 16.3.7, corrections transitives compatibles, retrait du transport SMTP inutilise |
| P1 | Le build executait `prisma db push` | Build sans mutation de schema ; commande `db:push` explicite et separee |
| P1 | Identifiants consultables via profil/export pour commandes impayees ou annulees | Acces uniquement pour commandes actives ou en fin de periode payee ; chat client sans copie de l'ordre et de ses identifiants |
| P1 | Appartenance parfois verifiee seulement par email | Proprietaire explicite prioritaire sur email pour chat, facture, portail, migration et resiliation ; rattachement seulement apres verification du compte |
| P1 | Changement historique SHA-256 vers scrypt sous le meme format `enc:v1` | Lecture authentifiee des deux anciennes derives, nouvelles ecritures `enc:v2`, refus des valeurs corrompues ; pas de rotation de cle |
| P1 | Secret 2FA fourni par le navigateur, remplacement possible et consommation non atomique | Secret d'inscription temporaire en base, expiration, verification et compteur sous verrou transactionnel ; remplacement exige la desactivation avec facteur valide |
| P1 | Double validation/cancellation et stock fondes sur un etat lu avant la transaction | Transitions conditionnelles, verrou de commande, comparaison avec capacite actuelle du stock et liberation idempotente |
| P1 | Marqueur webhook independant des mutations, supprimable apres une erreur post-commit | Marqueur et mutations dans une transaction ; aucun effacement de marqueur valide, evenements non payes sans livraison |
| P1 | Resiliation locale ne stoppant pas toujours le prelevement Stripe | Mise a jour de Stripe avant confirmation locale ; refus si Stripe indisponible |
| P2 | Webhooks/cron bloques par la porte d'acces du site | Exceptions exactes pour les deux routes ; signature Stripe et Bearer cron toujours obligatoires |
| P2 | Consentements permissifs, gateway desactivee encore utilisable par API | Trois booleens stricts, validation des identifiants/emails, stock/service/prix et destination de paiement controles cote serveur |
| P2 | Commande manuelle d'un tiers reutilisable et preuves modifiables | Reutilisation seulement pour proprietaire verifie, meme offre/email/methode/prix ; aucune reecriture des preuves |
| P2 | Limiteur de debit vulnerable aux premieres requetes simultanees et aux IP falsifiees hors proxy fiable | Increment SQL atomique ; confiance aux en-tetes uniquement sur Vercel ou proxy explicitement configure |
| P2 | Emails de simulation contenant des acces ou liens prives dans les logs ; HTML non echappe | Aucune donnee privee journalisee par les simulations ; interpolation HTML echappee |
| P2 | Prix checkout tire du premier stock au lieu du stock choisi ; conversion crypto fictive | Prix de la place selectionnee ; pas de montant crypto issu d'un taux de secours, refus d'un taux trop ancien |
| P2 | Statuts ressuscites par paiement/relance ; edition de stock perimee | Conditions de statut, notifications seulement apres transition ; version `updatedAt` obligatoire lors de modification |
| P2 | Ancien email pouvant servir de rattachement apres changement d'adresse | Rattachement des commandes historiques et invalidation des sessions dans la transaction de changement d'email |
| P3 | Panne catalogue confondue avec absence de stock, erreurs reseau non visibles | Etats distincts, actions de nouvelle tentative, alertes admin et login |
| P3 | Interface chargee, faible hierarchie mobile et chiffres admin presentes comme comptabilite reelle | Surfaces sobres, contraste, navigation et focus accessibles, titres compacts, marges identifiees comme indicatives |

## Risques restants, par priorite

### P1 : paiement confirme alors que la derniere place n'est plus disponible

Les gardes transactionnelles evitent le sur-remplissage, mais ne reservent pas
la place entre creation du checkout et reception du paiement. Plusieurs clients
peuvent donc payer pour la meme derniere place. Le webhook echoue de facon
relancable et alerte le support, mais cela ne constitue pas une resolution du
paiement. Ne pas augmenter les ventes avant validation d'une strategie de
reservation et de remboursement/reconciliation.

Migration proposee, NON appliquee : `StockReservation` avec `id`,
`stockAccountId`, `orderId` optionnel, `checkoutSessionId` unique, `quantity`,
`status`, `expiresAt`, `createdAt`, `consumedAt`. La reservation, le calcul de
capacite, l'expiration et la consommation doivent partager un protocole
transactionnel documente. Traiter le paiement tardif, le remboursement
idempotent et l'abonnement orphelin sans livrer de faux acces.

### P1/P2 : livraison externe et factures sans reprise durable

La commande est validee avant l'appel email/facture. Si le prestataire echoue,
le paiement et la commande restent acquis mais la livraison n'a pas de file de
reprise durable. Certains appels ignorent le retour `success: false`.

Migration proposee, NON appliquee : `DeliveryJob`/outbox avec `id`, `orderId`,
`eventId` ou cle d'idempotence unique, `kind`, `status`, `attempts`,
`nextAttemptAt`, `lastError` redige sans secrets, `createdAt`, `deliveredAt`.
Inserer le travail dans la transaction de commande, puis traiter avec reprises
et alerte. Ne pas dupliquer les identifiants en clair dans la file.

### P2 : points operationnels a traiter

- Les resiliations manuelles `cancelled_pending` necessitent une finalisation admin a la date effective ; le cron actuel ne les cloture pas. Les acces deja transmis doivent aussi etre retires chez la plateforme : cacher le mot de passe dans l'UI n'est pas une revocation de profil.
- Les notifications/livraisons de commandes historiques utilisent encore leur email contractuel initial apres changement d'adresse. Distinguer adresse de livraison et preuve immuable avant de modifier ce comportement.
- Une session admin volee reste valide jusqu'a expiration (24 h) ou rotation du secret ; logout efface le cookie local, sans registre de revocation serveur. Prevoir sessions revocables et reauthentification pour les actions sensibles.
- L'ordre des evenements Stripe doit etre teste : suppression avant creation, echec apres paiement reussi, migration pendant resiliation. Les transitions ajoutees ne sont pas une reconciliation exhaustive de l'etat Stripe.
- La crypto reste verifiee manuellement. Le reseau, l'adresse, le devis et l'identifiant de transaction ne sont pas tous enregistres dans le modele ; ne pas assimiler conversion navigateur et preuve de paiement.
- Les KPIs admin ne constituent pas un journal de paiements : les totaux incluent tous les statuts, les marges sont estimees, et le modele n'emet qu'une facture par commande, pas par renouvellement.
- Les variables/cles de production, sauvegardes, droits SQL, configuration proxy, protections Vercel, limites prestataires et journaux heberges n'ont pas pu etre verifies sans acces a l'infrastructure.
- Hors Vercel, ne definir `TRUSTED_PROXY_HEADERS=true` que si le proxy remplace ces en-tetes et bloque les connexions directes ; sinon le rate limit partage volontairement le groupe `unknown`.
- Ne jamais remplacer `ENCRYPTION_KEY` pour satisfaire une longueur minimale sur une base existante : une rotation exige sauvegarde et migration explicites.

## Validations

- `npm test` : 27 tests passes, avec dependances controlees et sans base de production.
- `npm run lint` : aucun probleme a la derniere execution ; a relancer apres toute modification.
- `npm run build` : compilation complete avec le moteur Prisma binaire local (Windows ARM) ; aucun `db push`.
- `npm audit` : aucune vulnerabilite connue lors de la verification ; ce resultat n'est pas une garantie future.
- Interface locale : offres fictives, stock vide, erreur API, prix du second stock a 4,49 EUR, confirmations 0/1/2/3, gateway crypto desactivee et menu mobile.
- Les tests de concurrence utilisent des doubles : ils ne remplacent PAS des transactions simultanees sur PostgreSQL ni un parcours Stripe de test.
- CI ajoutee : installation verrouillee, lint, tests, audit et build ; aucune base ni cle de production requise.

## Verification avant merge et deploiement

1. Executer la CI et deployer une preview utilisant une base de test isolee, les cles Stripe de test et un destinataire email de test.
2. Verifier qu'une seule de deux validations simultanees passe pour la derniere place ; rejouer validation et annulation ; verifier que le stock ne devient ni negatif ni superieur a sa capacite.
3. Tester Stripe signe, non signe, double, retarde, asynchrone, hors ordre, renouvellement, impaye, migration et resiliation ; traiter le paiement sans stock avant lancement commercial.
4. Tester qu'un compte non verifie ou un autre proprietaire n'accede ni aux identifiants, ni au chat, ni a la facture ; verifier changement d'email et expiration de session.
5. Tester setup/activation/desactivation 2FA, secret forge, code rejoue et deux connexions avec le meme code ; aucune valeur 2FA ne doit sortir des settings publics.
6. Verifier la lecture des anciennes donnees chiffrees sur une copie de sauvegarde ; ne lancer aucun script de chiffrement sur la production sans sauvegarde.
7. Confirmer l'envoi et la reception d'emails, l'expediteur Resend, la signature webhook et le Bearer cron ; aucune simulation en production.
8. Verifier visuellement vitrine, checkout, compte, pages legales et admin sur mobile/desktop, clavier, zoom et reduction des animations.

## Sources des avis de dependances

- [Avis officiel Next.js : Windows RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36).
- [Avis officiel Next.js : AVIF](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).
- [En-tetes IP Vercel](https://vercel.com/docs/headers/request-headers).
- [Etat du paiement Stripe Checkout](https://docs.stripe.com/api/checkout/sessions).
