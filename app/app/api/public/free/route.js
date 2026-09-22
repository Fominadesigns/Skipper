import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { cors, KINDS } from '@/lib/public';
import { botUsername } from '@/lib/tg';

export const dynamic = 'force-dynamic';

/* Скільки місць вільно — для сайту. Рахуємо з CRM, а не вигадуємо
   (правило проєкту). Стоянка помісячна, тож і вільність — помісячна:
   на 12 місяців уперед, окремо для води, суші й ангара.
   Імен, телефонів і човнів тут немає — лише числа. */

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function GET(req) {
  const headers = cors(req);
  try {
    await ensureSchema();
    const slots = (await sql`SELECT id, kind FROM slots`).rows;
    const bookings = (await sql`
      SELECT slot_id, starts_on, ends_on FROM bookings WHERE status <> 'cancelled'`).rows;

    const now = new Date();
    const months = {};
    for (let i = 0; i < 12; i++) {
      const y = now.getUTCFullYear(), m = now.getUTCMonth() + i;
      const start = new Date(Date.UTC(y, m, 1));
      const end = new Date(Date.UTC(y, m + 1, 0));
      const key = start.toISOString().slice(0, 7);
      const taken = new Set(bookings
        .filter((b) => new Date(b.starts_on) <= end && (!b.ends_on || new Date(b.ends_on) >= start))
        .map((b) => b.slot_id));
      months[key] = {};
      for (const k of KINDS) {
        const all = slots.filter((s) => s.kind === k);
        months[key][k] = { total: all.length, free: all.filter((s) => !taken.has(s.id)).length };
      }
    }
    const bot = await botUsername().catch(() => null);
    return NextResponse.json({ months, bot }, { headers });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers });
  }
}
