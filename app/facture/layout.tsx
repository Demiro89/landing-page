import type { Metadata } from 'next';

// Factures clients : données personnelles, jamais indexées.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FactureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
