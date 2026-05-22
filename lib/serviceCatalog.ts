/**
 * Catalogue de services prêts à l'emploi pour l'admin.
 * Inspiré des plateformes type Sharesub / Spliiit.
 * Un clic dans l'admin pré-remplit le formulaire de création de service.
 */

export interface ServicePreset {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  price: number;      // prix de location mensuel proposé
  original: number;   // tarif public mensuel
  tagline: string;
  maxSlots: number;
  features: string[];
  category: 'video' | 'music' | 'youtube' | 'ai' | 'productivity' | 'vpn' | 'gaming' | 'learning' | 'press' | 'storage';
}

export const SERVICE_CATALOG: ServicePreset[] = [
  // ─── Streaming Vidéo ─────────────────────────────────────────────
  { id: 'netflix-standard', name: 'Netflix Standard', icon: '🎬', gradient: 'linear-gradient(135deg, #e50914, #831010)', price: 3.99, original: 14.99, tagline: 'Séries et films en Full HD', maxSlots: 2, features: ['Full HD', 'Profil dédié', '2 écrans simultanés'], category: 'video' },
  { id: 'netflix-premium', name: 'Netflix Premium 4K', icon: '🎬', gradient: 'linear-gradient(135deg, #e50914, #831010)', price: 4.99, original: 19.99, tagline: 'Ultra HD 4K + Dolby Atmos', maxSlots: 4, features: ['Ultra HD 4K', 'Dolby Atmos', '4 écrans simultanés', 'Téléchargement'], category: 'video' },
  { id: 'disney-standard', name: 'Disney+ Standard', icon: '✨', gradient: 'linear-gradient(135deg, #0063e5, #002a6a)', price: 2.49, original: 8.99, tagline: 'Disney, Pixar, Marvel, Star Wars', maxSlots: 2, features: ['Full HD', '2 écrans simultanés'], category: 'video' },
  { id: 'disney-premium', name: 'Disney+ Premium 4K', icon: '✨', gradient: 'linear-gradient(135deg, #0063e5, #002a6a)', price: 3.49, original: 13.99, tagline: 'Disney en Ultra HD 4K', maxSlots: 4, features: ['Ultra HD 4K', 'IMAX Enhanced', '4 écrans simultanés', 'Téléchargement'], category: 'video' },
  { id: 'prime-video', name: 'Amazon Prime Video', icon: '📦', gradient: 'linear-gradient(135deg, #00a8e1, #0066b2)', price: 1.99, original: 6.99, tagline: 'Films, séries et originals Amazon', maxSlots: 3, features: ['Ultra HD 4K', '3 écrans simultanés', 'Sans pub'], category: 'video' },
  { id: 'apple-tv-plus', name: 'Apple TV+', icon: '🍏', gradient: 'linear-gradient(135deg, #1d1d1f, #424245)', price: 2.99, original: 9.99, tagline: 'Originals Apple en 4K HDR', maxSlots: 6, features: ['Ultra HD 4K', 'Dolby Atmos', '6 partages'], category: 'video' },
  { id: 'max', name: 'Max (HBO)', icon: '🎭', gradient: 'linear-gradient(135deg, #9b27b0, #4a148c)', price: 3.49, original: 13.99, tagline: 'HBO, Warner & DC', maxSlots: 4, features: ['Ultra HD 4K', 'Dolby Atmos', '4 écrans'], category: 'video' },
  { id: 'paramount-plus', name: 'Paramount+', icon: '⛰️', gradient: 'linear-gradient(135deg, #0064ff, #003a99)', price: 2.49, original: 7.99, tagline: 'Paramount, MTV, Nickelodeon', maxSlots: 4, features: ['Ultra HD 4K', '4 écrans simultanés'], category: 'video' },
  { id: 'crunchyroll-megafan', name: 'Crunchyroll Mega Fan', icon: '🍙', gradient: 'linear-gradient(135deg, #f47521, #c45a10)', price: 2.99, original: 9.99, tagline: 'Animes en simulcast', maxSlots: 4, features: ['HD 1080p', '4 écrans', 'Téléchargement', 'Sans pub'], category: 'video' },
  { id: 'adn', name: 'ADN (Anime Digital Network)', icon: '🌸', gradient: 'linear-gradient(135deg, #00b9d4, #00798a)', price: 2.49, original: 7.99, tagline: 'Animes en VOST et VF', maxSlots: 2, features: ['Full HD', '2 écrans', 'Catalogue VF'], category: 'video' },
  { id: 'dazn-total', name: 'DAZN Total', icon: '🥊', gradient: 'linear-gradient(135deg, #f8e600, #f00056)', price: 9.99, original: 39.99, tagline: 'Sport en direct (boxe, MMA, foot)', maxSlots: 2, features: ['Full HD', 'Multi-sports', 'Direct + replay'], category: 'video' },
  { id: 'canal-cine-series', name: 'Canal+ Ciné Séries', icon: '🎞️', gradient: 'linear-gradient(135deg, #000, #2d2d2d)', price: 8.99, original: 24.99, tagline: 'Cinéma + Netflix inclus', maxSlots: 2, features: ['Full HD', 'Netflix inclus', 'Disney+ inclus'], category: 'video' },
  { id: 'canal-sport', name: 'Canal+ Sport', icon: '⚽', gradient: 'linear-gradient(135deg, #000, #2d2d2d)', price: 10.99, original: 34.99, tagline: 'Ligue 1, Champions League, F1', maxSlots: 2, features: ['Full HD', 'beIN Sport inclus', 'Multi-sports'], category: 'video' },
  { id: 'bein-sports', name: 'beIN Sports Connect', icon: '🏆', gradient: 'linear-gradient(135deg, #d32027, #7d1216)', price: 4.99, original: 15.00, tagline: 'Sports en direct', maxSlots: 2, features: ['Full HD', 'Direct + replay'], category: 'video' },
  { id: 'rmc-sport', name: 'RMC Sport', icon: '🏉', gradient: 'linear-gradient(135deg, #d52b1e, #951a10)', price: 4.99, original: 19.00, tagline: 'UFC, Champions League, NBA', maxSlots: 2, features: ['Full HD', 'UFC inclus'], category: 'video' },
  { id: 'mubi', name: 'Mubi', icon: '🎥', gradient: 'linear-gradient(135deg, #000, #444)', price: 2.99, original: 12.99, tagline: 'Cinéma d\'auteur et films cultes', maxSlots: 2, features: ['Ultra HD', 'Catalogue curé'], category: 'video' },
  { id: 'molotov-plus', name: 'Molotov Plus', icon: '📺', gradient: 'linear-gradient(135deg, #6e3ad2, #2a1675)', price: 1.99, original: 5.99, tagline: 'TV en direct + replay 100h', maxSlots: 2, features: ['Full HD', 'Replay 100h', '4 chaînes simultanées'], category: 'video' },
  { id: 'ocs', name: 'OCS', icon: '🎬', gradient: 'linear-gradient(135deg, #ff7900, #b35400)', price: 2.99, original: 10.99, tagline: 'HBO + cinéma récent', maxSlots: 4, features: ['Full HD', '4 écrans', 'HBO Originals'], category: 'video' },

  // ─── Streaming Musique ───────────────────────────────────────────
  { id: 'spotify-family', name: 'Spotify Premium Famille', icon: '🎵', gradient: 'linear-gradient(135deg, #1db954, #0a6e2c)', price: 2.49, original: 17.99, tagline: 'Musique sans pub pour 6 personnes', maxSlots: 6, features: ['Sans pub', 'Téléchargement', '6 comptes', 'Spotify Kids'], category: 'music' },
  { id: 'spotify-duo', name: 'Spotify Premium Duo', icon: '🎵', gradient: 'linear-gradient(135deg, #1db954, #0a6e2c)', price: 2.99, original: 14.99, tagline: 'Pour 2 personnes vivant ensemble', maxSlots: 2, features: ['Sans pub', 'Téléchargement', '2 comptes', 'Duo Mix'], category: 'music' },
  { id: 'spotify-individual', name: 'Spotify Premium Individuel', icon: '🎵', gradient: 'linear-gradient(135deg, #1db954, #0a6e2c)', price: 4.99, original: 11.99, tagline: 'Compte individuel premium', maxSlots: 1, features: ['Sans pub', 'Téléchargement', 'Qualité supérieure'], category: 'music' },
  { id: 'apple-music-family', name: 'Apple Music Famille', icon: '🎶', gradient: 'linear-gradient(135deg, #fb2056, #fa233b)', price: 2.99, original: 17.99, tagline: 'Musique pour 6 personnes', maxSlots: 6, features: ['Lossless', 'Dolby Atmos', '6 comptes'], category: 'music' },
  { id: 'apple-music-individual', name: 'Apple Music Individuel', icon: '🎶', gradient: 'linear-gradient(135deg, #fb2056, #fa233b)', price: 4.99, original: 10.99, tagline: 'Compte individuel', maxSlots: 1, features: ['Lossless', 'Dolby Atmos'], category: 'music' },
  { id: 'deezer-family', name: 'Deezer Famille', icon: '🎼', gradient: 'linear-gradient(135deg, #ef5466, #ff8c00)', price: 2.99, original: 19.99, tagline: 'Musique pour 6 profils', maxSlots: 6, features: ['HiFi', '6 profils', 'Sans pub'], category: 'music' },
  { id: 'deezer-premium', name: 'Deezer Premium', icon: '🎼', gradient: 'linear-gradient(135deg, #ef5466, #ff8c00)', price: 4.49, original: 11.99, tagline: 'Compte premium individuel', maxSlots: 1, features: ['HiFi', 'Sans pub', 'Téléchargement'], category: 'music' },
  { id: 'youtube-music', name: 'YouTube Music Premium', icon: '🎧', gradient: 'linear-gradient(135deg, #ff0000, #c4302b)', price: 2.49, original: 10.99, tagline: 'Musique YouTube sans pub', maxSlots: 5, features: ['Sans pub', 'Téléchargement', 'Écoute en arrière-plan'], category: 'music' },
  { id: 'tidal-hifi-plus', name: 'Tidal HiFi Plus', icon: '🌊', gradient: 'linear-gradient(135deg, #000, #333)', price: 4.99, original: 19.99, tagline: 'Master Quality + Dolby Atmos', maxSlots: 1, features: ['Master Quality', 'Dolby Atmos', 'Sony 360'], category: 'music' },
  { id: 'qobuz-studio', name: 'Qobuz Studio', icon: '🎷', gradient: 'linear-gradient(135deg, #008cff, #0050a3)', price: 4.99, original: 14.99, tagline: 'Hi-Res Audio jusqu\'à 24-bit', maxSlots: 1, features: ['Hi-Res 24-bit', 'Magazine inclus'], category: 'music' },
  { id: 'amazon-music', name: 'Amazon Music Unlimited', icon: '🔊', gradient: 'linear-gradient(135deg, #00a8e1, #0066b2)', price: 2.99, original: 10.99, tagline: '100 millions de titres en HD', maxSlots: 6, features: ['HD', 'Ultra HD', 'Dolby Atmos'], category: 'music' },

  // ─── YouTube ──────────────────────────────────────────────────────
  { id: 'youtube-family', name: 'YouTube Premium Famille', icon: '▶️', gradient: 'linear-gradient(135deg, #ff0000, #c4302b)', price: 3.49, original: 23.99, tagline: 'YouTube sans pub + Music pour 6', maxSlots: 5, features: ['Sans pub', 'YouTube Music inclus', '5 invités', 'Téléchargement'], category: 'youtube' },
  { id: 'youtube-individual', name: 'YouTube Premium Individuel', icon: '▶️', gradient: 'linear-gradient(135deg, #ff0000, #c4302b)', price: 4.99, original: 12.99, tagline: 'YouTube sans pub', maxSlots: 1, features: ['Sans pub', 'YouTube Music inclus', 'Arrière-plan'], category: 'youtube' },

  // ─── IA & Productivité ───────────────────────────────────────────
  { id: 'chatgpt-plus', name: 'ChatGPT Plus', icon: '🤖', gradient: 'linear-gradient(135deg, #10a37f, #053a2a)', price: 5.99, original: 22.00, tagline: 'GPT-5, DALL-E, navigation web', maxSlots: 4, features: ['GPT-5', 'Images DALL-E', 'Plugins', 'Vision'], category: 'ai' },
  { id: 'chatgpt-team', name: 'ChatGPT Team', icon: '🤖', gradient: 'linear-gradient(135deg, #10a37f, #053a2a)', price: 7.99, original: 30.00, tagline: 'GPT-5 + collaboration équipe', maxSlots: 5, features: ['GPT-5', 'Espaces partagés', 'Confidentialité'], category: 'ai' },
  { id: 'claude-pro', name: 'Claude Pro', icon: '🧠', gradient: 'linear-gradient(135deg, #ce7f4a, #8b502c)', price: 5.99, original: 22.00, tagline: 'Claude Opus 4.7 illimité', maxSlots: 4, features: ['Claude Opus 4.7', '5x plus d\'usage', 'Projets'], category: 'ai' },
  { id: 'perplexity-pro', name: 'Perplexity Pro', icon: '🔍', gradient: 'linear-gradient(135deg, #20808d, #0e3d44)', price: 4.99, original: 20.00, tagline: 'Recherche IA illimitée', maxSlots: 4, features: ['Pro Search illimité', 'Modèles avancés', 'Fichiers'], category: 'ai' },
  { id: 'midjourney-pro', name: 'Midjourney Pro', icon: '🎨', gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)', price: 14.99, original: 60.00, tagline: 'Génération d\'images IA illimitée', maxSlots: 2, features: ['Mode stealth', 'Génération rapide', 'Usage commercial'], category: 'ai' },
  { id: 'midjourney-standard', name: 'Midjourney Standard', icon: '🎨', gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)', price: 7.99, original: 30.00, tagline: 'Génération d\'images IA', maxSlots: 2, features: ['15h GPU/mois', 'Génération rapide'], category: 'ai' },
  { id: 'gemini-advanced', name: 'Google AI Premium (Gemini Advanced)', icon: '✦', gradient: 'linear-gradient(135deg, #4285f4, #9333ea)', price: 5.99, original: 21.99, tagline: 'Gemini Ultra + 2 To Drive', maxSlots: 1, features: ['Gemini Ultra', '2 To Google One', 'Workspace IA'], category: 'ai' },
  { id: 'microsoft-365-family', name: 'Microsoft 365 Famille', icon: '📊', gradient: 'linear-gradient(135deg, #0078d4, #003e75)', price: 1.99, original: 10.00, tagline: 'Office + 1 To OneDrive x6', maxSlots: 6, features: ['Word, Excel, PowerPoint', '1 To OneDrive/personne', '6 utilisateurs'], category: 'productivity' },
  { id: 'microsoft-365-personnel', name: 'Microsoft 365 Personnel', icon: '📊', gradient: 'linear-gradient(135deg, #0078d4, #003e75)', price: 3.99, original: 7.00, tagline: 'Office + 1 To OneDrive', maxSlots: 1, features: ['Word, Excel, PowerPoint', '1 To OneDrive'], category: 'productivity' },
  { id: 'google-one-2to', name: 'Google One 2 To', icon: '☁️', gradient: 'linear-gradient(135deg, #4285f4, #34a853)', price: 1.99, original: 9.99, tagline: '2 To de stockage Google', maxSlots: 5, features: ['2 To', 'Photos illimitées', '5 invités famille'], category: 'storage' },
  { id: 'icloud-2to', name: 'iCloud+ 2 To', icon: '☁️', gradient: 'linear-gradient(135deg, #007aff, #0050a3)', price: 1.99, original: 9.99, tagline: '2 To iCloud partage famille', maxSlots: 6, features: ['2 To', 'Relais privé', '6 personnes'], category: 'storage' },
  { id: 'dropbox-plus', name: 'Dropbox Plus', icon: '📁', gradient: 'linear-gradient(135deg, #0061ff, #003a99)', price: 4.99, original: 11.99, tagline: '2 To de stockage Dropbox', maxSlots: 1, features: ['2 To', 'Sync intelligente'], category: 'storage' },
  { id: 'notion-plus', name: 'Notion Plus', icon: '📝', gradient: 'linear-gradient(135deg, #2f3437, #6b6b6b)', price: 3.99, original: 11.50, tagline: 'Workspace illimité', maxSlots: 1, features: ['Pages illimitées', 'Historique 30j', 'Notion AI add-on'], category: 'productivity' },
  { id: 'canva-pro', name: 'Canva Pro', icon: '🖌️', gradient: 'linear-gradient(135deg, #00c4cc, #7d2ae8)', price: 3.99, original: 11.99, tagline: 'Design pro + IA générative', maxSlots: 5, features: ['Banque premium', 'Background remover', 'Magic Studio IA'], category: 'productivity' },
  { id: 'adobe-creative-cloud', name: 'Adobe Creative Cloud', icon: '🎨', gradient: 'linear-gradient(135deg, #fa0f00, #b00b00)', price: 14.99, original: 71.99, tagline: 'Toutes les apps Adobe', maxSlots: 1, features: ['Photoshop, Premiere, Illustrator…', '100 Go cloud', 'Firefly IA'], category: 'productivity' },
  { id: 'adobe-photo', name: 'Adobe Photographie', icon: '📸', gradient: 'linear-gradient(135deg, #fa0f00, #b00b00)', price: 4.99, original: 14.29, tagline: 'Photoshop + Lightroom', maxSlots: 1, features: ['Photoshop', 'Lightroom', '20 Go cloud'], category: 'productivity' },
  { id: 'figma-pro', name: 'Figma Professional', icon: '🎯', gradient: 'linear-gradient(135deg, #f24e1e, #a259ff)', price: 5.99, original: 15.00, tagline: 'Design UI/UX pro', maxSlots: 1, features: ['Projets illimités', 'Historique illimité', 'Composants partagés'], category: 'productivity' },
  { id: 'grammarly-premium', name: 'Grammarly Premium', icon: '✍️', gradient: 'linear-gradient(135deg, #15c39a, #0a7a5e)', price: 4.99, original: 12.00, tagline: 'Correction et style avancés', maxSlots: 1, features: ['Style avancé', 'Plagiat', 'Suggestions IA'], category: 'productivity' },

  // ─── VPN & Sécurité ──────────────────────────────────────────────
  { id: 'nordvpn', name: 'NordVPN Plus', icon: '🛡️', gradient: 'linear-gradient(135deg, #4687ff, #1a3aad)', price: 1.99, original: 7.99, tagline: 'VPN + gestionnaire mdp', maxSlots: 6, features: ['6 appareils', 'Threat Protection', 'NordPass inclus'], category: 'vpn' },
  { id: 'expressvpn', name: 'ExpressVPN', icon: '🔐', gradient: 'linear-gradient(135deg, #da3940, #8d181c)', price: 2.49, original: 12.95, tagline: 'VPN ultra-rapide', maxSlots: 5, features: ['5 appareils', 'TrustedServer', 'Lightway protocol'], category: 'vpn' },
  { id: 'surfshark', name: 'Surfshark VPN One', icon: '🦈', gradient: 'linear-gradient(135deg, #1ebfbf, #25a39e)', price: 1.49, original: 12.99, tagline: 'Appareils illimités', maxSlots: 10, features: ['Illimité', 'Antivirus', 'Alert + Search'], category: 'vpn' },
  { id: 'proton-unlimited', name: 'Proton Unlimited', icon: '🔒', gradient: 'linear-gradient(135deg, #6d4aff, #3b2a8e)', price: 2.99, original: 9.99, tagline: 'Mail + VPN + Drive + Pass', maxSlots: 4, features: ['500 Go Drive', 'ProtonVPN Plus', 'ProtonPass'], category: 'vpn' },
  { id: 'cyberghost', name: 'CyberGhost VPN', icon: '👻', gradient: 'linear-gradient(135deg, #ffb400, #cc8800)', price: 1.49, original: 11.99, tagline: 'VPN + 7 appareils', maxSlots: 7, features: ['7 appareils', 'Streaming optimisé'], category: 'vpn' },
  { id: '1password-family', name: '1Password Family', icon: '🔑', gradient: 'linear-gradient(135deg, #0572ec, #003e8a)', price: 1.49, original: 4.99, tagline: 'Gestionnaire de mdp famille', maxSlots: 5, features: ['5 membres', 'Watchtower', 'Voyage sécurisé'], category: 'vpn' },

  // ─── Gaming ──────────────────────────────────────────────────────
  { id: 'xbox-game-pass-ultimate', name: 'Xbox Game Pass Ultimate', icon: '🎮', gradient: 'linear-gradient(135deg, #107c10, #0a3f0a)', price: 4.99, original: 17.99, tagline: 'PC + Console + Cloud Gaming', maxSlots: 2, features: ['400+ jeux', 'Day One releases', 'EA Play inclus', 'Cloud Gaming'], category: 'gaming' },
  { id: 'playstation-plus-extra', name: 'PlayStation Plus Extra', icon: '🕹️', gradient: 'linear-gradient(135deg, #003791, #001a45)', price: 3.99, original: 13.99, tagline: 'Catalogue de 400+ jeux PS', maxSlots: 2, features: ['400+ jeux PS4/PS5', 'Multi en ligne', 'Cloud save'], category: 'gaming' },
  { id: 'playstation-plus-premium', name: 'PlayStation Plus Premium', icon: '🕹️', gradient: 'linear-gradient(135deg, #003791, #001a45)', price: 4.99, original: 16.99, tagline: 'Extra + classiques + démos', maxSlots: 2, features: ['600+ jeux', 'Jeux PS1/PS2/PS3', 'Cloud Streaming'], category: 'gaming' },
  { id: 'nintendo-switch-online-family', name: 'Nintendo Switch Online Famille', icon: '🍄', gradient: 'linear-gradient(135deg, #e60012, #8d0009)', price: 1.49, original: 5.83, tagline: 'Online + NES/SNES x8 comptes', maxSlots: 8, features: ['8 comptes', 'NES/SNES/N64', 'Cloud save'], category: 'gaming' },
  { id: 'geforce-now-ultimate', name: 'GeForce NOW Ultimate', icon: '⚡', gradient: 'linear-gradient(135deg, #76b900, #4a7800)', price: 7.99, original: 21.99, tagline: 'Cloud gaming RTX 4080', maxSlots: 1, features: ['RTX 4080', '4K 120fps', '8h sessions'], category: 'gaming' },
  { id: 'ubisoft-plus', name: 'Ubisoft+ Premium', icon: '🎯', gradient: 'linear-gradient(135deg, #00aeff, #006bb3)', price: 4.99, original: 17.99, tagline: 'Tous les jeux Ubisoft', maxSlots: 2, features: ['100+ jeux Ubisoft', 'Releases Day One', 'DLC inclus'], category: 'gaming' },
  { id: 'ea-play-pro', name: 'EA Play Pro', icon: '🏈', gradient: 'linear-gradient(135deg, #ff4747, #b32525)', price: 3.99, original: 16.99, tagline: 'Catalogue EA complet', maxSlots: 2, features: ['Tous les jeux EA', 'Editions Deluxe', 'DLC inclus'], category: 'gaming' },

  // ─── Apprentissage & Bien-être ───────────────────────────────────
  { id: 'duolingo-super', name: 'Duolingo Super Famille', icon: '🦉', gradient: 'linear-gradient(135deg, #58cc02, #2e6a01)', price: 1.99, original: 10.42, tagline: 'Apprentissage langues 6 personnes', maxSlots: 6, features: ['Sans pub', '6 comptes', 'Exercices illimités'], category: 'learning' },
  { id: 'babbel', name: 'Babbel illimité', icon: '🗣️', gradient: 'linear-gradient(135deg, #ff9514, #cc7610)', price: 3.99, original: 12.49, tagline: '14 langues à apprendre', maxSlots: 1, features: ['14 langues', 'Babbel Live', 'Hors-ligne'], category: 'learning' },
  { id: 'headspace-family', name: 'Headspace Famille', icon: '🧘', gradient: 'linear-gradient(135deg, #f47d31, #b35517)', price: 2.99, original: 12.50, tagline: 'Méditation pour 6 personnes', maxSlots: 6, features: ['6 comptes', 'Sleepcasts', 'Cours guidés'], category: 'learning' },
  { id: 'calm-premium', name: 'Calm Premium', icon: '🌙', gradient: 'linear-gradient(135deg, #4361ee, #1a2f9c)', price: 2.99, original: 12.49, tagline: 'Méditation & sommeil', maxSlots: 1, features: ['Sleep Stories', 'Musique relaxante', 'Programmes'], category: 'learning' },
  { id: 'strava-premium', name: 'Strava Premium', icon: '🏃', gradient: 'linear-gradient(135deg, #fc4c02, #a23100)', price: 1.99, original: 8.99, tagline: 'Sport et performance', maxSlots: 1, features: ['Analyses avancées', 'Routes', 'Goals'], category: 'learning' },

  // ─── Presse & Audio ──────────────────────────────────────────────
  { id: 'audible-premium', name: 'Audible Premium', icon: '🎧', gradient: 'linear-gradient(135deg, #f7951d, #cb6e10)', price: 4.99, original: 9.95, tagline: '1 livre audio/mois + catalogue', maxSlots: 1, features: ['1 livre/mois', 'Catalogue Plus', 'Podcasts originaux'], category: 'press' },
  { id: 'kindle-unlimited', name: 'Kindle Unlimited', icon: '📚', gradient: 'linear-gradient(135deg, #00a8e1, #006b8e)', price: 3.99, original: 9.99, tagline: 'Lecture illimitée 4M titres', maxSlots: 1, features: ['4M titres', 'Magazines', 'Audible Narration'], category: 'press' },
  { id: 'storytel', name: 'Storytel illimité', icon: '🎙️', gradient: 'linear-gradient(135deg, #ec5f4b, #a13524)', price: 5.99, original: 14.99, tagline: 'Livres audio + ebooks', maxSlots: 1, features: ['Écoute illimitée', 'Mode famille'], category: 'press' },
  { id: 'le-monde', name: 'Le Monde Numérique', icon: '📰', gradient: 'linear-gradient(135deg, #1a1a1a, #4a4a4a)', price: 3.99, original: 11.99, tagline: 'Le Monde + applis dédiées', maxSlots: 1, features: ['Web + apps', 'Archives', 'Newsletters'], category: 'press' },
  { id: 'le-figaro-premium', name: 'Le Figaro Premium', icon: '📰', gradient: 'linear-gradient(135deg, #0a4a8f, #052a52)', price: 4.99, original: 12.90, tagline: 'Tous les articles du Figaro', maxSlots: 1, features: ['Articles illimités', 'Magazine', 'Newsletter'], category: 'press' },
  { id: 'mediapart', name: 'Mediapart', icon: '📰', gradient: 'linear-gradient(135deg, #d72424, #8c1717)', price: 4.99, original: 11.00, tagline: 'Journalisme d\'enquête', maxSlots: 1, features: ['Enquêtes', 'Direct', 'Newsletter'], category: 'press' },
  { id: 'lequipe-digital', name: "L'Équipe Digital", icon: '⚽', gradient: 'linear-gradient(135deg, #ffd400, #b39400)', price: 2.99, original: 9.99, tagline: 'Sports + journal numérique', maxSlots: 1, features: ['Tous les articles', 'Live scores', 'Journal numérique'], category: 'press' },
];

export const CATALOG_CATEGORIES: { id: ServicePreset['category']; label: string; icon: string }[] = [
  { id: 'video', label: 'Streaming Vidéo', icon: '🎬' },
  { id: 'music', label: 'Streaming Musique', icon: '🎵' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'ai', label: 'Intelligence Artificielle', icon: '🤖' },
  { id: 'productivity', label: 'Productivité', icon: '📊' },
  { id: 'storage', label: 'Cloud & Stockage', icon: '☁️' },
  { id: 'vpn', label: 'VPN & Sécurité', icon: '🛡️' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'learning', label: 'Apprentissage & Bien-être', icon: '🧘' },
  { id: 'press', label: 'Presse & Audio', icon: '📰' },
];
