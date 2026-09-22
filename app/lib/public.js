/* Спільне для публічних адрес, до яких звертається сайт станції
   (fominadesigns.github.io). Сайт на іншому домені, тож браузер
   пускає відповідь лише з дозволом CORS. */
const ALLOWED = ['https://fominadesigns.github.io'];

export function cors(req) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

export const KINDS = ['water', 'land', 'hangar'];
