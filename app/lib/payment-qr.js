import QRCode from 'qrcode';

/* ══════════════════════════════════════════════════════════════════════
   QR для переказу на рахунок ФОП за стандартом НБУ.
   КОПІЯ butler/src/domain/payment-qr.ts (перекладена з TypeScript у JS).
   Правиш тут — перевір, чи не треба те саме в Butler.

   Формат звірено з реальним QR, який видав банк власниці, — не з документації
   (див. scripts/check-qr.mjs). Ключові деталі, на яких легко помилитись:
     • версія 002 (не 001, як у старих прикладах);
     • рядок суми має вигляд UAH1234 — порожній, якщо суму не фіксуємо;
     • після 12 полів ідуть ще два переноси рядка;
     • у QR кладемо не сам текст, а посилання bank.gov.ua/qr/<base64>.
       Так його розпізнає навіть звичайна камера телефона.

   Свідомо НЕ еквайринг: клієнт переказує сам за реквізитами — це не
   розрахункова операція і ПРРО не потрібен (перед справжніми грошима це
   має підтвердити бухгалтер).
   ══════════════════════════════════════════════════════════════════ */

/* Реквізити — ті самі, що в Butler (рішення Каті: нових не заводимо).
   Узяті з QR, який видав банк (butler/scripts/check-qr.ts). Змінні
   оточення SKIPPER_PAYEE_* можуть їх перекрити, якщо рахунок зміниться. */
const DEFAULT_PAYEE = {
  name: 'ФОП Задирко Катерина Сергіївна',
  iban: 'UA093220010000026001380025817',
  taxId: '3079619086',
};

/** Реквізити або є повністю, або їх немає — половинчастий QR гірший за жоден. */
export function payee() {
  const name = (process.env.SKIPPER_PAYEE_NAME || DEFAULT_PAYEE.name).trim();
  const iban = (process.env.SKIPPER_PAYEE_IBAN || DEFAULT_PAYEE.iban).replace(/\s+/g, '').toUpperCase();
  const taxId = (process.env.SKIPPER_PAYEE_TAX_ID || DEFAULT_PAYEE.taxId).replace(/\D/g, '');
  if (!name || !iban || !taxId) return null;
  if (!/^UA\d{27}$/.test(iban)) return null;
  return { name, iban, taxId };
}

/** Порядок рядків фіксований стандартом — міняти не можна. */
export function buildQrPayload(p, amountKop, purpose) {
  const amount = (amountKop / 100).toFixed(2).replace(/\.00$/, '');
  const fields = [
    'BCD',  // службова мітка
    '002',  // версія
    '1',    // кодування UTF-8
    'UCT',  // кредитовий переказ
    '',     // BIC — в Україні не заповнюється
    p.name,
    p.iban,
    amountKop > 0 ? `UAH${amount}` : '',
    p.taxId,
    '',     // структуроване призначення
    '',     // код призначення
    purpose,
  ];
  return fields.join('\n') + '\n\n';
}

/** Саме таке посилання видає банк. Воно й потрапляє у QR. */
export function qrLink(payload) {
  return `https://bank.gov.ua/qr/${Buffer.from(payload, 'utf8').toString('base64')}`;
}

export function purposeFor(slotName, boatName, clientName) {
  // Банки ріжуть довгі призначення — лишаємо найсуттєвіше на початку.
  return `Стоянка човна, місце ${slotName}${boatName ? ', ' + boatName : ''}, ${clientName}`.slice(0, 140);
}

/** SVG малюється у нас на сервері: дані клієнта не йдуть у чужий сервіс QR. */
export function renderQrSvg(link) {
  return QRCode.toString(link, { type: 'svg', errorCorrectionLevel: 'M', margin: 0 });
}

/** Усе для рахунку однією викликою: посилання в банк і намальований QR. */
export async function payFor(amountKop, purpose) {
  const p = payee();
  if (!p || !(amountKop > 0)) return { payee: p, payUrl: null, qrSvg: null };
  const payUrl = qrLink(buildQrPayload(p, amountKop, purpose));
  return { payee: p, payUrl, qrSvg: await renderQrSvg(payUrl) };
}
