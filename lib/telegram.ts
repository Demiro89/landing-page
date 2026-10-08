export async function sendTelegramNotification(message: string): Promise<boolean> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[Telegram] Notification non envoyée : configuration absente.');
    return false;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      console.error('[Telegram] Notification refusée par le fournisseur.');
      return false;
    }
    return true;
  } catch {
    console.error('[Telegram] Notification non confirmée.');
    return false;
  }
}
