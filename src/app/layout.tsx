import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StreamMalin — YouTube & Disney+ à -50%',
  description:
    'YouTube Premium dès 5,99€/mois et Disney+ dès 4,99€/mois. Accès instantané, sans engagement, support 7j/7.',
  keywords: 'YouTube Premium, Disney+, abonnement partagé, co-abonnement, streaming pas cher',
  openGraph: {
    title: 'StreamMalin — YouTube & Disney+ à -50%',
    description: 'Accès premium instantané à prix cassé.',
    url: 'https://streammalin.fr',
    siteName: 'StreamMalin',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StreamMalin — YouTube & Disney+ à -50%',
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
        {/* Font Awesome */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-S29G36JGQJ" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-S29G36JGQJ');
            `,
          }}
        />
      </head>
      <body>
        {/* Background blobs */}
        <div className="blob blob-red" />
        <div className="blob blob-violet" />

        {children}
      </body>
    </html>
  );
}
