# Comptes, e-mails et confirmation administrateur

Date : 12 octobre 2026 ; resultats finalises le 14 octobre 2026. Branche : `codex/account-email-hardening`, PR #85.
Suite de la PR #84, base `codex/appsec-hardening`. Les PR #82, #83 et #84 restent des prerequis tant qu'elles ne sont pas fusionnees. Ne pas fusionner cette suite dans une branche intermediaire par inadvertance.

## Diagnostic et corrections

| Priorite | Constat | Correction et fichiers principaux |
| --- | --- | --- |
| Eleve, defense en profondeur | Une lecture des jetons en base permettait d'utiliser les liens de recuperation encore valides. | `lib/accountTokens.ts` conserve uniquement une empreinte SHA-256 liee a l'usage et a l'expiration. Les routes inscription, confirmation, reset et changement d'adresse utilisent ce format. Les nouveaux liens expirent apres 24 h, ou 1 h pour un reset. |
| Eleve, defense en profondeur | Sans activation du nouveau schema, une session admin signee restait utilisable apres deconnexion. | `lib/revocableAdminSession.ts` utilise la table `Setting` existante comme registre revocable lorsque la migration commerciale est desactivee. Une panne du registre refuse l'authentification. Les sessions sans identifiant sont refusees. |
| Moyen | Une session admin ouverte suffisait pour les actions sensibles selectionnees. | `lib/adminFreshness.ts` impose une confirmation recente par mot de passe et TOTP si active. Cookie HttpOnly/Secure en production, signature HMAC liee a la session, validite de 10 minutes. Verification avant toute mutation ou lecture des identifiants. |
| Moyen | Un client non confirme ne pouvait pas utiliser le renvoi demandant une session authentifiee. | Route de renvoi accessible par adresse, reponse neutre, limitation par IP et empreinte d'adresse, ecriture conditionnelle pour les demandes simultanees. Formulaire accessible avant connexion. |
| Moyen | Envois en arriere-plan non suivis et echecs prestataire ignores. | `lib/accountEmail.ts` utilise `after` de Next, trois tentatives maximum pour les echecs temporaires, delai de 8 s par tentative et une meme cle d'idempotence. Confirmation technique uniquement avec un identifiant prestataire. Le changement d'adresse retourne 503 si l'envoi n'est pas confirme. |
| Moyen | La suppression de compte laissait croire que toute adresse e-mail disparaissait. | Texte de `app/page.tsx` explicite la conservation de certaines commandes, factures et conversations, selon la politique de confidentialite. Aucune modification des donnees conservees. |

### Integrations administrateur

- Confirmation recente : stock POST/PUT/DELETE, reglages PUT, consultation des identifiants POST, 2FA POST, chiffrement historique POST, verification commerciale PUT, operations POST.
- `AdminReauthentication` conserve l'action en attente. Annuler ne l'execute pas. Seul un refus explicite `ADMIN_REAUTH_REQUIRED`, emis avant mutation, permet une nouvelle tentative unique apres confirmation. Aucun rejeu automatique d'une erreur reseau ou d'un paiement.
- Le panneau des sessions fonctionne aussi sans activer le schema commercial. La revocation des autres sessions est journalisee dans la meme transaction.
- Les anciens cookies admin sans identifiant exigent une nouvelle connexion apres deploiement. Une transition du registre `Setting` vers `AdminSession` exige aussi une reconnexion.
- Le TOTP demeure a usage unique : apres une confirmation, une action qui exige elle-meme un code, comme desactiver la 2FA, doit utiliser le code suivant.

### Compatibilite et limites

- Aucune migration Prisma ni modification du schema. Aucun acces a la base de production, envoi reel, paiement, activation de vente, merge ou deploiement de production effectue. La previsualisation Vercel automatique est reussie.
- Les anciens liens de 64 caracteres restent lisibles jusqu'a leur expiration historique ; aucune nouvelle valeur en clair n'est emise. Ce changement ne transforme pas retroactivement les anciennes valeurs.
- Le nettoyage des comptes non verifies preserve une confirmation renvoyee recemment, meme pour un ancien compte.
- Les trois tentatives d'e-mail sont bornees a une execution serveur, pas une file persistante resistante a une panne du processus. Une acceptation par le prestataire ne prouve pas une reception en boite principale. Le renvoi reste accessible.
- Les tests d'interface utilisent uniquement des donnees fictives et interceptent les API ; ils ne remplacent pas les tests serveur ni un test de reception autorise.

## Validation

- `npm test` : 102/102 reussis, dont 12 nouveaux tests de durcissement.
- `npm run lint` : reussi.
- `npm run build` : reussi, compilation de production et TypeScript ; relance locale finale reussie le 14 octobre.
- `git diff --check` : reussi.
- `npm audit --omit=dev --audit-level=high` : aucune alerte connue.
- `npm audit --audit-level=high` : cinq alertes elevees dans une meme chaine de dependances de developpement (braces, micromatch, fast-glob, plugin Next ESLint, configuration Next ESLint).
- PostgreSQL : 15/15 reussis, aucun test ignore, dont quatre nouveaux : parcours complet avec vrais hachages et sessions, renvois simultanes, nettoyage des confirmations, revocation sans migration commerciale. L'ancien test de confirmation du retrait d'acces declare maintenant son corps JSON, comme le navigateur ; la validation serveur reste stricte.
- Navigateur isole : annulation de confirmation sans divulgation, mot de passe puis TOTP, reprise de la consultation, focus des champs et renvoi de confirmation sans connexion verifies. Controle des interfaces sur ordinateur et mobile (390 pixels CSS), sans debordement horizontal du formulaire client. Captures locales dans `artifacts/account-hardening/` ; aucune donnee reelle.
- [Pipeline #19](https://github.com/Demiro89/landing-page/actions/runs/38228484585), commit de code `4a085a1828164315476d7a2efb554fd0af63b03e` : lint, 102 tests unitaires, 15 tests PostgreSQL et build reussis. Seul l'audit des dependances de developpement echoue. Previsualisation Vercel du meme commit reussie. Le commit suivant ne fait que finaliser ce rapport.

### Alerte de dependance encore ouverte

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), CVE-2026-93687 : debordement de pile avec des motifs braces profondement imbriques. La fiche officielle n'indiquait aucune version corrigee au controle du 12 octobre.

La correction forcee proposee par npm retrograderait `eslint-config-next` vers 14.2.35 alors que le projet utilise Next 16.3.8. Cette retrogradation incompatible n'est pas appliquee. Aucun contournement, exclusion d'audit ou faux correctif ajoute. La verification CI globale echoue sur cet audit ; ne pas annoncer tous les controles verts.

## Avant fusion et deploiement

- [x] Valider les nouveaux tests PostgreSQL dans la base jetable CI.
- [ ] Respecter l'ordre des PR precedentes, reorienter cette PR vers main ensuite et relancer les controles.
- [ ] Traiter explicitement l'alerte de developpement ouverte, sans neutraliser l'audit.
- [ ] Sur une preproduction autorisee, verifier reception des trois types d'e-mail, liens expires/rejoues et navigation apres confirmation.
- [ ] Reconnecter l'admin apres deploiement ; verifier annulation, confirmation TOTP, deconnexion et revocation d'une seconde session.
- [ ] Surveiller les erreurs `account-mail/not-confirmed` et maintenir les logs sans adresses ni liens secrets dans ce module.
- [ ] Conserver les ventes et offres non validees fermees ; aucun test ne requiert un debit reel.

## Fichiers de cette livraison

```text
app/admin/page.tsx
app/api/admin/2fa/route.ts
app/api/admin/auth/route.ts
app/api/admin/commercial-review/route.ts
app/api/admin/credentials/route.ts
app/api/admin/encrypt-legacy/route.ts
app/api/admin/operations/route.ts
app/api/admin/settings/route.ts
app/api/admin/stock/route.ts
app/api/client/change-email/route.ts
app/api/client/forgot-password/route.ts
app/api/client/register/route.ts
app/api/client/resend-verification/route.ts
app/api/client/reset-password/route.ts
app/api/client/verify-email-change/route.ts
app/api/client/verify/route.ts
app/api/cron/cleanup/route.ts
app/page.tsx
components/admin/AdminReauthentication.tsx
components/admin/OperationsPanel.tsx
lib/accountEmail.ts
lib/accountTokens.ts
lib/adminFreshness.ts
lib/adminReauthentication.ts
lib/adminResponse.ts
lib/nodemailer.ts
lib/rateLimit.ts
lib/revocableAdminSession.ts
tests/account-hardening.test.cjs
tests/admin-experience.test.cjs
tests/appsec.test.cjs
tests/order-security.test.cjs
tests/postgres-account.cjs
tests/postgres-payments.cjs
tests/preview-session.cjs
tests/security.test.cjs
tests/start-ui-preview.cjs
tests/ui-preview.cjs
docs/account-email-hardening-2026-10-12.md
```
