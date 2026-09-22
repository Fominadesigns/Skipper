/* Налаштування Skipper CRM: кладе три значення у Vercel.

   Значення беремо з файлу, а не питаємо в консолі: у вікні Windows
   не працює Ctrl+V, і вставити довгий токен туди майже неможливо.
   У блокноті вставка працює завжди.

   Файл із значеннями видаляється одразу після відправки. У git він
   не потрапляє (прописаний у .gitignore). Нікуди, крім Vercel,
   значення не йдуть і в консоль не друкуються. */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, 'secrets.txt');

const KEYS = ['CRM_PASSWORD', 'SKIPPER_BOT_TOKEN', 'POSTGRES_URL'];

const TEMPLATE = `# Skipper CRM — значення для налаштування
#
# Вставте кожне значення після знака = , у тому самому рядку.
# Рядок, який починається з #, скрипт не читає.
# Що не готове — лишіть порожнім, воно пропуститься.
#
# Коли вставите — збережіть файл (Ctrl+S) і закрийте блокнот.
# Файл видалиться сам одразу після відправки.

# Пароль, яким ви заходитимете в CRM. Вигадайте самі й запишіть собі.
CRM_PASSWORD=

# Токен бота @skipper_marina_bot із BotFather.
SKIPPER_BOT_TOKEN=

# Рядок підключення з Neon, той що з -pooler. Починається з postgresql://
POSTGRES_URL=
`;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const wait = (q) => new Promise((res) => rl.question(q, res));

function run(args, value) {
  return new Promise((resolve) => {
    const p = spawn('npx', ['--yes', 'vercel@latest', ...args], {
      stdio: ['pipe', 'inherit', 'inherit'], shell: true, cwd: HERE,
    });
    if (value !== undefined) { p.stdin.write(value); p.stdin.end(); }
    p.on('close', (code) => resolve(code));
  });
}

console.log('');
console.log('==========================================');
console.log('  Skipper CRM — налаштування');
console.log('==========================================');
console.log('');

if (!existsSync(FILE)) {
  writeFileSync(FILE, TEMPLATE, 'utf8');
  console.log('Створив файл secrets.txt і зараз відкрию його в блокноті.');
  console.log('');
  spawn('notepad', [FILE], { shell: true, detached: true });
}

console.log('У блокноті вставте значення після знаків = , збережіть (Ctrl+S)');
console.log('і закрийте блокнот.');
console.log('');
await wait('Коли зробите — натисніть тут Enter… ');
console.log('');

const text = readFileSync(FILE, 'utf8');
const vals = {};
for (const line of text.split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const key = line.slice(0, i).trim();
  let val = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  /* Рядок часто копіюють разом із назвою — як Neon його й показує:
     «DATABASE_URL_POOLED=postgresql://…». Відрізаємо назву самі,
     щоб через це не втратити вечір. */
  val = val.replace(/^[A-Z][A-Z0-9_]*\s*=\s*/, '').replace(/^["']|["']$/g, '');
  if (KEYS.includes(key) && val) vals[key] = val;
}

let changed = 0;
for (const key of KEYS) {
  if (!vals[key]) { console.log(`  ${key}: порожнє, пропускаю`); continue; }
  // Стару змінну прибираємо мовчки: інакше додавання впаде на «вже існує».
  await run(['env', 'rm', key, 'production', '--yes']);
  const code = await run(['env', 'add', key, 'production'], vals[key]);
  console.log(code === 0 ? `  ${key}: збережено` : `  ${key}: НЕ збереглося`);
  if (code === 0) changed++;
}
rl.close();

// Файл зі значеннями не має лежати на диску довше, ніж потрібно.
try { unlinkSync(FILE); console.log(''); console.log('  secrets.txt видалено'); }
catch { console.log(''); console.log('  Увага: не вдалось видалити secrets.txt — зробіть це вручну'); }

if (changed === 0) {
  console.log('');
  console.log('Нічого не змінилось. Перезбирати не треба.');
  process.exit(0);
}

console.log('');
console.log('==========================================');
console.log('  Перезбираємо додаток. 1–3 хвилини.');
console.log('==========================================');
console.log('');
await run(['deploy', '--prod', '--yes']);

console.log('');
console.log('Готово. Відкрийте: https://skipper-crm.vercel.app');
console.log('');
