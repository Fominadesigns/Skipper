import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { webhookSecret, isStaff, tgSend, tgCall, tellStaff, phoneTail, escapeHtml } from '@/lib/tg';
import { parseExpense } from '@/lib/expense-text';
import { formatKop } from '@/lib/money';

export const dynamic = 'force-dynamic';

/* Вебхук бота. Сюди Telegram присилає кожне повідомлення боту.

   Клієнти: /start → кнопка «Поділитися номером» → бот знаходить
   клієнта за телефоном і запамʼятовує його Telegram. Відтепер рахунки
   з CRM приходять сюди. Під рахунком кнопка «Я оплатив» — вона лише
   повідомляє персонал; оплату в касу вносить людина (правило проєкту).

   Персонал (SKIPPER_STAFF_IDS) пише витрату одним рядком — «450 пальне»,
   і вона одразу потрапляє в касу. «скасувати» прибирає останню власну
   витрату за добу. Решті бот лише ввічливо відповідає: це ж і бот
   клієнтів, їм туди приходять рахунки.

   Відповідаємо Telegram завжди 200: інакше він повторює те саме
   повідомлення, і витрата записалась би двічі. */

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
  const text = (msg?.text || '').trim();
  const from = msg?.from?.id;
  const chat = msg?.chat?.id;
  if (!from || msg?.chat?.type !== 'private') return ok();

  // Клієнт поділився номером.
  if (msg.contact) {
    await onContact(msg);
    return ok();
  }
  if (!text) return ok();

  // Підключитись як клієнт може й персонал (напр. пробна бронь на свій номер).
  if (text === '/phone') {
    await askPhone(chat);
    return ok();
  }

  if (text === '/id') {
    await tgSend(chat, `Ваш Telegram ID: <code>${from}</code>`);
    return ok();
  }

  if (!isStaff(msg.from)) {
    await askPhone(chat);
    return ok();
  }

  await ensureSchema();
  await sql`INSERT INTO staff_chats (tg_id, username)
            VALUES (${String(from)}, ${msg.from.username || null})
            ON CONFLICT (tg_id) DO UPDATE SET username = EXCLUDED.username, seen_at = now()`;

  if (text === '/start' || text === '/help') {
    await tgSend(chat,
      '<b>Каса Skipper</b>\nНадішліть витрату одним рядком: сума й на що.\n' +
      'Наприклад: <b>450 пальне</b>\n' +
      'Карткою — додайте слово <b>картка</b>: <b>1200 фарба картка</b>\n' +
      'Помилились — напишіть <b>скасувати</b>.\n\n' +
      'Підключитись як клієнт (напр. пробна бронь на свій номер) — /phone');
    return ok();
  }

  if (/^\/?(скасувати|відміна|отмена|cancel)$/i.test(text)) {
    const gone = (await sql`
      DELETE FROM expenses WHERE id = (
        SELECT id FROM expenses
         WHERE source = 'bot' AND tg_id = ${String(from)}
           AND created_at > now() - interval '1 day'
         ORDER BY created_at DESC LIMIT 1)
      RETURNING amount_kop, what`).rows[0];
    await tgSend(chat, gone
      ? `Скасовано: ${formatKop(gone.amount_kop)} · ${escapeHtml(gone.what)}`
      : 'Немає чого скасовувати за останню добу.');
    return ok();
  }

  const x = parseExpense(text);
  if (!x) {
    await tgSend(chat, 'Не зрозумів. Напишіть суму й на що: <b>450 пальне</b>');
    return ok();
  }

  await sql`INSERT INTO expenses (amount_kop, what, method, source, tg_id)
            VALUES (${x.amountKop}, ${x.what.slice(0, 200)}, ${x.method}, 'bot', ${String(from)})`;
  await tgSend(chat,
    `Записав витрату: <b>${formatKop(x.amountKop)}</b> · ${escapeHtml(x.what)} · ` +
    (x.method === 'bank' ? 'карткою' : 'готівкою') + '.\nПомилились — напишіть «скасувати».');
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
  await tellStaff(
    `💳 <b>${escapeHtml(b.client_name)}</b> каже, що оплатив стоянку\n` +
    `${escapeHtml(b.boat_name || 'човен')}, місце ${escapeHtml(b.slot_name)}\n\n` +
    'Звірте з банком і внесіть оплату в касі CRM.');
  await tgCall('answerCallbackQuery', { callback_query_id: q.id,
    text: 'Дякуємо! Перевіримо надходження й підтвердимо.' });
  await tgSend(q.message.chat.id, 'Дякуємо! Ми звіримо з банком і підтвердимо оплату.');
}
