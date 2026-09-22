import { createPool } from '@vercel/postgres';

/* Підключення відкривається ліниво — при першому запиті, а не при
   завантаженні модуля. Інакше збірка на Vercel падає, коли POSTGRES_URL
   ще не заданий. У касі це вже одного разу коштувало зламаного деплою.

   Рядок беремо з POSTGRES_URL, DATABASE_URL_POOLED або DATABASE_URL.
   Vercel прописує перше імʼя, Neon показує друге, Render — третє.
   Плутанина в назві не має ламати додаток, коли рядок насправді
   на місці: це найдурніша з можливих причин зламаного вечора. */

let pool = null;
function db() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL
      || process.env.DATABASE_URL_POOLED
      || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('База не підключена');
    pool = createPool({ connectionString });
  }
  return pool;
}

/** Тег для запитів: sql`SELECT …`. Підключення відкриється при виклику. */
export const sql = (strings, ...values) => db().sql(strings, ...values);

let ready = null;

/** Створює таблиці, якщо їх ще немає. Викликається перед кожним запитом:
 *  дешево (CREATE TABLE IF NOT EXISTS) і рятує від «забув накатити схему». */
export async function ensureSchema() {
  if (ready) return ready;
  ready = (async () => {
    // Місця стоянки: A-01…, B-01… kind: water | land | hangar
    await sql`CREATE TABLE IF NOT EXISTS slots (
      id    SERIAL PRIMARY KEY,
      name  TEXT NOT NULL UNIQUE,
      kind  TEXT NOT NULL DEFAULT 'water',
      sort  INT  NOT NULL DEFAULT 0
    )`;

    // Клієнт. telegram_id порожній, доки людина не натисне «Старт».
    await sql`CREATE TABLE IF NOT EXISTS clients (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      phone       TEXT,
      telegram_id TEXT UNIQUE,
      note        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

    // Човен. length_cm — ЗАМІРЯНА нами довжина, з неї рахується тариф.
    await sql`CREATE TABLE IF NOT EXISTS boats (
      id         SERIAL PRIMARY KEY,
      client_id  INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name       TEXT,
      reg        TEXT,
      length_cm  INT,
      note       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

    /* Стоянка. Суми — цілі копійки (правило проєкту).
       paid_until — перше число місяця, ПО який включно оплачено.
       Порожнє означає, що не оплачено жодного місяця. */
    await sql`CREATE TABLE IF NOT EXISTS bookings (
      id          SERIAL PRIMARY KEY,
      slot_id     INT NOT NULL REFERENCES slots(id),
      boat_id     INT NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
      starts_on   DATE NOT NULL,
      ends_on     DATE,
      fee_kop     INT,
      paid_until  DATE,
      auto_invoice BOOLEAN NOT NULL DEFAULT true,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

    /* Рахунок за один місяць. period — перше число того місяця.
       status: draft | sent | paid. Оплаченим робить лише людина. */
    await sql`CREATE TABLE IF NOT EXISTS invoices (
      id         SERIAL PRIMARY KEY,
      booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      period     DATE NOT NULL,
      amount_kop INT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'draft',
      sent_at    TIMESTAMPTZ,
      paid_at    TIMESTAMPTZ,
      paid_how   TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_per_month
              ON invoices (booking_id, period)`;

    /* Оплати — окремими записами, а не одним полем «оплачено по місяць».
       Інакше не можна прийняти часткову оплату: людина дала половину
       суми, і записати це нема куди. Скільки оплачено — завжди сума
       цих рядків. method: cash | bank */
    await sql`CREATE TABLE IF NOT EXISTS payments (
      id         SERIAL PRIMARY KEY,
      booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      amount_kop INT NOT NULL,
      method     TEXT NOT NULL DEFAULT 'cash',
      note       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS payments_by_booking
              ON payments (booking_id)`;

    /* Журнал розсилок — проти дублів. Ключ у БАЗІ, а не в памʼяті процесу:
       на Vercel кожен запит може виконуватись іншим екземпляром. */
    await sql`CREATE TABLE IF NOT EXISTS message_log (
      id         SERIAL PRIMARY KEY,
      client_id  INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,
      invoice_id INT REFERENCES invoices(id) ON DELETE CASCADE,
      sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS message_log_once
              ON message_log (client_id, kind, invoice_id)`;
  })();
  return ready;
}

