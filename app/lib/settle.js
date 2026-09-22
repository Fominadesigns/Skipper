import { sql } from '@/lib/db';

/* Перераховує, які рахунки броні оплачені, з нуля — за сумою всіх оплат.
   Потрібно після видалення помилкової оплати: рахунок, який вона
   закривала, має знову стати відкритим. Спосіб і дату оплати
   вже закритих рахунків не чіпаємо. */
export async function resettle(bookingId) {
  let left = Number((await sql`
    SELECT COALESCE(SUM(amount_kop), 0) AS s FROM payments WHERE booking_id = ${bookingId}
  `).rows[0].s);

  const invoices = (await sql`
    SELECT id, amount_kop, status FROM invoices
     WHERE booking_id = ${bookingId} ORDER BY period`).rows;

  for (const inv of invoices) {
    if (left >= inv.amount_kop) {
      left -= inv.amount_kop;
      if (inv.status !== 'paid') {
        await sql`UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = ${inv.id}`;
      }
    } else if (inv.status === 'paid') {
      left = 0;
      await sql`UPDATE invoices SET status = 'sent', paid_at = NULL, paid_how = NULL
                 WHERE id = ${inv.id}`;
    } else {
      left = 0;
    }
  }
}
