import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/* Прибрати з дашборда сигнал «клієнт каже, що оплатив». */
export async function PATCH(req) {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  await ensureSchema();
  const d = await req.json().catch(() => ({}));
  if (!Number(d.id)) return NextResponse.json({ error: 'Немає даних' }, { status: 400 });
  await sql`UPDATE payment_claims SET seen = true WHERE id = ${Number(d.id)}`;
  return NextResponse.json({ ok: true });
}
