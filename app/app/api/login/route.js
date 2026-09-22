import { NextResponse } from 'next/server';
import { passwordOk, AUTH_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  if (!passwordOk(password)) {
    // Не уточнюємо, що саме не так: це лише підказка тому, хто підбирає.
    return NextResponse.json({ error: 'Невірний пароль' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, 'ok', {
    httpOnly: true, sameSite: 'lax', secure: true,
    path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
