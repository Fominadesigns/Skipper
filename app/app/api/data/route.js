import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';
import { botUsername, ensureBotSetup } from '@/lib/tg';
import { debtKop, creditKop, accruedKop, coveredThrough, feeForLength } from '@/lib/money';

export const dynamic = 'force-dynamic';

/* Усе, що потрібно CRM, одним запитом: місця, стоянки з човнами
   й клієнтами, рахунки. Даних мало (десятки рядків), тож ділити
   на кілька запитів немає сенсу — а один зменшує миготіння. */

export async function GET(req) {
  if (!isSignedIn()) {
    return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  }
  // База ще не підключена — кажемо про це прямо, а не падаємо з 500.
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL_POOLED && !process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'База не підключена' }, { status: 503 });
  }
  await ensureSchema();

  const slots = (await sql`
    SELECT id, name, kind, sort FROM slots ORDER BY sort, name
  `).rows;

  const bookings = (await sql`
    SELECT b.id, b.slot_id, b.boat_id, b.starts_on, b.ends_on,
           b.fee_kop, b.paid_until, b.auto_invoice, b.status,
           s.name  AS slot_name, s.kind AS slot_kind,
           bo.name AS boat_name, bo.reg, bo.length_cm,
           c.id    AS client_id, c.name AS client_name,
           c.phone, c.telegram_id
      FROM bookings b
      JOIN slots   s  ON s.id  = b.slot_id
      JOIN boats   bo ON bo.id = b.boat_id
      JOIN clients c  ON c.id  = bo.client_id
     WHERE b.status <> 'cancelled'
     ORDER BY s.sort, s.name
  `).rows;

  // Скільки внесено по кожній броні — сумою з журналу оплат.
  const paidRows = (await sql`
    SELECT booking_id, COALESCE(SUM(amount_kop), 0) AS paid
      FROM payments GROUP BY booking_id
  `).rows;
  const paidBy = Object.fromEntries(paidRows.map((r) => [r.booking_id, Number(r.paid)]));

  const invoices = (await sql`
    SELECT id, booking_id, period, amount_kop, status, sent_at, paid_at, paid_how
      FROM invoices ORDER BY period DESC, id DESC
  `).rows;

  /* Борг рахуємо на сервері, щоб CRM і бот називали ту саму суму.
     Нараховано мінус внесено: часткова оплата просто зменшує різницю. */
  const withDebt = bookings.map((b) => {
    const row = {
      ...b,
      fee_kop: b.fee_kop ?? feeForLength(b.length_cm),
      paid_kop: paidBy[b.id] || 0,
    };
    return {
      ...row,
      accrued_kop: accruedKop(row),
      debt_kop: debtKop(row),
      credit_kop: creditKop(row),
      covered_through: coveredThrough(row),
    };
  });

  const requests = (await sql`
    SELECT id, kind, starts_on, length_cm, phone, months, boat_name, source, created_at
      FROM requests WHERE status = 'new' ORDER BY created_at DESC`).rows;
  const claims = (await sql`
    SELECT id, booking_id, created_at FROM payment_claims
     WHERE seen = false ORDER BY created_at DESC`).rows;

  // Імʼя бота — щоб CRM могла показати клієнту посилання t.me/…
  console.log('data', { bookings: bookings.map((b) => b.id) });
  // Бот налаштовується сам: вебхук і кнопка «Мій кабінет» (раз на запуск сервера).
  await ensureBotSetup(req).catch(() => {});
  const bot = await botUsername().catch(() => null);
  return NextResponse.json({ slots, bookings: withDebt, invoices, bot, requests, claims });
}
