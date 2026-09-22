/* Розбір витрати з одного рядка: «450 пальне», «1 200 фарба картка».
   Слова «картка», «переказ», «безнал» роблять витрату безготівковою,
   інакше — готівка. \b у JavaScript не бачить кирилиці, тому ділимо
   на слова вручну. Повертає null, якщо суми або опису немає. */

const BANK = ['картка', 'карткою', 'карта', 'картою', 'переказ', 'переказом', 'безнал'];
const CASH = ['готівка', 'готівкою', 'нал', 'налом'];

export function parseExpense(text) {
  // Пробіл усередині суми — лише як розділювач тисяч («1 200»), інакше
  // «300 2 каністри» злилося б у 3002.
  const m = String(text || '').match(/(?:\d{1,3}(?:\s\d{3})+|\d+)(?:[.,]\d{1,2})?/);
  if (!m) return null;
  const uah = parseFloat(m[0].replace(/\s/g, '').replace(',', '.'));
  const amountKop = Math.round(uah * 100);
  let method = 'cash';
  const words = String(text).replace(m[0], ' ').split(/\s+/).filter((w) => {
    const l = w.toLowerCase().replace(/[.,!]+$/, '');
    if (BANK.includes(l)) { method = 'bank'; return false; }
    return l && !CASH.includes(l);
  });
  const what = words.join(' ').trim();
  if (!(amountKop > 0) || !what) return null;
  return { amountKop, what: what[0].toUpperCase() + what.slice(1), method };
}
