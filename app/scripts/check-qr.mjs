// Звіряє наш QR із тим, що видав справжній банк (копія butler/scripts/check-qr.ts).
// Якщо структура розійдеться — клієнт відсканує, і нічого не підставиться.
// Запуск: node scripts/check-qr.mjs
import { buildQrPayload, qrLink, payee } from '../lib/payment-qr.js';

const REAL_FROM_BANK =
  'QkNECjAwMgoxClVDVAoK0KTQntCfINCX0LDQtNC40YDQutC-INCa0LDRgtC10YDQuNC90LAg0KHQtdGA0LPRltGX0LLQvdCwClVBMDkzMjIwMDEwMDAwMDI2MDAxMzgwMDI1ODE3CgozMDc5NjE5MDg2CgoKCgo=';
const realText = Buffer.from(REAL_FROM_BANK, 'base64').toString('utf8');
const l = realText.split('\n');
const fromBank = { name: l[5] ?? '', iban: l[6] ?? '', taxId: l[8] ?? '' };

const ours = buildQrPayload(fromBank, 0, '');
const same = ours === realText;
console.log(`Структура збігається з банківською: ${same ? 'ТАК' : 'НІ'}`);
const p = payee();
const samePayee = p && p.name === fromBank.name && p.iban === fromBank.iban && p.taxId === fromBank.taxId;
console.log(`Реквізити в Skipper ті самі, що в банківському QR: ${samePayee ? 'ТАК' : 'НІ'}`);
const withAmount = buildQrPayload(fromBank, 250000, 'Стоянка човна, місце A-01, Катя');
console.log(`Рядок суми для 2 500 ₴: ${JSON.stringify(withAmount.split('\n')[7])}`);
console.log(`Посилання: ${qrLink(withAmount)}`);
process.exit(same && samePayee ? 0 : 1);
