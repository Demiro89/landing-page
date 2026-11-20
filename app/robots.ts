import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/appUrl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Espaces privés / transactionnels non destinés à l'indexation.
      disallow: ['/acces', '/admin', '/checkout', '/facture/', '/api/', '/commande/', '/espace-client', '/cgv/versions/'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
