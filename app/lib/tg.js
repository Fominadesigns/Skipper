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

/** Виклик методу Bot API. Повертає розібрану відповідь або null. */
export async function tgCall(method, body) {
  const t = botToken();
  if (!t) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

/** extra — додаткові поля sendMessage, напр. reply_markup з кнопками. */
export async function tgSend(chatId, text, extra = {}) {
  if (!chatId) return false;
  const j = await tgCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
  return Boolean(j && j.ok);
}

/** Усім з персоналу (SKIPPER_STAFF_IDS). */
export async function tellStaff(text) {
  const ids = (process.env.SKIPPER_STAFF_IDS || '').split(/[\s,;]+/).filter(Boolean);
  for (const id of ids) await tgSend(id, text);
  return ids.length;
}

/* Телефон для порівняння — останні 9 цифр. Так «+380 67 123 45 67»,
   «0671234567» і «380671234567» — один і той самий номер. */
export function phoneTail(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : null;
}

/* Імʼя бота (для посилання t.me/…). Питаємо Telegram один раз
   на життя процесу — імʼя не змінюється. */
let botName = null;
export async function botUsername() {
  if (botName) return botName;
  const j = await tgCall('getMe');
  botName = j && j.ok ? j.result.username : null;
  return botName;
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
