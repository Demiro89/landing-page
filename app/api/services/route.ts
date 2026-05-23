import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_SERVICES = [
  {
    id: 'netflix',
    name: 'Netflix Premium',
    tagline: 'Le cinéma UHD 4K à prix mini.',
    price: 5.49,
    original: 19.99,
    maxSlots: 4,
    active: true,
    icon: '🎬',
    gradient: 'linear-gradient(135deg, hsl(0, 100%, 55%), hsl(0, 100%, 35%))',
    features: ['Écran Ultra HD 4K', 'Compte individuel / Slot privé', 'Aucune publicité'],
  },
  {
    id: 'youtube',
    name: 'YouTube Premium',
    tagline: 'Musique et vidéos sans pub, en arrière-plan',
    price: 3.49,
    original: 13.99,
    maxSlots: 5,
    active: true,
    icon: '▶',
    gradient: 'linear-gradient(135deg, #ff0000 0%, #b30000 100%)',
    features: ['Sans publicité sur YouTube', 'Lecture en arrière-plan', 'YouTube Music Premium', 'Téléchargement hors-ligne', 'Accès transmis après validation'],
  },
  {
    id: 'spotify',
    name: 'Spotify Premium',
    tagline: 'Votre musique haute fidélité.',
    price: 2.99,
    original: 10.99,
    maxSlots: 5,
    active: true,
    icon: '🎵',
    gradient: 'linear-gradient(135deg, #1db954 0%, #117a35 100%)',
    features: ['Musique sans publicité', 'Écoute hors-ligne illimitée', 'Qualité audio maximum'],
  },
  {
    id: 'disney',
    name: 'Disney+ Premium',
    tagline: 'Marvel, Star Wars, Pixar en 4K HDR',
    price: 2.99,
    original: 15.99,
    maxSlots: 4,
    active: true,
    icon: '✦',
    gradient: 'linear-gradient(135deg, #0063e5 0%, #002d6b 100%)',
    features: ['Catalogue Disney+', 'Qualité 4K HDR & Dolby Atmos selon offre', 'Profil individuel dédié', 'Téléchargement hors-ligne', 'Accès transmis après validation'],
  },
  {
    id: 'surfshark',
    name: 'Surfshark VPN',
    tagline: 'Navigation ultra-sécurisée et écrans illimités',
    price: 1.49,
    original: 12.99,
    maxSlots: 5,
    active: true,
    icon: '🦈',
    gradient: 'linear-gradient(135deg, hsl(175, 100%, 45%), hsl(182, 100%, 25%))',
    features: ['Connexions simultanées selon offre', 'Bloqueur de pubs et trackers', 'Serveurs dans plusieurs pays', 'Politique No-Logs annoncée par le fournisseur', 'Accès transmis après validation'],
  },
];

/**
 * GET /api/services : Récupère les services actifs et sème les données initiales si vide.
 */
export async function GET() {
  try {
    // Seeder uniquement si la table est totalement vide (même les inactifs)
    const totalServices = await prisma.service.count();
    if (totalServices === 0) {
      console.log('--- BASE DE DONNÉES VIDE : SEEDING DES SERVICES PAR DÉFAUT ---');
      for (const service of DEFAULT_SERVICES) {
        await prisma.service.upsert({
          where: { id: service.id },
          update: {},
          create: service,
        });
      }
    }

    const services = await prisma.service.findMany({
      where: { active: true },
      include: {
        stocks: true,
      },
    });

    // Calculer le stock disponible réel pour chaque service
    const formattedServices = services.map(service => {
      // Trouver les comptes de stock liés qui ont encore des places
      const availableStocks = service.stocks.filter(
        stock => stock.filledSlots < stock.maxSlots
      );
      
      // Stock total restant = somme des slots disponibles (maxSlots - filledSlots)
      const availableSlotsCount = availableStocks.reduce(
        (acc, curr) => acc + (curr.maxSlots - curr.filledSlots), 
        0
      );

      return {
        ...service,
        availableSlots: availableSlotsCount,
        // On retourne l'id du premier compte de stock disponible pour le checkout
        availableStockId: availableStocks[0]?.id || null,
        // Prix dynamique basé sur le stock réel (ou fallback sur le prix conseillé)
        price: availableStocks[0]?.price || service.price
      };
    });

    return NextResponse.json({ success: true, services: formattedServices });
  } catch (error: unknown) {
    console.error('Erreur GET public services:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
