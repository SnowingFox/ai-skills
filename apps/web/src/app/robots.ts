import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/urls';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/*',
        '/auth/*',
        '/*/auth/*',
        '/admin/*',
        '/*/admin/*',
        '/dashboard/*',
        '/*/dashboard/*',
        '/payment/*',
        '/*/payment/*',
        '/settings/*',
        '/*/settings/*',
      ],
    },
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
