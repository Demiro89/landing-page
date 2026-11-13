import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accès privé | StreamMalin',
  robots: { index: false, follow: false },
};

export default function AccesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
