import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { cors } from '@/lib/public';
import { freeByMonth } from '@/lib/free';
import { botUsername } from '@/lib/tg';

export const dynamic = 'force-dynamic';

/* Скільки місць вільно — для сайту. Рахуємо з CRM, а не вигадуємо
   (правило проєкту). Стоянка помісячна, тож і вільність — помісячна:
   на 12 місяців уперед, окремо для води, суші й ангара.
   Імен, телефонів і човнів тут немає — лише числа. */

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function GET(req) {
  const headers = cors(req);
  try {
    await ensureSchema();
    const months = await freeByMonth();
    const bot = await botUsername().catch(() => null);
    return NextResponse.json({ months, bot }, { headers });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers });
  }
}
