import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Espace Client — StreamMalin',
  description: 'Gérez vos abonnements, vos factures et vos paramètres.',
  robots: 'noindex',
};

export default function EspaceClientPage() {
  redirect('/?espace-client=1');
}
