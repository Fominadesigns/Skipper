import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { verifyInitData, initDataFrom } from '@/lib/initdata';
import { clientBookings } from '@/lib/client';
import { freeByMonth } from '@/lib/free';

export const dynamic = 'force-dynamic';

/* Усе для клієнтського міні-додатка: його брони, реквізити, вільні місця.
   Лише для підписаного Telegram-запиту — див. lib/initdata.js. */
export async function GET(req) {
  const user = verifyInitData(initDataFrom(req));
  if (!user) return NextResponse.json({ error: 'Відкрийте через бота в Telegram' }, { status: 401 });
  await ensureSchema();
  const bookings = await clientBookings(user.id);
  return NextResponse.json({
    name: bookings[0]?.client_name || user.first_name || '',
    bookings,
    // Реквізити — тільки зі змінної. Немає — не вигадуємо.
    pay: (process.env.SKIPPER_PAY_DETAILS || '').trim() || null,
    free: await freeByMonth(),
  });
}
