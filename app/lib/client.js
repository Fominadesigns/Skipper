import { sql } from '@/lib/db';
import { feeForLength, debtKop, coveredThrough, unpaidMonths, isoMonth } from '@/lib/money';

/* Брони клієнта за його Telegram ID — для міні-додатка. Той самий
   розрахунок боргу, що й у CRM, щоб клієнт і станція бачили одну суму. */
export async function clientBookings(tgId) {
  const rows = (await sql`
    SELECT b.id, b.starts_on, b.ends_on, b.fee_kop,
           s.name AS slot_name, s.kind AS slot_kind,
           bo.name AS boat_name, bo.length_cm,
           c.name AS client_name, c.phone
      FROM bookings b
      JOIN slots s ON s.id = b.slot_id
      JOIN boats bo ON bo.id = b.boat_id
      JOIN clients c ON c.id = bo.client_id
     WHERE c.telegram_id = ${String(tgId)} AND b.status <> 'cancelled'
     ORDER BY b.starts_on`).rows;
  const paid = rows.length ? Object.fromEntries((await sql`
    SELECT booking_id, COALESCE(SUM(amount_kop), 0) AS s FROM payments
     WHERE booking_id = ANY(${rows.map((r) => r.id)}) GROUP BY booking_id`).rows
    .map((r) => [r.booking_id, Number(r.s)])) : {};

  return rows.map((r) => {
    const b = { ...r, fee_kop: r.fee_kop ?? feeForLength(r.length_cm), paid_kop: paid[r.id] || 0 };
    return {
      id: b.id, boat_name: b.boat_name, slot_name: b.slot_name, slot_kind: b.slot_kind,
      client_name: b.client_name, phone: b.phone,
      starts_on: b.starts_on, ends_on: b.ends_on, fee_kop: b.fee_kop,
      debt_kop: debtKop(b),
      covered_through: coveredThrough(b),
      unpaid: unpaidMonths(b).map(isoMonth),
    };
  });
}
