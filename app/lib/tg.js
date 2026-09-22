import { createHmac } from 'crypto';
import { sql } from '@/lib/db';

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

/* Персонал — змінна SKIPPER_STAFF_IDS: через кому числові Telegram ID
   або імена з @ («123456789, @ssvvss7733»). Бот за іменем написати
   людині не може — Telegram не дає ботам шукати людей за іменем. Тому
   ім'я спрацьовує з першого повідомлення людини боту: тоді бот
   запамʼятовує її номер у таблиці staff_chats і далі пише сам. */
function staffList() {
  return (process.env.SKIPPER_STAFF_IDS || '').split(/[\s,;]+/).filter(Boolean)
    .map((x) => x.toLowerCase());
}
/** user — обʼєкт from із повідомлення Telegram (id, username). */
export function isStaff(user) {
  if (!user) return false;
  const list = staffList();
  const name = user.username ? '@' + String(user.username).toLowerCase() : null;
  return list.includes(String(user.id)) || (name !== null && list.includes(name));
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
  const ids = new Set(staffList().filter((x) => /^\d+$/.test(x)));
  // Ті, хто в списку за @іменем і вже писав боту.
  try {
    const rows = (await sql`SELECT tg_id, username FROM staff_chats`).rows;
    for (const r of rows) {
      if (isStaff({ id: r.tg_id, username: r.username })) ids.add(String(r.tg_id));
    }
  } catch { /* таблиці ще немає — лише числові ID */ }
  for (const id of ids) await tgSend(id, text);
  return ids.size;
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

/* Адреса клієнтського міні-додатка — з того ж домену, де працює CRM. */
export function clientAppUrl(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  return `https://${host}/client`;
}
/** Кнопка під повідомленням, що відкриває міні-додаток. */
export const cabinetButton = (req) => ({ text: '⚓ Мій кабінет', web_app: { url: clientAppUrl(req) } });

export const escapeHtml = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
