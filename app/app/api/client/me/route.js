import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { verifyInitData, initDataFrom } from '@/lib/initdata';
import { clientBookings } from '@/lib/client';
import { freeByMonth } from '@/lib/free';
import { payee, payFor, purposeFor } from '@/lib/payment-qr';

export const dynamic = 'force-dynamic';

/* Усе для клієнтського міні-додатка: його брони, реквізити, вільні місця.
   Лише для підписаного Telegram-запиту — див. lib/initdata.js. */
export async function GET(req) {
  const user = verifyInitData(initDataFrom(req));
  if (!user) return NextResponse.json({ error: 'Відкрийте через бота в Telegram' }, { status: 401 });
  await ensureSchema();
  const bookings = await clientBookings(user.id);
  // Службовий запис для перевірки: лише номери броней, без імен і телефонів.
  console.log('client/me', { bookings: bookings.map((b) => b.id) });
  /* QR і посилання в банк — для кожної броні з боргом, на суму боргу.
     Реквізити ті самі, що в Butler (lib/payment-qr.js). */
  for (const b of bookings) {
    if (b.debt_kop > 0) {
      const { payUrl, qrSvg } = await payFor(b.debt_kop,
        purposeFor(b.slot_name, b.boat_name, b.client_name || user.first_name || ''));
      b.payUrl = payUrl; b.qrSvg = qrSvg;
    }
  }
  const p = payee();
  return NextResponse.json({
    name: bookings[0]?.client_name || user.first_name || '',
    bookings,
    payee: p ? { name: p.name, iban: p.iban, taxId: p.taxId } : null,
    free: await freeByMonth(),
  }, { headers: { 'cache-control': 'no-store' } });
}
