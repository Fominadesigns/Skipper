import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { cors, KINDS } from '@/lib/public';
import { phoneTail, botUsername } from '@/lib/tg';

export const dynamic = 'force-dynamic';

/* Заявка з сайту. Лише зберігаємо — підтверджує людина в CRM
   (правило проєкту: сервіс ніколи не підтверджує заявку сам).
   Захист від сміття: приховане поле-пастка для ботів, перевірка
   телефону й дати, одна заявка з номера на 10 хвилин. */

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function POST(req) {
  const headers = cors(req);
  const d = await req.json().catch(() => ({}));
  const bot = await botUsername().catch(() => null);

  // Пастка: людина цього поля не бачить, бот-спамер заповнює.
  if (d.website) return NextResponse.json({ ok: true, bot }, { headers });

  const kind = KINDS.includes(d.kind) ? d.kind : null;
  const phone = String(d.phone || '').trim().slice(0, 40);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : null;
  const len = parseFloat(String(d.length || '').replace(',', '.'));
  const lengthCm = Number.isFinite(len) && len > 0 && len < 40 ? Math.round(len * 100) : null;
  // На скільки місяців: 1–12, або порожньо — «без кінцевої дати».
  const months = Number.isInteger(Number(d.months)) && d.months >= 1 && d.months <= 12 ? Number(d.months) : null;

  if (!kind || !date) {
    return NextResponse.json({ error: 'Оберіть тип місця й дату' }, { status: 400, headers });
  }
  if (!phoneTail(phone)) {
    return NextResponse.json({ error: 'Перевірте номер телефону' }, { status: 400, headers });
  }

  try {
    await ensureSchema();
    const tail = phoneTail(phone);
    const recent = (await sql`
      SELECT id FROM requests
       WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${tail}
         AND created_at > now() - interval '10 minutes'`).rows[0];
    if (!recent) {
      await sql`INSERT INTO requests (kind, starts_on, length_cm, phone, months, source)
                VALUES (${kind}, ${date}, ${lengthCm}, ${phone}, ${months}, 'site')`;
    }
    return NextResponse.json({ ok: true, bot }, { headers });
  } catch {
    return NextResponse.json({ error: 'Не вдалося зберегти — зателефонуйте нам' },
                             { status: 503, headers });
  }
}
