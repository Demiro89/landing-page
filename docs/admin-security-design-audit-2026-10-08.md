# StreamMalin : nouvel audit et refonte de l'administration

Date : 8 octobre 2026. Branche : `codex/admin-experience-audit`.

## Conclusion

L'administration est plus lisible et plusieurs erreurs de sécurité et de suivi ont été corrigées. Cela ne signifie pas que le site est prêt à vendre sans autre vérification. Les autorisations de distribution, le parcours de paiement réel en environnement d'essai et l'organisation de la livraison restent des conditions de mise en service.

Cette intervention ne modifie aucune donnée de production, n'exécute aucune migration et n'active ni les ventes ni le traitement automatique des livraisons. Aucune fusion ni mise en production n'a été demandée dans cette nouvelle tâche.

## Périmètre et limites

- Relecture des protections d'accès, sessions, double authentification, origine des requêtes, secrets, stockage des accès, checkout, réservations, confirmations de paiement, factures, livraison, support, renouvellements et résiliations.
- Relecture des pages publiques, offres, comparateur d'économies, contact, footer et documents légaux dans le code.
- Parcours des douze vues de l'admin, des cinq vues de suivi et des principaux formulaires dans un aperçu local compilé, avec des données entièrement fictives. Les écritures y sont refusées volontairement.
- Vérification des états vide, indisponible et erreur, des filtres, du menu mobile, des fenêtres de dialogue et du clavier.
- Audit des dépendances et tests automatisés. Ce travail n'est ni un test d'intrusion externe ni une certification juridique.
- La branche reprend la refonte publique de la PR #82, encore non fusionnée lors de l'audit. Le code examiné n'est donc pas entièrement celui publié sur `main`.
- Les vérifications Neon, Stripe et Resend du 7 octobre sont consignées dans `rollout-verification-2026-10-07.md`. Elles ne sont pas présentées comme de nouveaux tests de production réalisés aujourd'hui.

## Risques corrigés

### Priorité élevée : validation manuelle d'un paiement Stripe

Dans le mode historique, le refus d'une validation manuelle Stripe arrivait après la transaction d'activation. Un refus HTTP pouvait donc arriver après une modification de commande. Le contrôle est désormais placé avant toute transaction, avec reconnaissance du moyen de paiement Stripe même lorsque l'identifiant d'abonnement est absent.

Fichiers : `app/api/admin/stock/route.ts`, `lib/adminPresentation.ts`.

Test : aucune écriture pour une validation manuelle Stripe, dans les deux modes de fonctionnement.

### Priorité élevée : changement de mot de passe et anciennes sessions

Le mot de passe et la version des sessions étaient mis à jour séparément. Une panne intermédiaire pouvait laisser d'anciennes sessions utilisables. Les deux mises à jour sont maintenant indissociables. Le lien de réinitialisation est consommé dans la même transaction, avec contrôle de son expiration au moment de l'écriture. Les demandes de changement d'adresse e-mail en cours sont invalidées.

Un changement d'adresse e-mail refuse aussi un mot de passe ou une session devenus obsolètes entre la vérification et l'écriture. La confirmation d'adresse contrôle à nouveau son expiration et l'adresse attendue.

Fichiers : les quatre routes de changement de mot de passe, réinitialisation, changement d'e-mail et confirmation d'e-mail.

Tests : version de session incrémentée dans la transaction, conflit concurrent refusé, lien rejoué refusé, aucune nouvelle session en cas de conflit.

### Priorité importante : régularisation manuelle sans nouvelle preuve de paiement

Avec le suivi durable activé, la régularisation d'une commande impayée exige maintenant une nouvelle référence vérifiée. Une ancienne référence ne peut pas régler un nouvel épisode d'impayé. La preuve et le retour au statut actif sont enregistrés dans la même transaction. Stripe reste exclu de cette action manuelle.

Le montant enregistré est le prix mensuel attendu de la commande, confirmé par l'administrateur. Ce mécanisme ne détecte pas lui-même un virement PayPal ou crypto, un paiement partiel, une conversion de devise ou des frais réseau. Il ne remplace pas un rapprochement avec le prestataire.

Fichier : `app/api/admin/stock/route.ts`.

Tests : preuve en centimes, référence obligatoire, référence déjà utilisée refusée. Un test PostgreSQL supplémentaire couvre deux régularisations concurrentes et le rejeu d'un ancien reçu.

### Priorité importante : messages de réussite trompeurs

Certaines actions de stock, services ou paramètres semblaient réussir sans vérifier la réponse HTTP. Le support pouvait perdre le texte d'une réponse refusée. Un transport commun traite maintenant les erreurs HTTP, les pannes réseau et les réponses non JSON comme des échecs explicites, sans réessayer automatiquement une écriture.

Une action au résultat incertain bloque les modifications jusqu'à l'actualisation. Les réglages ne changent pas visuellement avant la confirmation du serveur. Les traitements groupés s'arrêtent sur une erreur serveur ; les éléments restants sont signalés comme non réussis. Le brouillon du support reste présent après un refus.

Le changement d'adresse e-mail attend aussi la réponse du prestataire : un refus n'est plus annoncé comme un message envoyé. Une acceptation du prestataire n'est pas assimilée à une réception en boîte.

Fichiers : `lib/adminResponse.ts`, `components/admin/useAdminActions.ts`, `app/admin/page.tsx`, `components/admin/OperationsPanel.tsx`, `app/api/client/change-email/route.ts`.

### Priorité importante : confidentialité et écritures sensibles

- Les documents `/admin` reçoivent maintenant `Cache-Control: private, no-store` comme les API et factures privées.
- Les limitations des écritures stock et paramètres refusent désormais l'action lorsque le stockage de limitation est indisponible.
- L'activation d'un service exige un vrai booléen côté serveur.
- Les identifiants ne sont plus affichés par défaut dans les listes. Leur masquage reste une protection visuelle, pas une nouvelle frontière de sécurité : voir les travaux restants.

Fichiers : `proxy.ts`, routes stock et paramètres, admin.

### Priorité de fiabilité : statuts et chiffres

Les commandes en attente, paiements à vérifier et statuts inconnus ne sont plus affichés comme actifs. Les commandes non validées sont exclues des montants initiaux présentés dans les clients et exports.

Les indicateurs sont nommés « montants initiaux validés » et « marge indicative ». Ils ne prétendent plus représenter un chiffre d'affaires encaissé ou un bénéfice comptable. Ils ne comprennent pas tous les renouvellements, remboursements, taxes et frais. Un chargement en échec n'affiche pas de faux indicateurs à zéro.

Fichiers : `lib/adminPresentation.ts`, `components/admin/OrderStatus.tsx`, admin, routes clients et exports.

## Refonte graphique de l'administration

- Interface claire, fonds sobres, couleurs distinctes pour les alertes, navigation regroupée par tâches.
- Les commandes à traiter passent avant le graphique indicatif. Accès direct aux paiements à vérifier.
- Tableau de commandes avec recherche, filtre de statut, nombre de résultats et pagination.
- Création de services et stocks repliée par défaut, pour donner priorité aux éléments existants.
- Icônes d'action, libellés de champs associés, états sélectionnés et focus visibles.
- Fenêtres natives avec focus clavier, fermeture par Échap et retour au déclencheur.
- Menu mobile, formulaires adaptables, tableaux défilant dans leur propre zone et champs numériques stables.
- Vérifications commerciales, transmissions, paiements, sessions et rétractations dans des vues distinctes.
- Les actions d'activation des ventes, de validation de droits fournisseur et de retrait d'accès gardent leurs confirmations. Aucun nouveau bouton ne permet de contourner les contrôles serveur.

## Points forts conservés

- Code d'accès public conservé ; un code d'accès ne remplace pas l'authentification admin.
- Double authentification, contrôles d'origine des écritures, sessions signées, protections contre le rejeu et secrets de session obligatoires.
- Aucune variable serveur détectée dans les graphes d'import client analysés ; imports de types serveur exclus de l'analyse des imports exécutés.
- Trois consentements contrôlés côté client et côté serveur. Version des CGV contrôlée côté serveur et preuves horodatées conservées.
- Checkout dépendant des réglages de mise en service et de la vérification commerciale de chaque offre.
- Réservations de stock, verrouillages, preuves de paiement et marqueurs d'événements conservés ; pas d'activation fondée uniquement sur une page de retour de paiement.
- Accès fournisseur chiffrés en base ; réponses client limitées aux commandes appartenant au client et aux accès autorisés.
- Footer avec les neuf pages légales attendues ; CGV versionnées, non-affiliation et droits légaux conservés dans les textes relus.
- Calcul des économies conditionné à une référence comparable, datée et vérifiable ; pas d'économie fabriquée en l'absence d'offre valable.
- Installation et compilation sans `prisma db push` ni migration automatique de production.

## Travaux restants avant l'ouverture des ventes

### 1. Autorisations fournisseur et informations de l'entreprise

Ne pas ouvrir une offre sans autorisation de distribution vérifiée et conditions d'éligibilité précises. Surfshark et toute offre non vérifiée restent indisponibles. Un catalogue prédéfini ou une case admin n'est pas une autorisation.

Faire vérifier les justificatifs d'immatriculation, l'adhésion effective au médiateur indiqué et la mention de TVA. Les informations affichées ne sont pas certifiées par cet audit. Faire valider les conditions des accès réellement commercialisés et les droits de rétractation par une personne compétente.

### 2. Parcours applicatif complet en environnement d'essai

Tester le site lui-même, pas seulement les tableaux de bord des prestataires : commande, paiement accepté/refusé, réception du webhook, réservation expirée, facture, transmission, panne du prestataire e-mail, reprise, renouvellement réussi/échoué, résiliation et retrait effectif chez le fournisseur.

Les essais doivent rester sans débit réel et avec une base dédiée. Les tests PostgreSQL simulent les appels fournisseur et ne remplacent pas ce parcours. Ne pas activer les réglages de mise en service avant cette validation.

### 3. Livraison et rappels

Vérifier la fréquence et la supervision du traitement de la file. La tâche quotidienne de nettoyage n'est pas une preuve d'une livraison rapide. Le mode historique transmet encore certains e-mails directement, sans le suivi durable de livraison. Une validation de paiement n'est pas une preuve que le client a reçu et utilisé son accès.

Le fournisseur doit confirmer les invitations et retraits effectifs. Une place ne doit pas être réutilisée seulement parce qu'une résiliation est affichée.

Sources : `app/api/cron/cleanup/route.ts`, `app/api/cron/deliveries/route.ts`, `lib/deliveryWorker.ts`, `app/api/admin/stock/route.ts`.

### 4. Suppression de compte et abonnement encore actif

La route de suppression détache les commandes et supprime le compte, mais ne résilie pas elle-même un abonnement Stripe ou l'accès fournisseur. Cela doit être clarifié dans le parcours : demande d'effacement, conservation légitime des preuves et gestion des prélèvements sont des opérations distinctes. Prévoir une procédure sans supprimer l'historique contractuel ni bloquer indéfiniment l'exercice des droits.

Une confirmation du mot de passe récent pour cette opération sensible est également recommandée. Ne pas tester une suppression sur un client réel pour vérifier ce comportement.

Source : `app/api/client/delete-account/route.ts`.

### 5. Comptabilité, crypto et renouvellements

Le modèle de facture reste limité à une facture par commande. Le journal de paiements ne suffit pas à prouver que chaque renouvellement dispose de sa facture et de son rapprochement comptable. Les réglages actuels ne constituent pas une prise en charge complète des remboursements.

Pour la crypto, il reste à définir et vérifier réseau, devise, destinataire, conversion, frais et reçu de transaction. Ne pas déduire un paiement de la seule saisie d'une référence. Toute extension du modèle nécessitera une proposition additive séparée et une sauvegarde vérifiée avant application.

Sources : `prisma/schema.prisma`, `lib/invoice.ts`, routes checkout manuel et stock.

### 6. Minimisation des données et volume

L'API stock charge encore toutes les commandes et déchiffre tous les accès pour l'administrateur. Le masquage à l'écran ne les retire pas de la réponse réseau. Avant de multiplier les comptes admin ou d'augmenter le volume, séparer la consultation d'identifiants à la demande, prévoir une confirmation récente d'identité et journaliser cette consultation sans enregistrer le secret.

Prévoir une pagination côté serveur pour commandes, clients et conversations. Les listes de 100 paiements/tâches et de 200 événements d'audit sont clairement limitées ; elles ne représentent pas tout l'historique.

Sources : `app/api/admin/stock/route.ts`, `app/api/chat/route.ts`, `app/api/admin/operations/route.ts`.

### 7. Dépendances de développement

L'audit des dépendances de production retourne zéro alerte connue à cette date. L'audit incluant le développement retourne cinq alertes de sévérité élevée dans la chaîne `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next`.

Il s'agit d'une même vulnérabilité propagée par les dépendances, pas de cinq failles indépendantes confirmées dans le site. L'[avis GitHub GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) ne liste aucune version corrigée de `braces`. La correction forcée proposée rétrograde `eslint-config-next` à Next 14 ; elle n'est pas appliquée à ce projet Next 16.

Le contrôle de sécurité automatique reste bloquant et doit être conservé. Prévoir une mise à jour compatible dès qu'elle est disponible, avec nouveaux tests. Ne pas ouvrir l'accès au serveur de développement et ne pas traiter des motifs de fichiers non fiables dans cette chaîne.

### 8. Site public, référencement et conversion

L'accueil et les fiches de la PR #82 restent centrés sur la location streaming. Une autorisation fournisseur, une offre disponible, un prix compréhensible et un achat réellement livrable passent avant davantage de décoration.

Des pages secondaires héritent encore de la référence canonique de l'accueil lorsqu'elles n'ont pas de référence propre ; corriger ce référencement lors de leur prochaine intervention. Les espaces privés restent non indexables.

Le site étant protégé et sans ventes déclarées, aucun taux de conversion actuel ni objectif de 2 à 3 % ne peut être confirmé. Après ouverture autorisée : mesurer visites pertinentes, offres consultées, débuts de commande, paiements confirmés, abandons, erreurs et demandes au support. N'ajouter ni avis fictifs, ni urgence artificielle, ni promesse absolue.

## Validation et livraison

- `npm test` : 75 tests réussis, aucun échec.
- `npm run lint` : réussi, aucune erreur ni avertissement lors de la vérification.
- `npm run build` : compilation de production réussie, TypeScript validé. Cette commande génère le client Prisma mais ne modifie pas la base.
- `npm audit --omit=dev --audit-level=high` : zéro vulnérabilité signalée.
- `npm audit --audit-level=high` : échec connu sur les cinq alertes de développement décrites ci-dessus. Ne pas présenter tous les contrôles comme verts.
- Un test PostgreSQL de concurrence ajouté. PostgreSQL local non exécuté : moteur Docker indisponible. Le workflow existant l'exécute sur une base jetable dans GitHub Actions ; son résultat doit être vérifié sur la PR.
- Vérification visuelle sur ordinateur et mobile, notamment largeur 320 et 390 pixels. Le refus d'un changement de passerelle conserve la valeur antérieure ; une réponse support refusée conserve le brouillon. Les fenêtres sont fermées par Échap et rendent le focus.
- Pas de changement des dépendances, du schéma Prisma, des secrets, des réglages Vercel/Neon ni des données réelles.

Ordre de revue : examiner puis fusionner la PR publique #82 si elle est validée ; réorienter ensuite la PR admin vers `main` et relancer les contrôles. Ne pas fusionner la PR admin dans la branche publique par inadvertance. Toute mise en production doit conserver les ventes fermées jusqu'à validation des points de mise en service ci-dessus.

## Fichiers de cette intervention

Administration : `app/admin/page.tsx`, `app/admin/layout.tsx`, `app/admin/login/page.tsx`, `app/admin/admin-experience.css`.

Composants et aides : `components/admin/AdminActivityChart.tsx`, `AdminDialog.tsx`, `OrderStatus.tsx`, `OperationsPanel.tsx`, `useAdminActions.ts`, `lib/adminPresentation.ts`, `lib/adminResponse.ts`.

API : routes admin `clients`, `export`, `settings`, `stock` ; routes client `change-email`, `change-password`, `reset-password`, `verify-email-change` ; `proxy.ts`.

Vérification : `tests/admin-experience.test.cjs`, `tests/order-security.test.cjs`, `tests/postgres-payments.cjs`, `tests/ui-preview.cjs` et ce rapport. Les captures d'aperçu utilisent uniquement des données fictives et sont conservées localement sous `artifacts/admin-experience/`.
