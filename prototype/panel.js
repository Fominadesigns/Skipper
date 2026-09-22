/* Бічна панель із подробицями. Одна на всі сторінки CRM:
   картка човна, картка рахунку, запис каси, картка місця.
   На телефоні розгортається на всю ширину — див. ui.css. */

const veil  = document.getElementById('veil');
const panel = document.getElementById('panel');
const pbody = document.getElementById('panelBody');

function openPanel(html) {
  pbody.innerHTML = html;
  veil.classList.add('on');
  panel.classList.add('on');
  panel.scrollTop = 0;
}
function closePanel() {
  veil.classList.remove('on');
  panel.classList.remove('on');
}
document.getElementById('closePanel').onclick = closePanel;
veil.onclick = closePanel;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

/* Назва навмисно не rows: на сторінках CRM є <tbody id="rows">, і глобальна
   змінна з тим самим імʼям перекриває цей елемент — таблиця лишається порожньою.
   Одного разу це вже коштувало відладки. */
const rowsHtml = list => `<div class="rows">${list
  .map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`)
  .join('')}</div>`;

const tgMark = tg => tg
  ? `<span class="v" style="color:var(--ok)">під'єднано ✓</span>`
  : `<span class="v" style="color:var(--warn)">не під'єднано</span>`;

/* ── картка човна ─────────────────────────────────────────────────────── */
function boatPanel(s) {
  const state = s.state === 'debt'
    ? `<span class="badge debt">Є&nbsp;борг · ${MONEY}</span>`
    : s.state === 'soon'
      ? `<span class="badge">Заброньовано наперед</span>`
      : `<span class="badge paid">Оплачено за&nbsp;вересень</span>`;

  openPanel(`
    <div class="card" style="margin-top:8px">
      <div class="top">
        <div><div class="h">${s.boat}</div><div class="sub">${s.reg}</div></div>
        <div class="berth">${s.slot}</div>
      </div>
      <div style="margin-top:14px">${state}</div>
    </div>

    <div class="sect">Власник</div>
    <div class="card">
      <div class="rows">
        <div class="row"><span class="k">Ім'я</span><span class="v">${s.owner}</span></div>
        <div class="row"><span class="k">Телефон</span><span class="v mono">${s.phone}</span></div>
        <div class="row"><span class="k">Telegram</span>${tgMark(s.tg)}</div>
      </div>
    </div>

    <div class="sect">Човен</div>
    <div class="card">${rowsHtml([
      ['Довжина (заміряна)', '0,00&nbsp;м'],
      ['Ширина', '0,00&nbsp;м'],
      ['Мотор', '—'],
      ['Трейлер', '—'],
      ['Страховка до', '—'],
    ])}</div>

    <div class="sect">Стоянка</div>
    <div class="card">${rowsHtml([
      ['Місце', s.slot],
      ['Стоїть із', s.since],
      ['Тариф', '<span style="color:var(--muted)">тариф уточнити</span>'],
      ['Рахунок числа', '—'],
    ])}</div>

    <div class="sect">Журнал</div>
    <div class="card">${rowsHtml([
      ['Спуск на&nbsp;воду', '00.09'],
      ['Рахунок надіслано', '00.09'],
      ['Оплату підтверджено', '00.09'],
    ])}</div>

    <div style="margin-top:18px">
      <button class="btn solid">Виставити рахунок</button>
      <button class="btn">Редагувати картку</button>
    </div>
    <div style="height:20px"></div>
  `);
}

/* ── картка рахунку ───────────────────────────────────────────────────── */
const INV_LABEL = {
  draft:   ['', 'Чернетка — ще не надіслана'],
  sent:    ['sent', 'Надіслано, очікуємо оплату'],
  paid:    ['paid', 'Оплачено'],
  overdue: ['debt', 'Прострочено'],
};

function invoicePanel(inv) {
  const s = stayByInvoice(inv.no);
  const [cls, text] = INV_LABEL[inv.status];

  const note = inv.status === 'draft'
    ? `Чернетку сформувала система. Вона нікуди не піде, доки людина
       не натисне «Надіслати».`
    : inv.status === 'paid'
      ? `Оплату підтвердила людина, звіривши з&nbsp;банком.
         Сервіс не бачить рахунку й сам такого не ставить.`
      : `Клієнт бачить цей рахунок у&nbsp;себе в&nbsp;додатку разом із QR,
         де сума вже вписана.`;

  openPanel(`
    <div class="card" style="margin-top:8px">
      <div class="top">
        <div>
          <div class="h">Рахунок №${inv.no}</div>
          <div class="sub">${inv.period} · ${s ? s.owner : '—'}</div>
        </div>
        <div class="berth">${inv.slot}</div>
      </div>
      <div style="margin-top:14px"><span class="badge ${cls}">${text}</span></div>
    </div>

    <div class="sect">Рядки рахунку</div>
    <div class="card">
      <div class="bill-lines">
        <div class="row"><span class="k">Стоянка, ${inv.period}</span><span class="v">${MONEY}</span></div>
        <div class="row"><span class="k">Спуск на&nbsp;воду</span><span class="v">${MONEY}</span></div>
        <div class="row"><span class="k">Електрика</span><span class="v">${MONEY}</span></div>
      </div>
      <div class="row" style="margin-top:13px;padding-top:13px;
           border-top:1px solid rgba(20,26,38,.12);font-size:16px">
        <span class="k" style="font-weight:800;color:var(--ink)">Разом</span>
        <span class="v" style="font-size:16px">${MONEY}</span>
      </div>
    </div>

    <div class="sect">Дати</div>
    <div class="card">${rowsHtml([
      ['Виставлено', inv.issued || '—'],
      ['Оплатити до', inv.due || '—'],
      ['Оплачено', inv.paidAt || '—'],
    ])}</div>

    <div class="sect">Хто платить</div>
    <div class="card">${rowsHtml([
      ['Клієнт', s ? s.owner : '—'],
      ['Телефон', s ? `<span class="mono">${s.phone}</span>` : '—'],
      ['Човен', s ? s.boat : '—'],
      ['Місце', inv.slot],
    ])}
      <div class="note-box">${note}</div>
    </div>

    <div style="margin-top:18px">
      ${inv.status === 'draft'
        ? '<button class="btn solid">Надіслати клієнту</button>'
        : inv.status === 'paid'
          ? '<button class="btn">Відкрити картку човна</button>'
          : '<button class="btn solid">Нагадати про оплату</button>'}
      <button class="btn">Завантажити PDF</button>
    </div>
    <div style="height:20px"></div>
  `);
}

/* ── запис каси ───────────────────────────────────────────────────────── */
function entryPanel(e) {
  const income = e.kind === 'in';
  openPanel(`
    <div class="card" style="margin-top:8px">
      <div class="top">
        <div>
          <div class="h">${e.who}</div>
          <div class="sub">${e.day}</div>
        </div>
        ${e.slot ? `<div class="berth">${e.slot}</div>` : ''}
      </div>
      <div style="margin-top:14px">
        <span class="badge ${income ? 'paid' : 'debt'}">
          ${income ? 'Прихід' : 'Витрата'} · ${income ? '+' : '−'}${MONEY}
        </span>
      </div>
    </div>

    <div class="sect">За що</div>
    <div class="card">${rowsHtml(
      income
        ? [['Послуга', e.what], ['Рахунок', '№' + e.inv], ['Місце', e.slot]]
        : [['На що', e.what], ['Чиї гроші', e.purse], ['Хто платив', e.who]]
    )}</div>

    <div class="sect">Як пройшло</div>
    <div class="card">${rowsHtml([
      ['Спосіб', e.how],
      [income ? 'Підтвердила' : 'Вніс', e.by],
    ])}
      <div class="note-box">${income
        ? `Запис зʼявився сам, коли оплату підтвердили.
           Приходи в&nbsp;касу руками не вписують.`
        : `Витрату вніс адміністратор. Правити й видаляти
           записи може лише власниця.`}
      </div>
    </div>

    <div style="margin-top:18px">
      ${income
        ? '<button class="btn">Відкрити рахунок</button>'
        : '<button class="btn">Редагувати витрату</button>'}
    </div>
    <div style="height:20px"></div>
  `);
}

/* ── картка місця ─────────────────────────────────────────────────────── */
function berthPanel(slot) {
  const s = stayOf(slot.n);
  openPanel(`
    <div class="card" style="margin-top:8px">
      <div class="top">
        <div>
          <div class="h">Місце ${slot.n}</div>
          <div class="sub">${slot.k}</div>
        </div>
        <div class="berth${s ? '' : ' free'}">${slot.n}</div>
      </div>
      <div style="margin-top:14px">
        <span class="badge ${s ? 'sent' : ''}">${s ? 'Зайняте' : 'Вільне'}</span>
      </div>
    </div>

    <div class="sect">Характеристики</div>
    <div class="card">${rowsHtml([
      ['Тип', slot.k],
      ['Макс. довжина', slot.max],
      ['Електрика', '—'],
      ['Вода', '—'],
    ])}</div>

    <div class="sect">Хто стоїть</div>
    <div class="card">${s
      ? rowsHtml([
          ['Човен', s.boat],
          ['Власник', s.owner],
          ['Телефон', `<span class="mono">${s.phone}</span>`],
          ['Стоїть із', s.since],
        ])
      : `<p class="note" style="color:var(--muted);font-size:14px;line-height:1.55">
           Місце вільне. Його можна призначити човну з&nbsp;черги
           або новому клієнту.
         </p>`}
    </div>

    <div style="margin-top:18px">
      ${s
        ? '<button class="btn">Відкрити картку човна</button><button class="btn">Переставити човен</button>'
        : '<button class="btn solid">Поставити човен сюди</button>'}
    </div>
    <div style="height:20px"></div>
  `);
}
