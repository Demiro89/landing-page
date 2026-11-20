import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Mail, UserRound } from 'lucide-react';
import PublicShell from '@/components/PublicShell';
import ContactForm from '@/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contact et support | StreamMalin',
  description:
    'Disponibilité, éligibilité ou suivi de votre abonnement : contactez le support StreamMalin.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <PublicShell>
      <div className="contact-heading">
        <p className="public-eyebrow">SUPPORT STREAMMALIN</p>
        <h1>Parlons de votre abonnement</h1>
        <p>
          Disponibilité d’une offre, compatibilité de votre compte ou accès
          existant : adressez votre question à notre support en français.
        </p>
      </div>
      <div className="contact-layout">
        <div className="contact-form-card">
          <ContactForm />
        </div>
        <aside className="contact-aside" aria-label="Autres moyens de contact">
          <div className="contact-aside-card">
            <div className="contact-aside-head">
              <span className="contact-aside-icon"><UserRound size={17} aria-hidden="true" /></span>
              <h2>Déjà client ?</h2>
            </div>
            <p>
              Retrouvez votre référence et le suivi de votre abonnement dans{' '}
              <Link href="/espace-client">votre espace client</Link>.
            </p>
          </div>
          <div className="contact-aside-card">
            <div className="contact-aside-head">
              <span className="contact-aside-icon"><Mail size={17} aria-hidden="true" /></span>
              <h2>Contact par e-mail</h2>
            </div>
            <p>
              <a href="mailto:hello@streammalin.fr">hello@streammalin.fr</a>
            </p>
          </div>
          <div className="contact-aside-card">
            <div className="contact-aside-head">
              <span className="contact-aside-icon"><FileText size={17} aria-hidden="true" /></span>
              <h2>Une difficulté ?</h2>
            </div>
            <p>
              Pour une demande formelle, consultez la page{' '}
              <Link href="/reclamation">Réclamation</Link>. Le formulaire de{' '}
              <Link href="/retractation">rétractation</Link> reste distinct.
            </p>
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
