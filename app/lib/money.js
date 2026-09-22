/* Гроші й тарифи Skipper.

   Суми скрізь — цілі копійки. Дробові числа дають похибку округлення,
   а це рахунок реальної людини.

   Тарифи назвав власник станції 22.09.2026. Вигадувати інші не можна:
   якщо довжина поза таблицею, повертаємо null і показуємо
   «ціну уточнити», а не нуль. */

export const TARIFFS = [
  { maxCm: 600,  kop: 250000, label: '4–6 м' },
  { maxCm: 800,  kop: 300000, label: '6–8 м' },
  { maxCm: 1000, kop: 400000, label: '8–10 м' },
];

/** Тариф за заміряною довжиною судна. null = поза таблицею, за домовленістю. */
export function feeForLength(lengthCm) {
  if (!lengthCm || lengthCm < 400) return null;       // коротші за 4 м
  const t = TARIFFS.find((x) => lengthCm <= x.maxCm);
  return t ? t.kop : null;                            // довші за 10 м
}

export function formatKop(kop) {
  if (kop === null || kop === undefined) return 'ціну уточнити';
  const uah = Math.round(kop / 100);
  return uah.toLocaleString('uk-UA').replace(/ /g, ' ') + ' ₴';
}

export const toKop = (uah) => Math.round(Number(uah) * 100);

/* ── місяці ─────────────────────────────────────────────────────────────
   Стоянку рахуємо місяцями: човен ставлять мінімум на місяць.
   Місяць позначаємо першим числом — так його легко порівнювати. */

export const firstOfMonth = (d) => {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1));
};

export const isoMonth = (d) => firstOfMonth(d).toISOString().slice(0, 10);

export const addMonths = (d, n) => {
  const x = firstOfMonth(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1));
};

/** Скільки місяців від a до b включно з обома. */
export function monthsBetween(a, b) {
  const x = firstOfMonth(a), y = firstOfMonth(b);
  return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 +
         (y.getUTCMonth() - x.getUTCMonth()) + 1;
}

export const MONTHS_SHORT = ['січ','лют','бер','кві','тра','чер',
                             'лип','сер','вер','жов','лис','гру'];
export const MONTHS_GEN = ['січня','лютого','березня','квітня','травня','червня',
                           'липня','серпня','вересня','жовтня','листопада','грудня'];
export const MONTHS_NOM = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                           'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

export const monthLabel = (d) => {
  const x = new Date(d);
  return MONTHS_GEN[x.getUTCMonth()] + ' ' + x.getUTCFullYear();
};

/* ── рахунок стоянки ────────────────────────────────────────────────────
   Одна модель на весь проєкт: скільки нараховано, скільки внесено,
   різниця — борг. Так часткова оплата лягає природно: людина дала
   половину суми, різниця просто меншає. Поле «оплачено по місяць»
   такого не вміє, тому воно тут ЛИШЕ для показу й рахується з оплат. */

/** Скільки нараховано з початку стоянки по місяць `upTo` включно. */
export function accruedKop(booking, upTo = new Date()) {
  const fee = booking.fee_kop;
  if (!fee) return 0;
  const start = firstOfMonth(booking.starts_on);
  const limit = booking.ends_on
    ? new Date(Math.min(+firstOfMonth(booking.ends_on), +firstOfMonth(upTo)))
    : firstOfMonth(upTo);
  if (limit < start) return 0;
  return monthsBetween(start, limit) * fee;
}

/** Борг: нараховано мінус внесено. Переплата боргом не вважається. */
export function debtKop(booking, upTo = new Date()) {
  return Math.max(0, accruedKop(booking, upTo) - (booking.paid_kop || 0));
}

/** Переплата: скільки внесено понад нараховане. */
export function creditKop(booking, upTo = new Date()) {
  return Math.max(0, (booking.paid_kop || 0) - accruedKop(booking, upTo));
}

/** По який місяць закрито повністю. null, якщо не закрито жодного. */
export function coveredThrough(booking) {
  const fee = booking.fee_kop;
  if (!fee) return null;
  const whole = Math.floor((booking.paid_kop || 0) / fee);
  if (whole < 1) return null;
  return addMonths(firstOfMonth(booking.starts_on), whole - 1);
}

/** Місяці, за які ще не оплачено повністю — для рядків рахунку. */
export function unpaidMonths(booking, upTo = new Date()) {
  const out = [];
  const fee = booking.fee_kop;
  if (!fee) return out;
  const start = firstOfMonth(booking.starts_on);
  const limit = booking.ends_on
    ? new Date(Math.min(+firstOfMonth(booking.ends_on), +firstOfMonth(upTo)))
    : firstOfMonth(upTo);

  const whole = Math.floor((booking.paid_kop || 0) / fee);
  let m = addMonths(start, whole);
  while (m <= limit) { out.push(new Date(m)); m = addMonths(m, 1); }
  return out;
}
