import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { verifyInitData, initDataFrom } from '@/lib/initdata';
import { tellStaff, escapeHtml } from '@/lib/tg';

export const dynamic = 'force-dynamic';

/* «Я оплатив» із міні-додатка. Лише сигнал на дашборд CRM —
   оплату вносить людина, звіривши з банком (правило проєкту). */
export async function POST(req) {
  const user = verifyInitData(initDataFrom(req));
  if (!user) return NextResponse.json({ error: 'Відкрийте через бота в Telegram' }, { status: 401 });
  await ensureSchema();
  const d = await req.json().catch(() => ({}));
  const b = (await sql`
    SELECT bk.id, bo.name AS boat_name, c.name AS client_name, s.name AS slot_name
      FROM bookings bk JOIN boats bo ON bo.id = bk.boat_id
      JOIN clients c ON c.id = bo.client_id JOIN slots s ON s.id = bk.slot_id
     WHERE bk.id = ${Number(d.bookingId) || 0} AND c.telegram_id = ${String(user.id)}`).rows[0];
  if (!b) return NextResponse.json({ error: 'Бронь не знайдена' }, { status: 404 });

  const dup = (await sql`
    SELECT id FROM payment_claims WHERE booking_id = ${b.id} AND seen = false
       AND created_at > now() - interval '1 day'`).rows[0];
  if (!dup) {
    await sql`INSERT INTO payment_claims (booking_id) VALUES (${b.id})`;
    await tellStaff(`💳 <b>${escapeHtml(b.client_name)}</b> каже, що оплатив стоянку\n` +
      `${escapeHtml(b.boat_name || 'човен')}, місце ${escapeHtml(b.slot_name)}`);
  }
  return NextResponse.json({ ok: true });
}
