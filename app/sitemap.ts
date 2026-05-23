import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.streammalin.fr';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number; changeFrequency: 'daily' | 'monthly' }[] = [
    { path: '', priority: 1, changeFrequency: 'daily' },
    { path: '/cgv', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/mentions-legales', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/politique-confidentialite', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/cookies', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/reclamation', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/mediation', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/non-affiliation', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/retractation', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/remboursements', priority: 0.3, changeFrequency: 'monthly' },
  ];
  return routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
