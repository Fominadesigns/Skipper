import { NextResponse } from 'next/server';
import { phoneTail } from '@/lib/tg';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';
import { feeForLength } from '@/lib/money';

export const dynamic = 'force-dynamic';

/* Нова стоянка: створюємо клієнта, човен і бронь за один раз.
   Тариф не запитуємо — він рахується з заміряної довжини судна
   за таблицею власника станції. */

export async function POST(req) {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  await ensureSchema();

  const d = await req.json().catch(() => ({}));
  const slotId = Number(d.slotId);
  const lengthCm = d.lengthCm ? Math.round(Number(d.lengthCm)) : null;

  if (!slotId || !d.clientName || !d.startsOn) {
    return NextResponse.json({ error: 'Не вистачає даних' }, { status: 400 });
  }

  const busy = (await sql`SELECT id FROM bookings
                           WHERE slot_id = ${slotId} AND status <> 'cancelled'`).rows[0];
  if (busy) return NextResponse.json({ error: 'Місце вже зайняте' }, { status: 409 });

  /* Якщо людина з цим телефоном уже підключила бота — нова бронь
     одразу отримує той самий Telegram, просити вдруге не треба. */
  const tail = phoneTail(d.phone);
  const known = tail ? (await sql`
    SELECT telegram_id FROM clients
     WHERE telegram_id IS NOT NULL
       AND right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 9) = ${tail}
     ORDER BY id DESC LIMIT 1`).rows[0] : null;
  const c = (await sql`INSERT INTO clients (name, phone, telegram_id)
                       VALUES (${d.clientName}, ${d.phone || null}, ${known?.telegram_id || null})
                       RETURNING id`).rows[0];
  const b = (await sql`INSERT INTO boats (client_id, name, reg, length_cm)
                       VALUES (${c.id}, ${d.boatName || null}, ${d.reg || null}, ${lengthCm})
                       RETURNING id`).rows[0];
  const bk = (await sql`INSERT INTO bookings (slot_id, boat_id, starts_on, ends_on, fee_kop)
                        VALUES (${slotId}, ${b.id}, ${d.startsOn}, ${d.endsOn || null},
                                ${feeForLength(lengthCm)})
                        RETURNING id`).rows[0];

  return NextResponse.json({ ok: true, bookingId: bk.id });
}

/** Правка стоянки: місце, тариф, дати, дані човна й клієнта. */
export async function PATCH(req) {
  if (!isSignedIn()) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  await ensureSchema();

  const d = await req.json().catch(() => ({}));
  const id = Number(d.id);
  if (!id) return NextResponse.json({ error: "Немає id" }, { status: 400 });

  const b = (await sql`SELECT * FROM bookings WHERE id = ${id}`).rows[0];
  if (!b) return NextResponse.json({ error: "Бронь не знайдена" }, { status: 404 });

  // Переставити на інше місце — лише якщо воно вільне.
  if (d.slotId && Number(d.slotId) !== b.slot_id) {
    const taken = (await sql`SELECT id FROM bookings
                              WHERE slot_id = ${Number(d.slotId)}
                                AND status <> 'cancelled' AND id <> ${id}`).rows[0];
    if (taken) return NextResponse.json({ error: "Те місце вже зайняте" }, { status: 409 });
    await sql`UPDATE bookings SET slot_id = ${Number(d.slotId)} WHERE id = ${id}`;
  }

  if (d.feeKop !== undefined) {
    const fee = d.feeKop === null ? null : Math.round(Number(d.feeKop));
    await sql`UPDATE bookings SET fee_kop = ${fee} WHERE id = ${id}`;
  }
  if (d.startsOn) await sql`UPDATE bookings SET starts_on = ${d.startsOn} WHERE id = ${id}`;
  if (d.endsOn !== undefined) {
    await sql`UPDATE bookings SET ends_on = ${d.endsOn || null} WHERE id = ${id}`;
  }
  if (d.autoInvoice !== undefined) {
    await sql`UPDATE bookings SET auto_invoice = ${!!d.autoInvoice} WHERE id = ${id}`;
  }
  if (d.status) await sql`UPDATE bookings SET status = ${d.status} WHERE id = ${id}`;

  if (d.lengthCm !== undefined) {
    await sql`UPDATE boats SET length_cm = ${d.lengthCm ? Math.round(Number(d.lengthCm)) : null}
               WHERE id = ${b.boat_id}`;
  }
  if (d.boatName !== undefined) {
    await sql`UPDATE boats SET name = ${d.boatName || null} WHERE id = ${b.boat_id}`;
  }
  if (d.reg !== undefined) {
    await sql`UPDATE boats SET reg = ${d.reg || null} WHERE id = ${b.boat_id}`;
  }
  if (d.clientName !== undefined || d.phone !== undefined) {
    const boat = (await sql`SELECT client_id FROM boats WHERE id = ${b.boat_id}`).rows[0];
    if (d.clientName !== undefined) {
      await sql`UPDATE clients SET name = ${d.clientName} WHERE id = ${boat.client_id}`;
    }
    if (d.phone !== undefined) {
      await sql`UPDATE clients SET phone = ${d.phone || null} WHERE id = ${boat.client_id}`;
    }
  }

  return NextResponse.json({ ok: true });
}

/* Видалення стоянки.

   Разом із бронню йдуть її оплати й рахунки. Човен і клієнт зникають
   лише тоді, коли в них не лишилось інших записів: інакше видалення
   однієї стоянки мовчки стерло&nbsp;б історію людини, яка стоїть
   на кількох місцях. */
export async function DELETE(req) {
  if (!isSignedIn()) return NextResponse.json({ error: "Потрібен вхід" }, { status: 401 });
  await ensureSchema();

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Немає id" }, { status: 400 });

  const b = (await sql`SELECT boat_id FROM bookings WHERE id = ${id}`).rows[0];
  if (!b) return NextResponse.json({ error: "Бронь не знайдена" }, { status: 404 });

  const boat = (await sql`SELECT client_id FROM boats WHERE id = ${b.boat_id}`).rows[0];

  await sql`DELETE FROM bookings WHERE id = ${id}`;

  const left = (await sql`SELECT id FROM bookings WHERE boat_id = ${b.boat_id}`).rows.length;
  if (left === 0) {
    await sql`DELETE FROM boats WHERE id = ${b.boat_id}`;
    const boatsLeft = (await sql`SELECT id FROM boats
                                  WHERE client_id = ${boat.client_id}`).rows.length;
    if (boatsLeft === 0) await sql`DELETE FROM clients WHERE id = ${boat.client_id}`;
  }

  return NextResponse.json({ ok: true });
}
