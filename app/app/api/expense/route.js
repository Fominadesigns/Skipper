import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isSignedIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/* Витрата з CRM. Сума — цілі копійки. how: cash | bank */
export async function POST(req) {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  await ensureSchema();

  const d = await req.json().catch(() => ({}));
  const amount = Math.round(Number(d.amountKop));
  const what = String(d.what || '').trim().slice(0, 200);
  const how = d.how === 'bank' ? 'bank' : 'cash';
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Сума має бути більшою за нуль' }, { status: 400 });
  }
  if (!what) return NextResponse.json({ error: 'Напишіть, на що витратили' }, { status: 400 });

  await sql`INSERT INTO expenses (amount_kop, what, method, source)
            VALUES (${amount}, ${what}, ${how}, 'crm')`;
  return NextResponse.json({ ok: true, amountKop: amount });
}

export async function DELETE(req) {
  if (!isSignedIn()) return NextResponse.json({ error: 'Потрібен вхід' }, { status: 401 });
  await ensureSchema();
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Немає запису' }, { status: 400 });
  await sql`DELETE FROM expenses WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
