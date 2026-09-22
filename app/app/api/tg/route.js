import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { webhookSecret, tgSend, tgCall, tellStaff, phoneTail, escapeHtml } from '@/lib/tg';

export const dynamic = 'force-dynamic';

/* Вебхук бота. Бот — лише для КЛІЄНТІВ (рішення Каті від 22.09.2026):
   персонал вносить приходи й витрати в CRM, а не через бот.

   /start → кнопка «Поділитися номером» → бот знаходить клієнта
   за телефоном і запамʼятовує його Telegram. Відтепер рахунки з CRM
   приходять сюди. Під рахунком кнопка «Я оплатив» — вона лише кладе
   сигнал на дашборд CRM; оплату вносить людина (правило проєкту).

   Відповідаємо Telegram завжди 200: інакше він повторює те саме
   повідомлення. */

const ok = () => NextResponse.json({ ok: true });

export async function POST(req) {
  const secret = webhookSecret();
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const upd = await req.json().catch(() => null);

  // Натиснули кнопку під повідомленням («Я оплатив»).
  if (upd?.callback_query) {
    await onButton(upd.callback_query);
    return ok();
  }

  const msg = upd?.message;
  if (!msg?.from || msg.chat?.type !== 'private') return ok();

  if (msg.contact) {
    await onContact(msg);
    return ok();
  }
  await askPhone(msg.chat.id);
  return ok();
}

/* ── клієнти ────────────────────────────────────────────────────────── */

async function askPhone(chat) {
  await tgSend(chat,
    'Вітаємо! Це бот човнової станції <b>Skipper</b>.\n\n' +
    'Щоб рахунки за стоянку приходили сюди, натисніть кнопку внизу — ' +
    'бот знайде вашу бронь за номером телефону.',
    { reply_markup: {
        keyboard: [[{ text: '📱 Поділитися номером', request_contact: true }]],
        resize_keyboard: true, one_time_keyboard: true } });
}

async function onContact(msg) {
  const chat = msg.chat.id;
  const from = msg.from.id;
  // Чужий контакт не приймаємо: інакше можна «підключитись» до чужої броні.
  if (String(msg.contact.user_id) !== String(from)) {
    await tgSend(chat, 'Надішліть, будь ласка, свій номер — кнопкою внизу.');
    return;
  }
  const tail = phoneTail(msg.contact.phone_number);
  await ensureSchema();
  const found = tail ? (await sql`
    UPDATE clients SET telegram_id = ${String(from)}
     WHERE right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 9) = ${tail}
     RETURNING id, name`).rows : [];

  const off = { reply_markup: { remove_keyboard: true } };
  if (found.length) {
    await tgSend(chat, `Готово, ${escapeHtml(found[0].name)}! Рахунки за стоянку ` +
                       'приходитимуть у цей чат.', off);
  } else {
    await tgSend(chat, 'Не знайшли броні з цим номером. Можливо, його записали ' +
                       'інакше — зателефонуйте на станцію, і ми виправимо.', off);
  }
}

async function onButton(q) {
  const [kind, id] = String(q.data || '').split(':');
  if (kind !== 'paid' || !Number(id)) {
    await tgCall('answerCallbackQuery', { callback_query_id: q.id });
    return;
  }
  await ensureSchema();
  // Лише той, кому належить бронь, може сказати «я оплатив».
  const b = (await sql`
    SELECT bk.id, bo.name AS boat_name, c.name AS client_name, c.phone, s.name AS slot_name
      FROM bookings bk
      JOIN boats bo ON bo.id = bk.boat_id
      JOIN clients c ON c.id = bo.client_id
      JOIN slots s ON s.id = bk.slot_id
     WHERE bk.id = ${Number(id)} AND c.telegram_id = ${String(q.from.id)}`).rows[0];
  if (!b) {
    await tgCall('answerCallbackQuery', { callback_query_id: q.id, text: 'Бронь не знайдена' });
    return;
  }
  // Сигнал на дашборд CRM. Повторне натискання за добу не дублює.
  const dup = (await sql`
    SELECT id FROM payment_claims
     WHERE booking_id = ${b.id} AND seen = false
       AND created_at > now() - interval '1 day'`).rows[0];
  if (!dup) {
    await sql`INSERT INTO payment_claims (booking_id) VALUES (${b.id})`;
    // Якщо персонал підписаний на бота (SKIPPER_STAFF_IDS) — ще й повідомлення.
    await tellStaff(
      `💳 <b>${escapeHtml(b.client_name)}</b> каже, що оплатив стоянку\n` +
      `${escapeHtml(b.boat_name || 'човен')}, місце ${escapeHtml(b.slot_name)}\n\n` +
      'Звірте з банком і внесіть оплату в касі CRM.');
  }
  await tgCall('answerCallbackQuery', { callback_query_id: q.id,
    text: 'Дякуємо! Перевіримо надходження й підтвердимо.' });
  await tgSend(q.message.chat.id, 'Дякуємо! Ми звіримо з банком і підтвердимо оплату.');
}
