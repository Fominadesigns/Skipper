import { createHmac, timingSafeEqual } from 'crypto';

/* Перевірка підпису Telegram Mini App (initData) за HMAC-SHA256 —
   за документацією Telegram. Лише так відомо, що запит справді від
   цієї людини: без перевірки будь-хто підставив би чужий Telegram ID
   і побачив би чужу бронь. Повертає обʼєкт user або null. */

const MAX_AGE = 60 * 60 * 24;   // initData живе добу

export function verifyInitData(initData) {
  const token = process.env.SKIPPER_BOT_TOKEN;
  if (!token || !initData || typeof initData !== 'string') return null;

  let p;
  try { p = new URLSearchParams(initData); } catch { return null; }
  const hash = p.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  p.delete('hash');

  const check = [...p.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const calc = createHmac('sha256', secret).update(check).digest();
  const got = Buffer.from(hash.toLowerCase(), 'hex');
  if (got.length !== calc.length || !timingSafeEqual(got, calc)) return null;

  const age = Date.now() / 1000 - Number(p.get('auth_date') || 0);
  if (!(age >= 0 && age < MAX_AGE)) return null;

  try { return JSON.parse(p.get('user') || 'null'); } catch { return null; }
}

export const initDataFrom = (req) => req.headers.get('x-tg-init-data') || '';
