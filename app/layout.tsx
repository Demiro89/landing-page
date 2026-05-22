import type { Metadata } from 'next';
import './globals.css';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.streammalin.fr';
const TITLE = 'StreamMalin - Abonnements Streaming Premium à Prix Malin';
const DESCRIPTION =
  "Économisez jusqu'à 75% sur vos abonnements Netflix, YouTube Premium, Spotify, Disney+ et plus. Accès instantanés et support client réactif.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: 'StreamMalin' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: APP_URL,
    siteName: 'StreamMalin',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'StreamMalin',
  url: APP_URL,
  description: DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="scroll-smooth">
      {/* Le fond et la couleur de texte sont définis dans globals.css (variables de thème). */}
      <body className="relative min-h-screen font-sans antialiased overflow-x-hidden">
        {/* Glow ambient background effects */}
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />

        {/* Application Content */}
        {children}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
