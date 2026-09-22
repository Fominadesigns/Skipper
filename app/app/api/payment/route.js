import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';
import { accruedKop, feeForLength } from '@/lib/money';

export const dynamic = 'force-dynamic';

/* Оплату завжди вносить ЛЮДИНА. Сервіс не бачить банківського рахунку
   й ніколи не позначає гроші отриманими сам — правило проєкту.

   Сума довільна: можна внести частину боргу. Різниця лишиться
   боргом, а переплата — переплатою. how: cash | bank */

export async function POST(req) {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  await ensureSchema();

  const d = await req.json().catch(() => ({}));
  const id = Number(d.bookingId);
  const how = d.how === 'bank' ? 'bank' : 'cash';
  if (!id) return NextResponse.json({ error: 'Немає броні' }, { status: 400 });

  const b = (await sql`
    SELECT bk.*, bo.length_cm FROM bookings bk
      JOIN boats bo ON bo.id = bk.boat_id
     WHERE bk.id = ${id}`).rows[0];
  if (!b) return NextResponse.json({ error: 'Бронь не знайдена' }, { status: 404 });

  const fee = b.fee_kop ?? feeForLength(b.length_cm);

  // Скільки вже внесено — потрібно, щоб порахувати залишок після цієї оплати.
  const paidBefore = Number((await sql`
    SELECT COALESCE(SUM(amount_kop), 0) AS s FROM payments WHERE booking_id = ${id}
  `).rows[0].s);

  // Сума: або задана, або весь залишок боргу.
  const accrued = accruedKop({ ...b, fee_kop: fee });
  let amount = d.amountKop !== undefined && d.amountKop !== null
    ? Math.round(Number(d.amountKop))
    : Math.max(0, accrued - paidBefore);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Сума має бути більшою за нуль' }, { status: 400 });
  }

  await sql`INSERT INTO payments (booking_id, amount_kop, method)
            VALUES (${id}, ${amount}, ${how})`;

  const paidAfter = paidBefore + amount;
  const debtAfter = Math.max(0, accrued - paidAfter);

  /* Закриваємо виставлені рахунки, поки вистачає внесеного.
     Частково оплачений рахунок лишається невиконаним: сказати клієнту
     «оплачено», коли прийшла половина, було б неправдою. */
  if (fee) {
    const open = (await sql`
      SELECT id, amount_kop FROM invoices
       WHERE booking_id = ${id} AND status <> 'paid'
       ORDER BY period`).rows;
    let left = paidAfter;
    // Спершу «витрачаємо» гроші на вже закриті раніше рахунки.
    const closed = Number((await sql`
      SELECT COALESCE(SUM(amount_kop), 0) AS s FROM invoices
       WHERE booking_id = ${id} AND status = 'paid'`).rows[0].s);
    left -= closed;
    for (const inv of open) {
      if (left >= inv.amount_kop) {
        await sql`UPDATE invoices SET status = 'paid', paid_at = now(), paid_how = ${how}
                   WHERE id = ${inv.id}`;
        left -= inv.amount_kop;
      } else break;
    }
  }

  return NextResponse.json({
    ok: true, amountKop: amount, paidKop: paidAfter, debtKop: debtAfter,
  });
}
