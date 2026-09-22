import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/* «Почати з чистого аркуша» — для перевірок перед справжніми клієнтами.
   Видаляє клієнтів (разом із човнами, бронями, оплатами, рахунками,
   сигналами «Я оплатив»), заявки, витрати й журнали. Місця станції
   лишаються. Працює лише зі словом-підтвердженням: випадково не натиснеш. */
export async function POST(req) {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  const d = await req.json().catch(() => ({}));
  if (d.confirm !== 'ОЧИСТИТИ') {
    return NextResponse.json({ error: 'Потрібне слово-підтвердження' }, { status: 400 });
  }
  await ensureSchema();
  await sql`DELETE FROM clients`;          // каскадом: човни, брони, оплати, рахунки, сигнали
  await sql`DELETE FROM requests`;
  await sql`DELETE FROM expenses`;
  await sql`DELETE FROM message_log`;
  await sql`DELETE FROM staff_chats`;
  return NextResponse.json({ ok: true });
}
