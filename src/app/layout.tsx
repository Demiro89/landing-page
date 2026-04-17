// 📄 FILE: src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';

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
        {/* Theme init — doit s'exécuter AVANT le paint pour éviter le flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sm-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
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
        {/* Google Analytics — injected conditionally by CookieBanner on consent */}
      </head>
      <body>
        {/* Background blobs */}
        <div className="blob blob-red" />
        <div className="blob blob-violet" />

        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
