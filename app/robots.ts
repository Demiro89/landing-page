import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.streammalin.fr';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Espaces privés / transactionnels non destinés à l'indexation.
      disallow: ['/admin', '/checkout', '/facture/', '/api/'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
