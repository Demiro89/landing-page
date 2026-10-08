import type { Metadata } from 'next';
import Link from 'next/link';
import PublicShell from '@/components/PublicShell';
import ContactForm from '@/components/ContactForm';

export const metadata: Metadata = { title: 'Contact et support | StreamMalin', description: 'Disponibilité, éligibilité ou suivi de votre abonnement : contactez le support StreamMalin.', alternates: { canonical: '/contact' } };

export default function ContactPage() {
  return <PublicShell><div className="contact-heading"><p className="public-eyebrow">SUPPORT STREAMMALIN</p><h1>Parlons de votre abonnement</h1><p>Disponibilité d’une offre, compatibilité de votre compte ou accès existant : adressez votre question à notre support en français.</p></div><div className="contact-layout"><ContactForm /><aside className="contact-aside"><h2>Déjà client ?</h2><p>Retrouvez votre référence et le suivi de votre abonnement dans <Link href="/espace-client">votre espace client</Link>.</p><h2>Contact par e-mail</h2><p><a href="mailto:hello@streammalin.fr">hello@streammalin.fr</a></p><h2>Une difficulté ?</h2><p>Pour une demande formelle, consultez la page <Link href="/reclamation">Réclamation</Link>. Le formulaire de <Link href="/retractation">rétractation</Link> reste distinct.</p></aside></div></PublicShell>;
}
