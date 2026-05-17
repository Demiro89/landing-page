import Icon from '@/components/Icon';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Politique de confidentialité — StreamMalin',
  description: 'Politique de confidentialité et de protection des données personnelles de StreamMalin.',
};

export default function PolitiqueConfidentialitePage() {
  return (
    <>
      <Navbar />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '800px',
          margin: '0 auto',
          padding: '90px 24px 80px',
        }}
      >
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--muted)',
            fontSize: '0.85rem',
            textDecoration: 'none',
            marginBottom: '32px',
          }}
        >
          <Icon className="fa-solid fa-arrow-left" style={{ fontSize: '0.75rem' }} />
          Retour à l&apos;accueil
        </a>

        <h1
          style={{
            fontFamily: 'var(--font-syne), sans-serif',
            fontSize: 'clamp(1.8rem, 5vw, 2.4rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '8px',
          }}
        >
          Politique de confidentialité
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
          Dernière mise à jour : mai 2026
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '40px' }}>
          Responsable du traitement : SAID OUARZAZI EI — StreamMalin —{' '}
          <a href="mailto:hello@streammalin.fr" style={{ color: 'var(--muted)' }}>hello@streammalin.fr</a>
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            color: 'var(--muted)',
            fontSize: '0.9rem',
            lineHeight: 1.85,
          }}
        >
          {sections.map((section, i) => (
            <section
              key={i}
              style={{
                borderBottom: i < sections.length - 1 ? '1px solid var(--border)' : 'none',
                paddingBottom: i < sections.length - 1 ? '32px' : '0',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-syne), sans-serif',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    background: 'rgba(59,130,246,0.15)',
                    color: '#60a5fa',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                {section.title}
              </h2>
              <div dangerouslySetInnerHTML={{ __html: section.content }} />
            </section>
          ))}
        </div>

        <div
          style={{
            marginTop: '48px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '14px' }}>
            Pour toute question relative à vos données personnelles, contactez-nous.
          </p>
          <a
            href="mailto:hello@streammalin.fr"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#60a5fa',
              borderRadius: '10px',
              padding: '10px 20px',
              fontFamily: 'var(--font-syne), sans-serif',
              fontWeight: 700,
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            <Icon className="fa-solid fa-envelope" />
            hello@streammalin.fr
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}

const s = (text: string) => `<strong style="color:var(--text)">${text}</strong>`;
const ul = (items: string[]) =>
  `<ul style="padding-left:18px;margin-top:10px;display:flex;flex-direction:column;gap:7px;">${items.map((li) => `<li>${li}</li>`).join('')}</ul>`;

const sections = [
  {
    title: 'Responsable du traitement',
    content: `
      <p>Le responsable du traitement des données personnelles collectées sur streammalin.fr est :</p>
      ${ul([
        `${s('SAID OUARZAZI')} — Entrepreneur individuel (EI)`,
        `Nom commercial : ${s('StreamMalin')}`,
        `Adresse : 4 rue des Acacias, 89200 Avallon, France`,
        `Email : <a href="mailto:hello@streammalin.fr" style="color:#60a5fa;">hello@streammalin.fr</a>`,
        `Téléphone : 06 99 11 10 23`,
      ])}
    `,
  },
  {
    title: 'Données collectées',
    content: `
      <p>Dans le cadre de la fourniture de nos services, nous collectons les données suivantes :</p>
      ${ul([
        `${s('Adresse email')} — identifiant principal pour la gestion de votre commande et la réception de vos accès.`,
        `${s('Adresse Gmail')} (pour YouTube Premium uniquement) — nécessaire pour vous envoyer l'invitation sur votre compte Google.`,
        `${s('Numéro de commande')} — généré automatiquement lors de la validation de votre commande.`,
        `${s('Informations de paiement')} — ID de transaction PayPal ou hash de transaction crypto fourni par vous. Aucune donnée bancaire n'est collectée directement par StreamMalin.`,
        `${s('Échanges support')} — messages échangés avec notre équipe dans le cadre du traitement de votre demande.`,
      ])}
      <p style="margin-top:12px;">Nous ne collectons pas de nom, prénom, adresse postale, ni aucune donnée non nécessaire à l'exécution du service.</p>
    `,
  },
  {
    title: 'Finalités du traitement',
    content: `
      <p>Vos données sont traitées pour les finalités suivantes :</p>
      ${ul([
        `${s('Exécution de la commande')} — gestion, suivi et activation de votre abonnement.`,
        `${s('Livraison du service')} — envoi de vos identifiants d'accès par email.`,
        `${s('Support client')} — traitement de vos demandes et résolution des incidents.`,
        `${s('Obligations légales')} — conservation des données de transaction conformément aux obligations comptables et fiscales françaises.`,
        `${s('Prévention de la fraude')} — vérification de la cohérence des paiements déclarés.`,
      ])}
    `,
  },
  {
    title: 'Base légale du traitement',
    content: `
      <p>Le traitement de vos données repose sur les bases légales suivantes (RGPD, article 6) :</p>
      ${ul([
        `${s('Exécution du contrat')} — pour la gestion de votre commande et la fourniture du service.`,
        `${s('Obligation légale')} — pour la conservation des données de transaction.`,
        `${s('Intérêt légitime')} — pour la prévention de la fraude et la sécurité du service.`,
      ])}
    `,
  },
  {
    title: 'Destinataires des données — Sous-traitants',
    content: `
      <p>Vos données peuvent être transmises aux prestataires suivants, dans la stricte limite de leurs rôles respectifs :</p>
      ${ul([
        `${s('Stripe Inc.')} (États-Unis) — traitement des paiements par carte bancaire, Apple Pay et Google Pay. Données transmises : email, montant. Stripe est certifié PCI-DSS.`,
        `${s('PayPal Holdings, Inc.')} (États-Unis) — traitement des paiements PayPal. L'ID de transaction est fourni par vous après paiement.`,
        `${s('Vercel Inc.')} (États-Unis) — hébergement du site et de l'API. Vercel ne traite pas vos données au-delà de l'hébergement.`,
        `${s('Resend')} (États-Unis) — envoi des emails de confirmation et de livraison des accès.`,
        `${s('Telegram')} — communication support. Les échanges via Telegram sont soumis à la politique de confidentialité de Telegram.`,
        `${s('Neon / Supabase')} — hébergement de la base de données (selon configuration). Données stockées en UE ou aux États-Unis selon les options choisies.`,
      ])}
      <p style="margin-top:12px;">Aucune donnée n'est vendue, louée ou cédée à des tiers à des fins commerciales.</p>
    `,
  },
  {
    title: 'Transferts hors Union Européenne',
    content: `
      <p>Certains de nos prestataires (Stripe, PayPal, Vercel, Resend) sont établis aux États-Unis. Ces transferts sont encadrés par :</p>
      ${ul([
        `Les ${s('clauses contractuelles types')} approuvées par la Commission européenne,`,
        `Le cadre ${s('EU-US Data Privacy Framework')} pour les prestataires qui y adhèrent.`,
      ])}
      <p style="margin-top:10px;">Ces transferts sont nécessaires à l'exécution du contrat et à la fourniture du service.</p>
    `,
  },
  {
    title: 'Durée de conservation',
    content: `
      <p>Vos données sont conservées pour les durées suivantes :</p>
      ${ul([
        `${s('Données de commande et de transaction')} : 5 ans à compter de la date de la commande (obligation comptable et fiscale).`,
        `${s('Email et données d\'accès')} : durée de l'abonnement + 12 mois.`,
        `${s('Échanges support')} : 2 ans à compter du dernier échange.`,
      ])}
      <p style="margin-top:10px;">À l'expiration de ces délais, les données sont supprimées ou anonymisées.</p>
    `,
  },
  {
    title: 'Vos droits (RGPD)',
    content: `
      <p>Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, vous disposez des droits suivants :</p>
      ${ul([
        `${s('Droit d\'accès')} — obtenir une copie des données vous concernant.`,
        `${s('Droit de rectification')} — corriger des données inexactes ou incomplètes.`,
        `${s('Droit à l\'effacement')} — demander la suppression de vos données dans les cas prévus par le RGPD.`,
        `${s('Droit à la limitation')} — restreindre temporairement le traitement de vos données.`,
        `${s('Droit d\'opposition')} — vous opposer au traitement fondé sur l'intérêt légitime.`,
        `${s('Droit à la portabilité')} — recevoir vos données dans un format structuré et lisible par machine.`,
      ])}
      <p style="margin-top:12px;">Pour exercer ces droits, contactez-nous à : <a href="mailto:hello@streammalin.fr" style="color:#60a5fa;">hello@streammalin.fr</a>. Nous répondrons dans un délai maximum de 30 jours.</p>
      <p style="margin-top:10px;">En cas de réponse insatisfaisante, vous pouvez déposer une réclamation auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;">CNIL</a>.</p>
    `,
  },
  {
    title: 'Cookies et traceurs',
    content: `
      <p>Le site streammalin.fr utilise uniquement des cookies strictement nécessaires au fonctionnement du service (session, authentification). Aucun cookie publicitaire ni de profilage n'est déposé.</p>
      <p style="margin-top:10px;">Si des outils d'analyse d'audience venaient à être ajoutés, cette politique sera mise à jour et un bandeau de consentement sera mis en place conformément aux recommandations de la CNIL.</p>
    `,
  },
  {
    title: 'Sécurité des données',
    content: `
      <p>StreamMalin met en œuvre les mesures techniques et organisationnelles suivantes pour protéger vos données :</p>
      ${ul([
        'Connexions chiffrées (HTTPS/TLS) sur l\'ensemble du site,',
        'Accès à la base de données restreint et authentifié,',
        'Mots de passe hachés et non stockés en clair,',
        'Hébergement chez Vercel avec infrastructure sécurisée.',
      ])}
    `,
  },
  {
    title: 'Modification de la politique de confidentialité',
    content: `
      <p>StreamMalin se réserve le droit de modifier la présente politique à tout moment. La date de dernière mise à jour est indiquée en haut de cette page. En continuant à utiliser le service après une modification, vous en acceptez les nouvelles conditions.</p>
      <p style="margin-top:10px;">Pour toute question : <a href="mailto:hello@streammalin.fr" style="color:#60a5fa;">hello@streammalin.fr</a></p>
    `,
  },
];
