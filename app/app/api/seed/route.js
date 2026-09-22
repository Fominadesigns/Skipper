import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';
import { feeForLength, addMonths, firstOfMonth, isoMonth } from '@/lib/money';

export const dynamic = 'force-dynamic';

/* Місця станції й дві показові брони.

   Дві, бо цього досить, щоб побачити обидва стани: одна оплачена
   наперед, друга з боргом. Більше рядків лише засмічували б екран
   перед справжніми даними. */

// Самі місця (20 · 20 · 10) заводить ensureSchema у lib/db.js.
const SLOTS = [];

export async function POST() {
  if (!isSignedIn()) {
    return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  }
  await ensureSchema();

  let i = 0;
  for (const [name, kind] of SLOTS) {
    await sql`INSERT INTO slots (name, kind, sort) VALUES (${name}, ${kind}, ${i++})
              ON CONFLICT (name) DO NOTHING`;
  }

  const thisMonth = firstOfMonth(new Date());

  const DEMO = [
    {
      // Стоїть із цього місяця на три вперед і все оплачено.
      slot: 'A-05', client: 'Тест · Марина Гриценко', phone: '+380670000001',
      boat: '«Дельфін»', reg: 'UA-5521-KV', len: 860,
      from: isoMonth(thisMonth),
      to: isoMonth(addMonths(thisMonth, 2)),
      payMonths: 3,
    },
    {
      // Стоїть із цього місяця й нічого не оплатив — борг за місяць.
      slot: 'A-02', client: 'Тест · Ірина Лисенко', phone: '+380670000002',
      boat: '«Барракуда»', reg: 'UA-2318-KV', len: 720,
      from: isoMonth(thisMonth),
      to: null,
      payMonths: 0,
    },
  ];

  let added = 0;
  for (const d of DEMO) {
    const slot = (await sql`SELECT id FROM slots WHERE name = ${d.slot}`).rows[0];
    if (!slot) continue;

    const busy = (await sql`SELECT id FROM bookings
                             WHERE slot_id = ${slot.id} AND status <> 'cancelled'`).rows[0];
    if (busy) continue;                       // місце зайняте — не дублюємо

    const fee = feeForLength(d.len);
    const c = (await sql`INSERT INTO clients (name, phone) VALUES (${d.client}, ${d.phone})
                         RETURNING id`).rows[0];
    const bo = (await sql`INSERT INTO boats (client_id, name, reg, length_cm)
                          VALUES (${c.id}, ${d.boat}, ${d.reg}, ${d.len}) RETURNING id`).rows[0];
    const bk = (await sql`INSERT INTO bookings (slot_id, boat_id, starts_on, ends_on, fee_kop)
                          VALUES (${slot.id}, ${bo.id}, ${d.from}, ${d.to}, ${fee})
                          RETURNING id`).rows[0];

    // Суму рахуємо з тарифу, а не вписуємо руками — інакше розійдеться.
    if (d.payMonths > 0 && fee) {
      await sql`INSERT INTO payments (booking_id, amount_kop, method, note)
                VALUES (${bk.id}, ${d.payMonths * fee}, 'bank',
                        ${'тестова оплата за ' + d.payMonths + ' міс.'})`;
    }
    added++;
  }

  return NextResponse.json({ ok: true, slots: SLOTS.length, bookingsAdded: added });
}

/* Прибирання даних.

   За замовчуванням — лише тестові клієнти («Тест · …»): справжніх
   не чіпає ні за яких умов. З ?all=1 прибирає всі брони разом
   із човнами й клієнтами; це роблять лише свідомо, з підтвердженням
   на боці сторінки. Місця станції лишаються в обох випадках. */
export async function DELETE(req) {
  if (!isSignedIn()) {
    return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  }
  await ensureSchema();

  const all = new URL(req.url).searchParams.get('all') === '1';

  const gone = all
    ? (await sql`DELETE FROM clients RETURNING id`).rows.length
    : (await sql`DELETE FROM clients WHERE name LIKE 'Тест · %' RETURNING id`).rows.length;

  return NextResponse.json({ ok: true, removed: gone, all });
}
