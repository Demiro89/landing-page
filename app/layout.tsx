import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StreamMalin - Abonnements Streaming Premium à Prix Malin',
  description: 'Économisez jusqu\'à 75% sur vos abonnements Netflix, YouTube Premium, Spotify, Disney+ et plus. Accès instantanés et support client réactif.',
  keywords: 'streaming, pas cher, abonnement, netflix, spotify, youtube premium, disney, vpn, streammalin',
  authors: [{ name: 'StreamMalin Team' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="scroll-smooth">
      <body className="relative min-h-screen bg-[#0b0c10] text-[#e5e7eb] font-sans antialiased overflow-x-hidden">
        {/* Glow ambient background effects */}
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        
        {/* Application Content */}
        {children}
      </body>
    </html>
  );
}
