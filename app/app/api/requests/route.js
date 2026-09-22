import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/* Відхилити заявку з сайту. Оформлення — через звичайне створення
   броні з requestId (api/booking). */
export async function PATCH(req) {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  await ensureSchema();
  const d = await req.json().catch(() => ({}));
  const id = Number(d.id);
  const status = d.status === 'rejected' ? 'rejected' : null;
  if (!id || !status) return NextResponse.json({ error: 'Немає даних' }, { status: 400 });
  await sql`UPDATE requests SET status = ${status} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
