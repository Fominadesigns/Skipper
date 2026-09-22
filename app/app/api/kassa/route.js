import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/* Каса: усі рухи грошей одним списком.
   Приходи — це оплати з журналу payments (готівка й переказ),
   витрати — таблиця expenses. Окремо приходи не зберігаються. */

export async function GET() {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  await ensureSchema();

  const incomes = (await sql`
    SELECT p.id, p.amount_kop, p.method, p.created_at, p.booking_id,
           c.name AS client_name, bo.name AS boat_name, s.name AS slot_name
      FROM payments p
      JOIN bookings bk ON bk.id = p.booking_id
      JOIN boats    bo ON bo.id = bk.boat_id
      JOIN clients  c  ON c.id  = bo.client_id
      JOIN slots    s  ON s.id  = bk.slot_id
     ORDER BY p.created_at DESC
     LIMIT 1000`).rows;

  const expenses = (await sql`
    SELECT id, amount_kop, what, method, source, created_at
      FROM expenses ORDER BY created_at DESC LIMIT 1000`).rows;

  return NextResponse.json({ incomes, expenses });
}
