import Link from 'next/link';
import { COMPANY, NON_AFFILIATION_SHORT } from '@/lib/legalConfig';
import { SiteWordmark } from './SiteHeader';

const columns = [
  {
    title: 'Boutique',
    links: [
      ['Les abonnements', '/#offres'],
      ['Simulateur d’économies', '/#calculateur'],
      ['Questions fréquentes', '/#faq'],
      ['Espace client', '/espace-client'],
    ],
  },
  {
    title: 'Aide & support',
    links: [
      ['Contact', '/contact'],
      ['Réclamation', '/reclamation'],
      ['Droit de rétractation', '/retractation'],
      ['Remboursements', '/remboursements'],
      ['Médiation de la consommation', '/mediation'],
    ],
  },
  {
    title: 'Informations légales',
    links: [
      ['Conditions générales de vente', '/cgv'],
      ['Mentions légales', '/mentions-legales'],
      ['Politique de confidentialité', '/politique-confidentialite'],
      ['Gestion des cookies', '/cookies'],
      ['Non-affiliation', '/non-affiliation'],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-width">
        <div className="site-footer-grid">
          <div className="site-footer-intro">
            <Link href="/" className="site-wordmark"><SiteWordmark /></Link>
            <p>Location d’abonnements streaming selon les offres disponibles. Service indépendant édité en micro-entreprise.</p>
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </div>
          {columns.map(({ title, links }) => (
            <nav aria-label={title} key={title}>
              <h2>{title}</h2>
              <ul>{links.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
            </nav>
          ))}
        </div>
        <div className="site-footer-note">
          <p>{NON_AFFILIATION_SHORT}</p>
          <p>© {new Date().getFullYear()} StreamMalin. TVA non applicable, art. 293 B du CGI.</p>
        </div>
      </div>
    </footer>
  );
}
