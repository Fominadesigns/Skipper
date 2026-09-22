import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

/* Проста перевірка пароля, як у касі: пароль лежить у змінній оточення.
   У cookie — не пароль і не «ok», а підпис, виведений із пароля.
   Просте «ok» підробляв будь-хто, хто знав назву cookie, і бачив
   телефони клієнтів без пароля. Змінили пароль — старі входи згасли. */

const COOKIE = 'skipper_auth';

export function passwordOk(input) {
  const real = process.env.CRM_PASSWORD || '';
  if (!real) return false;                 // пароль не заданий — вхід закритий
  return String(input) === real;
}

export function authToken() {
  const real = process.env.CRM_PASSWORD || '';
  if (!real) return null;
  return createHmac('sha256', real).update('skipper-crm-session').digest('hex');
}

export function isSignedIn() {
  const want = authToken();
  const got = cookies().get(COOKIE)?.value || '';
  if (!want || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export const AUTH_COOKIE = COOKIE;
