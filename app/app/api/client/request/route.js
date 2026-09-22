import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { verifyInitData, initDataFrom } from '@/lib/initdata';
import { KINDS } from '@/lib/free';

export const dynamic = 'force-dynamic';

/* Заявка на ще одне місце з міні-додатка. Телефон беремо з картки
   клієнта. Сервіс заявку не підтверджує — вона падає на дашборд CRM. */
export async function POST(req) {
  const user = verifyInitData(initDataFrom(req));
  if (!user) return NextResponse.json({ error: 'Відкрийте через бота в Telegram' }, { status: 401 });
  await ensureSchema();
  const d = await req.json().catch(() => ({}));
  const kind = KINDS.includes(d.kind) ? d.kind : null;
  const date = /^\d{4}-\d{2}$/.test(d.month || '') ? d.month + '-01' : null;
  if (!kind || !date) return NextResponse.json({ error: 'Оберіть місяць і тип місця' }, { status: 400 });
  const months = Number.isInteger(Number(d.months)) && d.months >= 1 && d.months <= 12 ? Number(d.months) : null;
  const len = parseFloat(String(d.length || '').replace(',', '.'));
  const lengthCm = Number.isFinite(len) && len > 0 && len < 40 ? Math.round(len * 100) : null;
  const boatName = String(d.boatName || '').trim().slice(0, 80) || null;

  const c = (await sql`SELECT phone FROM clients WHERE telegram_id = ${String(user.id)}
                        AND phone IS NOT NULL ORDER BY id DESC LIMIT 1`).rows[0];
  if (!c) return NextResponse.json({ error: 'Спершу поділіться номером у боті' }, { status: 400 });

  // Та сама заявка вдруге (подвійний натиск) — не дублюємо.
  const dup = (await sql`SELECT id FROM requests WHERE phone = ${c.phone} AND status = 'new'
                          AND kind = ${kind} AND starts_on = ${date}
                          AND created_at > now() - interval '10 minutes'`).rows[0];
  if (!dup) {
    await sql`INSERT INTO requests (kind, starts_on, length_cm, phone, months, boat_name, source)
              VALUES (${kind}, ${date}, ${lengthCm}, ${c.phone}, ${months}, ${boatName}, 'app')`;
  }
  return NextResponse.json({ ok: true });
}
