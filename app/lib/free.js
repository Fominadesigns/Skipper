import { sql } from '@/lib/db';

export const KINDS = ['water', 'land', 'hangar'];

/* Скільки місць вільно помісячно на 12 місяців уперед, окремо для
   води, суші й ангара. Спільне для сайту й клієнтського додатка.
   Лише числа — ні імен, ні телефонів. */
export async function freeByMonth() {
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
  return months;
}
