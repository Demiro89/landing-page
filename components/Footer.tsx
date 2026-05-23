import React from 'react';
import { COMPANY, NON_AFFILIATION_SHORT } from '@/lib/legalConfig';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Informations légales',
    links: [
      { label: 'Conditions générales de vente', href: '/cgv' },
      { label: 'Mentions légales', href: '/mentions-legales' },
      { label: 'Politique de confidentialité', href: '/politique-confidentialite' },
      { label: 'Gestion des cookies', href: '/cookies' },
    ],
  },
  {
    title: 'Aide & support',
    links: [
      { label: 'Contact / Support', href: `mailto:${COMPANY.email}` },
      { label: 'Réclamation', href: '/reclamation' },
      { label: 'Médiation de la consommation', href: '/mediation' },
      { label: 'FAQ & guide des abonnements', href: '/#faq' },
    ],
  },
  {
    title: 'StreamMalin',
    links: [
      { label: 'Nos offres', href: '/#offres' },
      { label: 'Non-affiliation', href: '/non-affiliation' },
      { label: 'Droit de rétractation', href: '/retractation' },
      { label: 'Remboursements', href: '/remboursements' },
    ],
  },
];

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(8,9,13,0.6)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px 28px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 32,
          }}
        >
          {/* Brand */}
          <div>
            <div className="nav-logo" style={{ marginBottom: 12 }}>
              <div className="nav-logo-icon">SM</div>
              <span className="gradient-text">StreamMalin</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 260 }}>
              Mise à disposition temporaire d&apos;accès numériques à prix malin. Service indépendant
              édité en micro-entreprise.
            </p>
            <a
              href={`mailto:${COMPANY.email}`}
              style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none', display: 'inline-block', marginTop: 10 }}
            >
              {COMPANY.email}
            </a>
          </div>

          {/* Link columns */}
          {COLUMNS.map(col => (
            <div key={col.title}>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: 14,
                }}
              >
                {col.title}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {col.links.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      style={{ fontSize: '0.84rem', color: 'var(--text-gray)', textDecoration: 'none' }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Non-affiliation + copyright */}
        <div
          style={{
            marginTop: 36,
            paddingTop: 22,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
            {NON_AFFILIATION_SHORT}
          </p>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
            © {new Date().getFullYear()} StreamMalin — Tous droits réservés. TVA non applicable, art. 293 B du CGI.
          </p>
        </div>
      </div>
    </footer>
  );
}
