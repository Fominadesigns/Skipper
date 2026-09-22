import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/* Що вже налаштовано. Значень змінних НЕ віддаємо — лише факт наявності:
   сторінка відкрита без пароля, і показувати з неї секрети не можна.

   Базу не просто перевіряємо на наявність рядка, а справді питаємо:
   рядок може бути вписаний, але неправильний, і без цієї перевірки
   людина побачила б незрозумілу помилку вже після входу. */

export async function GET() {
  const hasDbUrl = Boolean(
    process.env.POSTGRES_URL || process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL
  );

  let db = false;
  let dbError = null;
  if (hasDbUrl) {
    try {
      await sql`SELECT 1`;
      db = true;
    } catch (e) {
      dbError = 'База не відповідає — перевірте рядок підключення';
    }
  }

  return NextResponse.json({
    db,
    dbUrlSet: hasDbUrl,
    dbError,
    password: Boolean(process.env.CRM_PASSWORD),
    bot: Boolean(process.env.SKIPPER_BOT_TOKEN),
  });
}
