import { cookies } from 'next/headers';

/* Проста перевірка пароля, як у касі: пароль лежить у змінній оточення,
   у cookie — лише позначка «увійшов». Пароль у cookie не кладемо. */

const COOKIE = 'skipper_auth';

export function passwordOk(input) {
  const real = process.env.CRM_PASSWORD || '';
  if (!real) return false;                 // пароль не заданий — вхід закритий
  return String(input) === real;
}

export function isSignedIn() {
  return cookies().get(COOKIE)?.value === 'ok';
}

export const AUTH_COOKIE = COOKIE;
