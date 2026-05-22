import type { Metadata } from 'next';

// Espace d'administration : jamais indexé par les moteurs de recherche.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
