# Audit AppSec et correctifs StreamMalin

Audit du 8-9 octobre 2026. Branche `codex/appsec-hardening`, base locale
`6a7c487` (`codex/admin-experience-audit`, PR #83), elle-meme basee sur la PR #82.
Ces deux PR ne sont pas encore fusionnees lors de la preparation de ce rapport.
Les correctifs ci-dessous sont appliques dans les fichiers, pas seulement proposes.
Aucune migration, intervention sur la base reelle, rotation de secret, activation
commerciale, fusion ou mise en production n'a ete effectuee.

## Conclusion

Deux chemins de reutilisation de liens de compte justifiaient une priorite elevee.
Ils sont corriges, avec invalidation atomique des liens et des sessions concernees.
La suppression de compte, l'anti-bruteforce concurrent, la confidentialite des
listes admin, les entrees JSON et plusieurs protections secondaires sont renforces.
Aucune injection SQL/commande OS ni XSS exploitable n'a ete confirmee dans les
chemins examines. Cela n'est pas une certification d'absence de vulnerabilites.

Une alerte de dependance reste ouverte : `braces` dans les outils de developpement.
Il n'existe pas de version officiellement corrigee au moment de la verification.
L'audit complet reste donc rouge ; il n'a pas ete masque pour permettre une fusion.

## Perimetre et methode

- Next.js 16.3.8 / React 19.2.4 / TypeScript ; guides de la version installee lus.
- Prisma et client 5.13.0, PostgreSQL ; pas de mise a niveau Prisma majeure improvisee.
- Stripe 22.x, Resend 6.x, sessions HMAC, scrypt, TOTP et AES-256-GCM.
- Parcours : inscription/connexion/verification/recuperation/changement/suppression,
  commandes et factures, chat, stocks, reglages, operations admin, checkout,
  notifications Stripe, proxy HTTP et pipeline GitHub Actions.
- Lecture du code et recherche des sinks dangereux, tests avec doubles explicites,
  nouveaux tests PostgreSQL jetables, compilation de production et navigateur local.
- Recherche de formats courants de cles privees/Stripe live/GitHub dans les fichiers
  suivis : aucune correspondance. Pas d'analyse exhaustive de l'historique Git,
  de tous les formats de secrets, des comptes cloud ou des journaux de production.
- Aucun scan agressif du site public, aucun achat et aucun message reel envoye.

## Constats classes et patches

La gravite tient compte du contexte de ce projet, pas uniquement d'un score generique.
Les extraits montrent la partie decisive du code integre. Les fichiers cites et le
diff de la PR contiennent les imports, transactions et reponses completes.

### AS-01 - Eleve : lien de reset valable apres changement d'adresse

Fichiers : `app/api/client/verify-email-change/route.ts`,
`app/api/client/forgot-password/route.ts`. Categorie OWASP : authentification.

Avant, la confirmation changeait `email` et `sessionVersion`, sans effacer
`resetToken`. La demande de reset faisait `update({ where: { id }, ... })`.
Un lien encore valable recu sur l'ancienne boite pouvait donc modifier le mot de
passe du compte passe a une autre adresse. Une demande deja en cours pouvait
egalement remettre un token apres l'invalidation. Prerequis : possession du lien
ou controle de l'ancienne boite pendant cette fenetre, pas simple connaissance de l'email.

Patch : ajout dans la meme transaction de confirmation :

```ts
resetToken: null,
resetTokenExp: null,
verificationToken: null,
sessionVersion: { increment: 1 },
```

Et issuance conditionnelle du nouveau lien :

```ts
const issued = await prisma.customer.updateMany({
  where: { id: customer.id, email: normalized, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion },
  data: { resetToken, resetTokenExp },
});
```

L'envoi n'est tente que si `issued.count === 1`. La reponse publique reste neutre.

### AS-02 - Eleve : ancien lien d'inscription utilisable comme connexion

Fichiers : `app/api/client/{verify,reset-password,change-password}/route.ts`.
Categorie : authentification et cycle de vie des sessions.

Avant, un reset rendait le compte verifie mais conservait `verificationToken`.
`verify` acceptait ce token sans condition `emailVerified: false`, puis creait une
nouvelle session. Le detenteur d'un ancien lien d'inscription pouvait donc se
connecter apres changement du mot de passe. Ce n'etait pas une devinette de token.

Patch : reset/changement de mot de passe effacent `verificationToken`. Verification :

```ts
where: {
  id: customer.id, verificationToken: token, emailVerified: false,
  createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
},
data: {
  emailVerified: true, verificationToken: null, sessionVersion: { increment: 1 },
  resetToken: null, resetTokenExp: null,
},
```

Consommation du lien et changement de version dans une seule transaction ; cookie
pose apres commit. Un seul concurrent peut reussir. Format strict de 64 caracteres
hexadecimaux. La limite de sept jours utilise `createdAt` existant : pas de migration.
Un ancien compte non verifie peut utiliser le parcours de recuperation par email.

### AS-03 - Moyen : suppression sans nouvelle verification du mot de passe

Fichiers : `app/api/client/delete-account/route.ts`, `app/page.tsx`.
Categorie : controle d'acces / reauthentification d'une operation destructive.

Avant : cookie valide + `{ confirmation: 'supprimer' }` suffisaient.
Une session volee ou un navigateur laisse ouvert permettaient la suppression.

Patch : mot de passe actuel obligatoire, borne et verifie cote serveur ; nouveau
champ dans l'interface. La transaction reclame d'abord les identifiants courants :

```ts
const claimed = await tx.customer.updateMany({
  where: { id: customer.id, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion },
  data: { sessionVersion: { increment: 1 } },
});
if (claimed.count !== 1) return false;
```

Detachement des commandes et suppression uniquement ensuite, dans la meme transaction.
Un changement concurrent donne 409, sans detacher de commande. Le mot de passe saisi
est vide apres la tentative. Aucune annulation automatique d'abonnement n'est ajoutee.

### AS-04 - Moyen : pertes de tentatives de connexion concurrentes

Fichier : `app/api/client/login/route.ts`. Categorie : authentification.

Avant : `const newAttempts = customer.loginAttempts + 1`, puis ecriture du nombre.
Plusieurs requetes pouvaient ecrire le meme compteur et retarder le verrouillage.
La limitation par IP limitait deja l'exploitation, sans couvrir les IP distribuees.

Patch : `data: { loginAttempts: { increment: 1 } }` dans une transaction,
avec condition sur hash/version et borne de l'entier ; lecture du compteur actuel
et verrouillage a partir de cinq echecs dans cette meme transaction. Le succes ne
remet le compteur a zero que si les identifiants n'ont pas change entre-temps.

### AS-05 - Moyen : enumeration explicite des comptes

Fichiers : `app/api/client/{register,login}/route.ts`, `lib/clientAuth.ts`, `app/page.tsx`.
Categorie : fuite d'information d'authentification.

Avant : inscription 409 pour un email connu ; erreurs de connexion avec nombre
d'essais restants ou message de verrouillage, distinctes d'un compte inexistant.

Patch : meme reponse d'inscription pour adresse nouvelle/existante, y compris
collision concurrente ; meme statut 401 et meme message pour compte absent,
mauvais mot de passe et compte verrouille. Un hash factice impose aussi scrypt
pour un compte absent. Le verrouillage reste effectif, seule sa revelation change.
Cela reduit l'oracle de temps evident mais ne pretend pas rendre l'ensemble du
parcours reseau/base strictement constant en temps.

### AS-06 - Moyen : identifiants admin charges en masse malgre le masquage

Fichiers : `app/api/admin/{stock,credentials}/route.ts`, `app/api/chat/route.ts`,
`app/admin/page.tsx`, `components/admin/StockCredentials.tsx`, `lib/adminCredentials.ts`.
Categorie : exposition excessive de donnees, pas contournement de l'auth admin.

Avant : `stocks: s.stocks.map(st => ({ ...st, details: decrypt(st.details) }))`.
Tous les acces etaient deja dans la reponse et la memoire du navigateur. Les relations
imbriquees et listes du support incluaient aussi des champs de commande inutiles.

Patch : `details: ''` sur listes stocks/commandes, y compris `stockAccount` imbrique ;
selection explicite de `id`, `clientEmail`, `service` dans les listes admin du support.
Nouvelle route POST authentifiee pour UN stock :

```ts
const stock = await prisma.stockAccount.findUnique({
  where: { id: stockId }, select: { details: true, updatedAt: true },
});
```

Limitation persistante fail-closed, ID borne, journal d'acces sans secret obligatoire
AVANT retour du secret, `private, no-store`. Journal indisponible = 503, aucun secret.
Revelation/copie/edition utilisent ce chemin. L'edition refuse des metadonnees perimees
grace a `updatedAt` au lieu de sauvegarder un champ masque vide.
Une session admin autorisee conserve le droit de consulter les acces : ce patch ne
remplace ni MFA ni une future verification renforcée avant actions sensibles.

### AS-07 - Moyen : parsing de corps non bornes et erreurs sur JSON invalide

Fichiers : `lib/requestJson.ts`, routes de comptes, acces, auth admin, credentials,
checkout manuel/Stripe/confirmation, chat, retractation, resiliation.
Categorie : validation des entrees / consommation de ressources.

Avant : `const { ... } = await request.json()` pouvait lever une erreur 500 sur
`null`/JSON casse ; la taille etait controlee apres parsing, voire pas du tout.
Les limites de la plateforme et par IP reduisaient deja le risque de saturation.

Patch d'appel partage :

```ts
const parsed = await readJsonObject(request);
if (!parsed.ok) return parsed.response;
const { email, password } = parsed.value;
```

Le lecteur exige `application/json`, compte les octets reellement lus, coupe le flux
au-dela de 8192 octets (16000 pour le chat), valide UTF-8 et refuse tableaux/null/scalaires.
400/413/415 explicites, sans details internes. `Content-Length` falsifie ou absent ne
contourne pas la borne. Le webhook Stripe garde son corps brut pour la signature.
Le formulaire contact disposait deja de sa propre borne. Les autres routes admin
authentifiees restent protegees par leurs validations et limites de plateforme ;
cette modification ne pretend pas imposer une borne applicative uniforme a chaque route.

### AS-08 - Moyen : protection CSV incomplete

Fichier : `app/api/admin/export/route.ts`. Categorie : injection dans un tableur.

Avant : `/^[=+\-@\t\r]/`. Un retour ligne initial ou des espaces suivis d'une formule
n'etaient pas neutralises. L'execution depend du tableur et de son mode d'import.

Patch :

```ts
if (/^[\t\r\n]/.test(str) || /^[\s\u0000-\u001f]*[=+\-@]/u.test(str)) {
  str = "'" + str;
}
```

Les guillemets, separateurs et retours ligne restent echappes. Verifier le fichier
exporte dans le tableur reel ; une reimportation/re-sauvegarde peut modifier les protections.

### AS-09 - Moyen : nettoyage pouvant supprimer un compte devenu verifie

Fichier : `app/api/cron/cleanup/route.ts`. Categorie : integrite / concurrence.

Avant : selection des comptes non verifies, puis suppression sur la seule liste des
IDs. Un compte confirme entre ces deux etapes pouvait encore etre supprime.

Patch, une seule suppression conditionnelle :

```ts
await prisma.customer.deleteMany({
  where: { emailVerified: false, createdAt: { lt: sevenDaysAgo }, orders: { none: {} } },
});
```

La protection est executee au moment de supprimer ; la fonction de nettoyage n'a
pas ete lancee sur la production pendant cet audit.

### AS-10 - Faible : oracle d'existence dans l'ecriture du chat

Fichier : `app/api/chat/route.ts`, coherence dans `client/cancel-order`.
Avant : recherche d'une commande avant verification de l'identite du client en POST.
Une difference 404/401 permettait de tester l'existence d'un ID deja connu/devine.
Ce chemin ne permettait pas de lire son contenu ni d'ecrire sans controle de propriete.

Patch : session verifiee avant recherche, format d'ID borne, meme 404 pour absence
et proprietaire different ; controles de propriete preserves. Le GET du support
utilise aussi 404 pour un autre proprietaire.

### AS-11 - Faible / durcissement : cache, CSP et signatures canoniques

Fichiers : `proxy.ts`, `next.config.ts`, `lib/clientAuth.ts`.
Avant : les sorties precoces du proxy contournaient son ajout CSP/cache ; filtre XSS
historique `1; mode=block` ; suffixes non hexadecimaux ignores par `Buffer.from(sig, 'hex')`.
Ce dernier point ne permettait PAS de forger la signature d'un compte inconnu.

Patch : `withCsp(request, earlyResponse)` sur redirections/refus, absence de cache
et de Referer pour reponses sensibles et liens a token ; chemin `/admin/login` exact.
`X-XSS-Protection: 0`, `poweredByHeader: false` ; signature client strictement 64 hex
avant comparaison constante. Module de sessions marque `server-only`.
HSTS, nosniff, X-Frame-Options DENY, Permissions-Policy et verification d'origine
fail-closed etaient deja presents. Pas d'Access-Control-Allow-Origin permissif ajoute.

### DEP-01 - Eleve selon l'avis : dependance de developpement non corrigee

Fichier : `package-lock.json` examine, non modifie sans correctif compatible.
Chaine : `eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`.
Une cause racine remonte comme cinq paquets affectes, pas cinq failles independantes.

[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) :
recursion excessive sur des motifs imbriques, deni de service. `braces` 3.0.3 est
encore la derniere version publiee verifiee. Le plugin Next 16.4.0 conserve fast-glob.
L'exposition examinee est le lint/CI, pas une route publique executant braces.

`npm audit fix --force` retrograderait la configuration vers Next 14.2.35 : non applique.
Pas de fork arbitraire, suppression de regle, exclusion d'alerte ou faux override.
Le job de qualite reste bloquant. CI existante : permissions `contents: read`, delai
maximal, base jetable, pas de secrets de production dans les tests. Mettre a jour
le composant des qu'un correctif compatible est publie, puis relancer l'audit complet.

## Validation

- `npm test` : **90/90** tests reussis, dont 15 nouveaux tests AppSec.
- `npm run lint` : **OK**, aucune erreur ni avertissement.
- `npm run build` : **OK**, TypeScript et build Next de production ; seulement
  generation Prisma, aucune commande de modification du schema.
- `npm audit --omit=dev --audit-level=high` : **0 alerte connue**.
- `npm audit --audit-level=high` : **5 alertes elevees de developpement**, DEP-01 ouvert.
- 5 nouveaux tests PostgreSQL dans `tests/postgres-auth.cjs` : reset/ancien lien,
  confirmation simultanee, changement d'email pendant un reset en cours, mauvais
  mots de passe simultanes, suppression avec ancienne/nouvelle session.
  Execution uniquement sur hote local et nom de base finissant par `_test`.
  Resultat du pipeline a consigner apres l'execution distante.
- HTTP local sur le vrai serveur compile, sans base : redirection admin 307,
  origine etrangere 403, JSON null 400, credentials sans session 401, corps excessif
  413 ; CSP et no-store observes sur les cinq reponses. Next normalise ici l'origine
  loopback en `http://localhost:3106` ; origine 127.0.0.1 differente refusee, protection
  non assouplie pour les tests.
- Navigateur, donnees fictives : 1440x900 et 390x844, pas de debordement horizontal
  observe ; un seul secret revele a la demande, masquage, edition pre-remplie,
  bouton de suppression bloque sans mot de passe puis active avec saisie fictive.
  Aucune suppression soumise, aucun secret reel utilise. Aucun message console d'erreur
  observe pendant ces parcours. Ces fixtures ne remplacent pas les tests serveur.

## Checklist de deploiement prioritaire

- [ ] Revoir/fusionner dans l'ordre #82, #83, puis cette branche ; retarget vers main
  apres fusion de la base et relancer les controles. Ne pas fusionner dans une branche
  de fonctionnalite par inadvertance. Pas de fusion automatique de cet audit.
- [ ] Conserver l'alerte DEP-01 visible jusqu'a un vrai correctif et une decision
  documentee. Ne pas presenter la CI globale comme verte.
- [ ] Verifier sur le domaine HTTPS final : CSP avec nonce par reponse, HSTS,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, absence de cache prive
  mal configure au CDN, `no-referrer` pour les liens contenant des tokens.
- [ ] Verifier cookies HttpOnly/Secure/SameSite et le refus des origines etrangeres
  sur les domaines reel et preview, sans ajouter un joker CORS.
- [ ] MFA admin active et recuperation documentee ; activer les sessions admin
  revocables seulement dans le rollout valide. En mode historique, effacer le cookie
  ne revoque pas une copie volee avant son expiration ; rotation du secret de session
  possible dans un changement prepare, jamais de rotation improvisee d'ENCRYPTION_KEY.
- [ ] Lors du deploiement, decider si les liens de recuperation deja emis doivent
  etre invalides dans une operation de maintenance approuvee. Les liens de reset
  historiques ont une duree maximale d'une heure ; les comptes deja verifies ne
  peuvent plus utiliser un ancien lien d'inscription avec ce code.
- [ ] Acces minimum aux secrets, logs et sauvegardes ; sauvegarde/restauration
  controlees avant tout changement de schema. Ne pas exposer les valeurs sans
  NEXT_PUBLIC_ aux modules clients. Rechercher/faire tourner un secret si une fuite
  historique est trouvee, pas sur la seule absence de correspondance de ce scan.
- [ ] Tester email change/reset/inscription avec une boite controlee : acceptation
  Resend et reception sont distinctes. Les envois non attendus de certains parcours
  historiques restent a fiabiliser ; le renvoi de verification aux comptes non
  verifies merite une reprise fonctionnelle separee (getCurrentCustomer les refuse).
- [ ] Verifier les parcours paiements et livraison en sandbox ; conserver les offres
  non autorisees et les flags commerciaux fermes jusqu'a validation separee.
- [ ] Etape suivante : reevaluation recente du mot de passe/MFA avant changements
  critiques admin, hachage des tokens de mail au repos, pagination des gros exports,
  logs structures expurges, limites de taille sur les autres routes admin.

## Fichiers modifies

```text
app/admin/page.tsx
app/api/acces/route.ts
app/api/admin/auth/route.ts
app/api/admin/credentials/route.ts (nouveau)
app/api/admin/export/route.ts
app/api/admin/stock/route.ts
app/api/chat/route.ts
app/api/checkout/confirmation/route.ts
app/api/checkout/manual/route.ts
app/api/checkout/stripe/route.ts
app/api/client/cancel-order/route.ts
app/api/client/change-email/route.ts
app/api/client/change-password/route.ts
app/api/client/delete-account/route.ts
app/api/client/forgot-password/route.ts
app/api/client/login/route.ts
app/api/client/register/route.ts
app/api/client/reset-password/route.ts
app/api/client/verify-email-change/route.ts
app/api/client/verify/route.ts
app/api/cron/cleanup/route.ts
app/api/retractation/route.ts
app/page.tsx
components/admin/StockCredentials.tsx (nouveau)
lib/adminCredentials.ts (nouveau)
lib/checkoutReservation.ts
lib/checkoutValidation.ts
lib/clientAuth.ts
lib/requestJson.ts (nouveau)
next.config.ts
proxy.ts
tests/admin-experience.test.cjs
tests/appsec.test.cjs (nouveau)
tests/order-security.test.cjs
tests/postgres-auth.cjs (nouveau)
tests/security.test.cjs
tests/ui-preview.cjs
docs/appsec-audit-2026-10-09.md (ce rapport)
```

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) : reauthentification et reponses generiques.
- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html) : filtres XSS historiques et en-tetes.
- [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection) : limites et protections des exports tableurs.
- Documentation locale Next.js : `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`
  et `01-app/01-getting-started/15-route-handlers.md`.
