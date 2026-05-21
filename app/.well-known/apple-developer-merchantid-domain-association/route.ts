import { NextResponse } from 'next/server';

/**
 * Sert le fichier de vérification Apple Pay pour Stripe.
 * Contenu à récupérer depuis : Stripe Dashboard → Settings → Apple Pay → Add domain → Download file
 * puis à coller dans APPLE_PAY_DOMAIN_FILE (variable d'environnement) ou remplacer le contenu ici.
 */
export async function GET() {
  const content = process.env.APPLE_PAY_DOMAIN_FILE || '';

  if (!content) {
    return new NextResponse('Apple Pay domain file not configured', { status: 404 });
  }

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
