import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-syne',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--font-dm-sans',
});

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
    <html lang="fr" className={`${syne.variable} ${dmSans.variable}`}>
      <body>
        {/* Background blobs */}
        <div className="blob blob-red" />
        <div className="blob blob-violet" />

        {children}

        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-S29G36JGQJ"
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-S29G36JGQJ');`}
        </Script>
      </body>
    </html>
  );
}
