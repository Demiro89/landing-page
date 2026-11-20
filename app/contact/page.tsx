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
        <p className="public-eyebrow">Support StreamMalin</p>
        <h1>Parlons de votre <em className="editorial-serif">abonnement</em></h1>
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
          <div className="contact-aside-block">
            <div className="contact-aside-head">
              <UserRound size={16} aria-hidden="true" />
              <h2>Déjà client ?</h2>
            </div>
            <p>
              Retrouvez votre référence et le suivi de votre abonnement dans{' '}
              <Link href="/espace-client">votre espace client</Link>.
            </p>
          </div>
          <div className="contact-aside-block">
            <div className="contact-aside-head">
              <Mail size={16} aria-hidden="true" />
              <h2>Contact direct</h2>
            </div>
            <p>
              <a href="mailto:hello@streammalin.fr">hello@streammalin.fr</a>
            </p>
          </div>
          <div className="contact-aside-block">
            <div className="contact-aside-head">
              <FileText size={16} aria-hidden="true" />
              <h2>Démarches formelles</h2>
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
