import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { webhookSecret, isStaff, tgSend, escapeHtml } from '@/lib/tg';
import { parseExpense } from '@/lib/expense-text';
import { formatKop } from '@/lib/money';

export const dynamic = 'force-dynamic';

/* Вебхук бота. Сюди Telegram присилає кожне повідомлення боту.

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
  const msg = upd?.message;
  const text = (msg?.text || '').trim();
  const from = msg?.from?.id;
  const chat = msg?.chat?.id;
  if (!text || !from || msg?.chat?.type !== 'private') return ok();

  if (text === '/id') {
    await tgSend(chat, `Ваш Telegram ID: <code>${from}</code>`);
    return ok();
  }

  if (!isStaff(from)) {
    await tgSend(chat, 'Вітаємо! Це бот човнової станції Skipper. ' +
                       'Сюди приходитимуть рахунки за стоянку.');
    return ok();
  }

  await ensureSchema();

  if (text === '/start' || text === '/help') {
    await tgSend(chat,
      '<b>Каса Skipper</b>\nНадішліть витрату одним рядком: сума й на що.\n' +
      'Наприклад: <b>450 пальне</b>\n' +
      'Карткою — додайте слово <b>картка</b>: <b>1200 фарба картка</b>\n' +
      'Помилились — напишіть <b>скасувати</b>.');
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
