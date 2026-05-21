import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * API pour gérer l'authentification Administrateur via cookie httpOnly fait maison.
 */
export async function POST(request: Request) {
  try {
    const { password, action } = await request.json();

    // Gestion de la déconnexion
    if (action === 'logout') {
      const cookieStore = await cookies();
      cookieStore.set({
        name: 'ADMIN_SECRET_TOKEN',
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'strict',
        maxAge: 0, // Détruit le cookie immédiatement
      });
      return NextResponse.json({ success: true, message: 'Déconnexion réussie' });
    }

    // Gestion de la connexion
    const adminPassword = process.env.ADMIN_PASSWORD || 'streammalin-admin';
    const secretToken = process.env.ADMIN_SECRET_TOKEN || 'SM_SUPER_SECRET_TOKEN_2026';

    if (password === adminPassword) {
      const cookieStore = await cookies();
      cookieStore.set({
        name: 'ADMIN_SECRET_TOKEN',
        value: secretToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // Session de 24 heures
      });

      return NextResponse.json({ success: true, message: 'Authentification réussie' });
    }

    return NextResponse.json(
      { success: false, error: 'Mot de passe incorrect' },
      { status: 401 }
    );
  } catch (error) {
    console.error("Erreur d'authentification admin:", error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * Permet de vérifier rapidement le statut de l'authentification côté client.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('ADMIN_SECRET_TOKEN')?.value;
  const secretToken = process.env.ADMIN_SECRET_TOKEN || 'SM_SUPER_SECRET_TOKEN_2026';

  if (token === secretToken) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
