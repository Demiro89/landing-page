// Frozen contractual document. Future revisions must use a new version/file.
export const TERMS_DOCUMENT = {
  version: '2026-10-07.1', updatedAt: '7 octobre 2026',
  sections: [
    { id: 'vendeur', title: '1. Identité du vendeur', paragraphs: [
      'StreamMalin est exploité par Said Ouarzazi, entrepreneur individuel (EI), micro-entreprise. SIREN : 104 981 014. SIRET : 104 981 014 00012. Immatriculation : RCS Auxerre 104 981 014. Adresse professionnelle : 4 rue des Acacias, 89200 Avallon. Contact : hello@streammalin.fr.',
      'La TVA n’est pas facturée dans le cadre de la franchise en base : TVA non applicable, art. 293 B du CGI.',
    ] },
    { id: 'objet', title: '2. Objet et nature du service', paragraphs: [
      'Le service consiste en la mise à disposition temporaire et personnelle d’un accès numérique pendant la durée de l’offre choisie. Il ne constitue pas une vente définitive d’un compte, d’un abonnement ou d’un droit de propriété. L’accès prend fin à l’issue de la période souscrite, sauf renouvellement.',
      'La fiche de chaque offre précise le fournisseur, le type d’accès, les fonctions incluses et leurs limites, les conditions d’éligibilité et les informations éventuellement visibles par les autres membres d’un accès partagé. Une offre dont les conditions ou l’autorisation de distribution ne sont pas vérifiées n’est pas ouverte à la commande.',
    ] },
    { id: 'commande', title: '3. Commande et preuves contractuelles', paragraphs: [
      'Avant paiement, le client vérifie l’offre et son prix, fournit une adresse e-mail valide, accepte les CGV, demande l’exécution immédiate selon les conditions de l’article 8 et confirme son éligibilité. Les trois confirmations doivent être cochées séparément. Une case ne peut supprimer un droit impératif du consommateur.',
      'Une réservation temporaire précède le paiement. Sa durée est précisée au checkout ou par le prestataire de paiement. La commande payée fait l’objet d’une confirmation et d’un suivi. Un paiement reçu après expiration ou sans place attribuable est suivi par le support : aucun accès fictif n’est annoncé et la situation doit être résolue, notamment par remboursement lorsque la prestation ne peut être fournie.',
      'La référence de commande, les dates d’acceptation, la version des CGV, les informations de paiement et les données techniques utiles à la preuve sont conservées selon la politique de confidentialité. Un récapitulatif et la version des CGV acceptée sont transmis sur un support durable lors du traitement de la commande.',
    ] },
    { id: 'prix', title: '4. Prix et comparaison', paragraphs: [
      'Les prix sont indiqués en euros, toutes taxes comprises, sans frais d’activation supplémentaires sauf indication explicite avant paiement. Le montant applicable est celui confirmé pour la commande. Une modification du catalogue ne modifie pas rétroactivement une commande payée.',
      'Les économies sont indicatives et ne sont affichées que pour un tarif de référence daté, sourcé et jugé comparable à l’offre proposée. Une projection annuelle suppose douze mois aux mêmes tarifs ; elle ne constitue pas un prix annuel contractuel ni une économie garantie.',
    ] },
    { id: 'paiement', title: '5. Paiement, renouvellement et résiliation', paragraphs: [
      'Le paiement par carte est traité par Stripe. Il s’agit d’un abonnement avec prélèvement mensuel automatique au montant indiqué avant paiement. La prochaine échéance est affichée dans l’espace client. Le client peut demander la résiliation avant cette échéance ; la confirmation précise la date de fin de l’accès. La résiliation met fin aux prélèvements futurs, sous réserve de son traitement avant l’échéance concernée et des droits applicables.',
      'PayPal et les cryptomonnaies ne sont proposés que si ces moyens sont effectivement ouverts et configurés. Dans le parcours manuel, un paiement n’est pas considéré comme confirmé par un simple clic : sa réception doit être vérifiée par le support. PayPal doit être utilisé en mode Biens et Services. Un paiement manuel ne crée pas de prélèvement automatique. Aucun transfert ne doit être effectué sans référence de commande et réservation confirmée.',
      'StreamMalin ne reçoit pas les données complètes de carte bancaire. Les références de transaction nécessaires au suivi, les informations partielles de carte et les échéances peuvent être conservées. Pour les paiements manuels, les justificatifs sont vérifiés avant activation.',
    ] },
    { id: 'activation', title: '6. Activation et plateformes tierces', paragraphs: [
      'L’accès est transmis rapidement après validation du paiement et selon la disponibilité et les modalités de l’offre. Pour une invitation, une étape effectuée par le fournisseur ou le support peut être nécessaire. La réservation ou le paiement ne constitue pas en soi la preuve que l’accès a été livré. En cas d’échec de transmission, le support suit la commande et organise une nouvelle tentative ou la résolution appropriée.',
      'Les plateformes tierces peuvent modifier leurs fonctionnalités, catalogues et règles familiales, techniques ou géographiques. Des interruptions peuvent survenir. StreamMalin assure le suivi des accès et une assistance en cas de dysfonctionnement. Cette dépendance ne supprime pas les obligations légales de StreamMalin ni les droits du consommateur.',
    ] },
    { id: 'eligibilite', title: '7. Éligibilité et usage', paragraphs: [
      'Le client vérifie les conditions indiquées sur la fiche de l’offre, notamment le pays, le foyer, le groupe familial, les invitations récentes et l’historique du compte. En cas de doute, il contacte le support avant paiement. Une déclaration d’éligibilité ne permet pas à StreamMalin de garantir l’acceptation par une plateforme tierce.',
      'Le client fournit des informations exactes et conserve les accès confidentiels. Il ne partage pas son accès au-delà des conditions autorisées et ne modifie pas les informations de connexion d’un compte partagé. StreamMalin ne demande pas le mot de passe personnel du client pour vérifier une éligibilité.',
    ] },
    { id: 'retractation', title: '8. Droit de rétractation', paragraphs: [
      'Le consommateur dispose en principe de quatorze jours à compter de la conclusion d’un contrat à distance pour exercer son droit de rétractation. Une demande peut être déposée au moyen de la fonctionnalité disponible sur /retractation ou par une déclaration claire adressée à hello@streammalin.fr.',
      'Les exceptions dépendent de la qualification juridique de la prestation. Pour un contenu numérique sans support matériel, l’exception prévue à l’article L.221-28 du Code de la consommation suppose notamment un accord préalable exprès pour commencer l’exécution, la reconnaissance expresse de la perte du droit et la confirmation de cet accord sur un support durable. La seule transmission d’un accès à un service numérique ne permet pas de présumer que cette exception est applicable.',
      'Pour une prestation de services, la demande d’exécution immédiate n’entraîne pas à elle seule la perte immédiate du droit : les conditions légales, notamment celles relatives à la pleine exécution, doivent être réunies. Un montant proportionnel au service effectivement fourni ne peut être demandé que dans les conditions prévues par la loi. La qualification de chaque offre doit être vérifiée avant son ouverture à la vente.',
    ] },
    { id: 'remboursements', title: '9. Remboursements et droits du consommateur', paragraphs: [
      'En cas d’absence de fourniture ou de dysfonctionnement, le support recherche une solution adaptée : assistance, mise en conformité, remplacement, réduction de prix ou remboursement lorsque les conditions sont réunies. Les droits légaux, notamment la garantie légale de conformité des contenus et services numériques lorsqu’elle s’applique, restent intégralement applicables.',
      'Une information erronée ou un usage non autorisé peut être pris en compte pour examiner une demande commerciale, au regard des circonstances et des informations fournies avant la commande. Il ne constitue pas une exclusion automatique des droits légaux. Un changement d’une plateforme tierce, une restriction du compte ou l’absence de contact préalable avec le support ne peut justifier une exclusion générale de remboursement.',
      'Pour une demande, préciser la référence de commande et le problème rencontré à hello@streammalin.fr. Aucun mot de passe, numéro de carte complet ou accès bancaire ne doit être envoyé.',
    ] },
    { id: 'reclamations', title: '10. Réclamations et litiges de paiement', paragraphs: [
      'Le client est invité à contacter le support à hello@streammalin.fr avec sa référence de commande afin de rechercher une solution amiable. Le support accuse réception et apporte une réponse dans un délai raisonnable.',
      'Cette démarche est recommandée et ne constitue pas une condition privant le client de ses recours, de ses droits auprès de Stripe, PayPal ou de sa banque, ou du respect des délais de contestation. En cas de fraude ou d’urgence, le client peut contacter directement son prestataire de paiement.',
    ] },
    { id: 'mediation', title: '11. Médiation de la consommation', paragraphs: [
      'Après une réclamation écrite au support restée sans solution satisfaisante, le consommateur peut recourir gratuitement à la médiation dans les conditions légales. Médiateur déclaré par l’exploitant : CM2C, Centre de la Médiation de la Consommation de Conciliateurs de justice. Adresse : 49 rue de Ponthieu, 75008 Paris. Téléphone : 01 89 47 00 14. E-mail : litiges@cm2c.net. Saisine : https://www.cm2c.net/declarer-un-litige.php.',
      'Le consommateur conserve la possibilité d’exercer les recours légaux. Pour les litiges transfrontaliers dans l’Union européenne, il peut également se rapprocher du Centre Européen des Consommateurs compétent.',
    ] },
    { id: 'non-affiliation', title: '12. Non-affiliation', paragraphs: [
      'StreamMalin est un service indépendant, ni affilié, ni partenaire, ni revendeur officiel des plateformes citées. Les marques et logos appartiennent à leurs titulaires respectifs. La mention de non-affiliation n’autorise pas en elle-même la revente ou le partage d’un accès : les autorisations et conditions du fournisseur doivent être vérifiées pour chaque offre.',
    ] },
    { id: 'droit', title: '13. Version, loi applicable et juridiction', paragraphs: [
      'La version applicable est celle acceptée lors de la commande. La présente version est identifiée 2026-10-07.1 et est consultable à /cgv/versions/2026-10-07.1. Les versions futures ne remplacent pas rétroactivement les preuves des commandes antérieures.',
      'Les CGV sont soumises au droit français, sans priver le consommateur des dispositions impératives qui lui sont applicables. La compétence juridictionnelle est déterminée selon les règles légales applicables ; aucune clause n’impose exclusivement un tribunal au consommateur en méconnaissance de ces règles.',
    ] },
  ],
} as const;

export const TERMS_TEXT = `STREAMMALIN - CONDITIONS GENERALES DE VENTE\nVersion ${TERMS_DOCUMENT.version} - ${TERMS_DOCUMENT.updatedAt}\n\n${TERMS_DOCUMENT.sections.map(section => `${section.title}\n${section.paragraphs.join('\n\n')}`).join('\n\n')}`;
