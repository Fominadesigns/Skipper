import { NextResponse } from 'next/server';
import { isSignedIn } from '@/lib/auth';
import { botToken, webhookSecret, botUsername, tgCall, clientAppUrl } from '@/lib/tg';

export const dynamic = 'force-dynamic';

/* Під'єднати бота: кажемо Telegram, куди слати повідомлення.
   Адресу беремо з того, звідки відкрита CRM, — вписувати руками
   нічого не треба. Натискати один раз після першого деплою. */

export async function POST(req) {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  const t = botToken();
  if (!t) return NextResponse.json({ error: 'Не заданий SKIPPER_BOT_TOKEN' }, { status: 400 });

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const url = `https://${host}/api/tg`;
  try {
    const r = await fetch(`https://api.telegram.org/bot${t}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url, secret_token: webhookSecret(),
        allowed_updates: ['message', 'callback_query'], drop_pending_updates: true,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) return NextResponse.json({ error: 'Telegram відмовив: ' + (j.description || r.status) }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'Telegram не відповідає' }, { status: 502 });
  }
  // Кнопка меню бота (біля поля вводу) — відкриває кабінет клієнта.
  await tgCall('setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Мій кабінет', web_app: { url: clientAppUrl(req) } },
  });
  return NextResponse.json({ ok: true, staff: Boolean(process.env.SKIPPER_STAFF_IDS),
                            bot: await botUsername() });
}
