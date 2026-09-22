import { createHmac } from 'crypto';

/* Спільне для бота: надсилання повідомлень і секрет вебхука.

   Секрет виводимо з токена бота, а не заводимо окрему змінну:
   на одну річ менше вписувати в Vercel. Telegram присилає його
   в заголовку кожного запиту — так чужі запити до /api/tg
   відсікаються, навіть якщо хтось знає адресу. */

export const botToken = () => process.env.SKIPPER_BOT_TOKEN || '';

export function webhookSecret() {
  const t = botToken();
  return t ? createHmac('sha256', t).update('skipper-webhook').digest('hex').slice(0, 48) : '';
}

/* Хто з персоналу може вносити витрати: Telegram ID через кому
   у змінній SKIPPER_STAFF_IDS. Бот підкаже ID командою /id. */
export function isStaff(tgId) {
  const ids = (process.env.SKIPPER_STAFF_IDS || '').split(/[\s,;]+/).filter(Boolean);
  return ids.includes(String(tgId));
}

export async function tgSend(chatId, text) {
  const t = botToken();
  if (!t || !chatId) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
