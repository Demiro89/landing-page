import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.streammalin.fr';
const TITLE = 'StreamMalin | Location d’abonnements streaming';
const DESCRIPTION =
  'Location d’abonnements vidéo et musique selon disponibilité. Consultez les prix mensuels, les conditions d’accès et l’éligibilité. Service indépendant, support en français.';

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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#101416',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'StreamMalin',
  url: APP_URL,
  description: DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce CSP généré par le proxy, appliqué au script JSON-LD inline.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="fr" className="scroll-smooth">
      {/* Le fond et la couleur de texte sont définis dans globals.css (variables de thème). */}
      <body className="relative min-h-screen font-sans antialiased overflow-x-hidden">
        {/* Application Content */}
        {children}

        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      </body>
    </html>
  );
}
