import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';
import { unpaidMonths, isoMonth, monthLabel, formatKop, feeForLength } from '@/lib/money';
import { tgSend, escapeHtml, cabinetButton } from '@/lib/tg';

export const dynamic = 'force-dynamic';

/* Виставлення рахунку.

   Рахунок створюється в базі й — якщо клієнт підключив Telegram —
   надсилається йому повідомленням. Позначити рахунок оплаченим
   може лише людина, окремою дією: сервіс не бачить банку. */

export async function POST(req) {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  await ensureSchema();

  const d = await req.json().catch(() => ({}));
  const id = Number(d.bookingId);
  if (!id) return NextResponse.json({ error: 'Немає броні' }, { status: 400 });

  const b = (await sql`
    SELECT bk.*, bo.length_cm, bo.name AS boat_name,
           c.name AS client_name, c.telegram_id, s.name AS slot_name
      FROM bookings bk
      JOIN boats   bo ON bo.id = bk.boat_id
      JOIN clients c  ON c.id  = bo.client_id
      JOIN slots   s  ON s.id  = bk.slot_id
     WHERE bk.id = ${id}`).rows[0];
  if (!b) return NextResponse.json({ error: 'Бронь не знайдена' }, { status: 404 });

  const fee = b.fee_kop ?? feeForLength(b.length_cm);
  if (!fee) {
    return NextResponse.json(
      { error: 'Тариф не визначений — вкажіть довжину судна' }, { status: 400 });
  }

  // За які місяці виставляємо: усі неоплачені, або один наперед.
  let months = unpaidMonths({ ...b, fee_kop: fee });
  if (months.length === 0) {
    const last = b.paid_until ? new Date(b.paid_until) : new Date(b.starts_on);
    months = [new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1))];
  }

  const created = [];
  for (const m of months) {
    const period = isoMonth(m);
    const row = (await sql`
      INSERT INTO invoices (booking_id, period, amount_kop, status, sent_at)
      VALUES (${id}, ${period}, ${fee}, 'sent', now())
      ON CONFLICT (booking_id, period)
      DO UPDATE SET status = 'sent', sent_at = now(), amount_kop = ${fee}
      RETURNING id, period, amount_kop`).rows[0];
    created.push(row);
  }

  const total = created.reduce((s, r) => s + r.amount_kop, 0);
  const list = created.map((r) => '• Стоянка, ' + monthLabel(r.period) +
                                  ' — ' + formatKop(r.amount_kop)).join('\n');

  /* Реквізити — лише зі змінної SKIPPER_PAY_DETAILS. Вигадувати їх
     не можна: це рахунок реальної людини. Немає змінної — пишемо,
     що реквізити надішле станція. */
  const pay = (process.env.SKIPPER_PAY_DETAILS || '').trim();
  const text =
    `<b>Рахунок за стоянку</b>\n` +
    `${escapeHtml(b.boat_name || 'Ваш човен')}, місце ${escapeHtml(b.slot_name)}\n\n` +
    `${list}\n\n` +
    `<b>Разом: ${formatKop(total)}</b>\n\n` +
    (pay ? `Реквізити для оплати:\n${escapeHtml(pay)}\n\n`
         : 'Реквізити для оплати надішле станція окремо.\n\n') +
    'Усі деталі — у «Моєму кабінеті». Після оплати натисніть «Я оплатив» — ми звіримо з банком і підтвердимо.';

  const sent = b.telegram_id ? await tgSend(b.telegram_id, text, {
    reply_markup: { inline_keyboard: [[cabinetButton(req)],
                                      [{ text: '✅ Я оплатив', callback_data: `paid:${id}` }]] },
  }) : false;

  return NextResponse.json({
    ok: true, months: created.length, totalKop: total, sentToTelegram: sent,
    note: sent ? null : 'Клієнт ще не підключив Telegram — рахунок лише збережено',
  });
}
