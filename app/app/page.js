'use client';

import { useEffect, useState, useCallback } from 'react';
import Script from 'next/script';

/* ══════════════════════════════════════════════════════════════════════
   CRM човнової станції. Відкривається з комп'ютера за паролем.

   Календар по МІСЯЦЯХ: човен ставлять мінімум на місяць, і денна
   сітка тут тільки заважала б.

   Компоненти оголошені на рівні модуля, а не всередині Crm. Якщо
   оголосити їх усередині, React вважає компонент новим типом при
   кожному перемальовуванні, знищує піддерево — і поле вводу губить
   фокус після кожної літери. У касі це вже одного разу коштувало
   зламаної клавіатури на телефоні.
   ══════════════════════════════════════════════════════════════════ */

const MONTHS_SHORT = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];
const MONTHS_GEN = ['січня','лютого','березня','квітня','травня','червня',
                    'липня','серпня','вересня','жовтня','листопада','грудня'];
const MONTHS_NOM = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                    'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

const money = (kop) =>
  kop === null || kop === undefined
    ? 'ціну уточнити'
    : Math.round(kop / 100).toLocaleString('uk-UA').replace(/ /g, ' ') + ' ₴';

const mKey = (d) => { const x = new Date(d); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
const keyToLabel = (k) => MONTHS_NOM[k % 12] + ' ' + Math.floor(k / 12);
const KIND = { water: 'на воді', land: 'на суші', hangar: 'ангар' };

/* Місяці для випадайок: від початку минулого року до кінця
   наступного. Ширше не треба — стоянку не планують на пʼять років. */
function monthOptions(centerKey) {
  const from = centerKey - 12;
  return Array.from({ length: 36 }, (_, i) => from + i);
}
const keyToMonth = (k) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}-01`;
const monthToKey = (d) => { const x = new Date(d); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };

const Anchor = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="5" r="2.2" /><path d="M12 7.2V21" /><path d="M7.5 10.5h9" />
    <path d="M3.8 14.3A8.4 8.4 0 0 0 12 21a8.4 8.4 0 0 0 8.2-6.7" />
  </svg>
);

/* ── налаштування ─────────────────────────────────────────────────────────
   Поки не задані змінні оточення, показуємо не порожній екран, а список
   того, чого бракує. Інакше людина відкриває адресу й не розуміє,
   чому нічого немає. */
function Setup({ st }) {
  const Item = ({ ok, name, what }) => (
    <div className="row-card" style={{ cursor: 'default' }}>
      <div className="bchip" style={ok ? { background: 'linear-gradient(145deg,#ffffff,#e2e7f7)' }
                                       : { background: 'linear-gradient(145deg,#ffd84d,#f5c21b)', color: '#141d42', textShadow: 'none' }}>
        {ok ? '✓' : '—'}
      </div>
      <div className="body">
        <div className="n">{name}</div>
        <div className="m">{what}</div>
      </div>
    </div>
  );

  return (
    <div className="wrap" style={{ maxWidth: 620 }}>
      <div className="top">
        <div className="logo"><Anchor /></div>
        <div>
          <h1>Skipper · CRM</h1>
          <div className="sub">залишилось налаштувати</div>
        </div>
      </div>

      <Item ok={st.db} name="POSTGRES_URL" what="база даних — без неї нічого не зберігається" />
      <Item ok={st.password} name="CRM_PASSWORD" what="пароль, яким ви заходите сюди" />
      <Item ok={st.bot} name="SKIPPER_BOT_TOKEN" what="токен бота — щоб рахунки йшли в Telegram" />

      <div className="note" style={{ marginTop: 18 }}>
        Додаються в&nbsp;панелі Vercel: проєкт <b>skipper-crm</b> →
        Settings → Environment Variables. Після додавання натисніть там
        Redeploy — змінні починають діяти лише з наступної збірки.
      </div>
      <div className="note">
        Базу найпростіше взяти там&nbsp;же: Storage → Create Database → Neon.
        Vercel сам пропише <b>POSTGRES_URL</b>, вписувати руками нічого не&nbsp;треба.
      </div>
    </div>
  );
}

/* ── вхід ─────────────────────────────────────────────────────────────── */
function Login({ onIn }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (r.ok) onIn(); else setErr('Невірний пароль');
  };

  return (
    <div className="center">
      <form className="card" style={{ width: 340 }} onSubmit={submit}>
        <div className="top" style={{ marginBottom: 16 }}>
          <div className="logo"><Anchor /></div>
          <div>
            <h1>Skipper</h1>
            <div className="sub">CRM човнової станції</div>
          </div>
        </div>
        <div className="lbl">Пароль</div>
        <input className="field" type="password" value={pw} autoFocus
               onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
        {err && <div className="note warn" style={{ marginTop: 10 }}>{err}</div>}
        <button className="btn solid" type="submit" disabled={busy}
                style={{ width: '100%', marginTop: 14 }}>
          {busy ? 'Заходимо…' : 'Увійти'}
        </button>
      </form>
    </div>
  );
}

/* ── календар ─────────────────────────────────────────────────────────── */
function Calendar({ slots, bookings, winStart, setWinStart, nowKey, onBooking, onFree }) {
  const months = Array.from({ length: 6 }, (_, i) => winStart + i);
  const bySlot = {};
  for (const b of bookings) (bySlot[b.slot_id] ||= []).push(b);

  return (
    <div className="cal-desk">
      <div className="top" style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={() => setWinStart(winStart - 1)}>‹</button>
        <div style={{ fontWeight: 800, fontSize: 15 }}>
          {keyToLabel(winStart)} — {keyToLabel(winStart + 5)}
        </div>
        <button className="btn sm" onClick={() => setWinStart(winStart + 1)}>›</button>
      </div>

      <div className="cal">
        <table className="mgrid">
          <thead>
            <tr>
              <th className="c" />
              {months.map((k) => <th key={k}>{MONTHS_SHORT[k % 12]}</th>)}
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id}>
                <td className="slot"><span className="sn">{s.name}</span></td>
                {months.map((k) => {
                  const b = (bySlot[s.id] || []).find((x) => {
                    const from = mKey(x.starts_on);
                    const to = x.ends_on ? mKey(x.ends_on) : Infinity;
                    return k >= from && k <= to;
                  });
                  if (!b) {
                    return (
                      <td className="m" key={k}>
                        <div className={'cell free' + (k === nowKey ? ' now' : '')}
                             title="Додати бронь"
                             onClick={() => onFree(s, k)} />
                      </td>
                    );
                  }
                  /* Три стани, а не два: місяць у майбутньому ще не
                     нарахований, і фарбувати його як оплачений — обман. */
                  const coveredKey = b.covered_through ? mKey(b.covered_through) : -Infinity;
                  const future = k > nowKey;
                  const debt = !future && k > coveredKey;
                  const first = mKey(b.starts_on) === k || k === months[0];
                  return (
                    <td className="m" key={k}>
                      <div className={"cell on" + (debt ? " debt" : future ? " future" : "")
                                       + (k === nowKey ? " now" : "")}
                           title={`${b.boat_name || 'Човен'} · ${b.client_name}`}
                           onClick={() => onBooking(b)}>
                        {first ? (b.boat_name || b.client_name) : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span><i className="p" />оплачено</span>
        <span><i className="d" />борг</span>
        <span><i className="u" />попереду, ще не нараховано</span>
        <span><i className="f" />вільно · натисніть, щоб додати</span>
      </div>
    </div>
 );
}

/* ── календар на телефоні ─────────────────────────────────────────────────
   Таблиця з шести місяців не влазить у телефон, і її доводилось возити
   пальцем. Тут — один місяць списком: кожне місце одним рядком,
   колір плашки — стан. Місяці гортаються стрілками. */
function MobileMonth({ slots, bookings, nowKey, onBooking, onFree }) {
  const [k, setK] = useState(nowKey);
  const bySlot = {};
  for (const b of bookings) (bySlot[b.slot_id] ||= []).push(b);

  const rows = slots.map((s) => {
    const b = (bySlot[s.id] || []).find((x) => {
      const from = mKey(x.starts_on);
      const to = x.ends_on ? mKey(x.ends_on) : Infinity;
      return k >= from && k <= to;
    });
    if (!b) return { s, state: 'free' };
    const coveredKey = b.covered_through ? mKey(b.covered_through) : -Infinity;
    const state = k > nowKey ? 'future' : k > coveredKey ? 'debt' : 'paid';
    return { s, b, state };
  });
  const count = (st) => rows.filter((r) => r.state === st).length;

  return (
    <div className="cal-mob">
      <div className="top" style={{ marginBottom: 12, flexWrap: 'nowrap' }}>
        <button className="btn sm" onClick={() => setK(k - 1)} aria-label="Попередній місяць">‹</button>
        <div style={{ fontWeight: 800, fontSize: 16, flex: 1, textAlign: 'center' }}>
          {keyToLabel(k)}{k === nowKey ? ' · зараз' : ''}
        </div>
        <button className="btn sm" onClick={() => setK(k + 1)} aria-label="Наступний місяць">›</button>
      </div>

      <div className="mstat">
        <span>оплачено <b>{count('paid')}</b></span>
        <span>борг <b>{count('debt')}</b></span>
        {count('future') > 0 && <span>попереду <b>{count('future')}</b></span>}
        <span>вільно <b>{count('free')}</b></span>
      </div>

      {rows.map(({ s, b, state }) => (
        <div className="mrow" key={s.id}
             onClick={() => (b ? onBooking(b) : onFree(s, k))}>
          <div className={'bchip' + (state === 'debt' ? ' debt' : state === 'future' ? ' future'
                                       : state === 'free' ? ' free' : '')}>{s.name}</div>
          <div className="body">
            <div className="n">{b ? (b.boat_name || 'Човен без назви') : 'Вільне місце'}</div>
            <div className="m">{b ? b.client_name : (KIND[s.kind] || s.kind)}</div>
          </div>
          <div className={'v ' + (state === 'debt' ? 'debt' : state === 'free' ? 'free' : 'ok')}>
            {state === 'debt' ? money(b.debt_kop)
              : state === 'paid' ? '✓'
              : state === 'future' ? '' : '+ додати'}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Telegram. Коли CRM відкрита як міні-додаток, свайп униз за
   замовчуванням згортає вікно — під час прокрутки воно смикалось.
   Вимикаємо це й розгортаємо на весь екран. У звичайному браузері
   window.Telegram.WebApp.initData порожній, і нічого не відбувається. */
function initTelegram() {
  const tg = typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initData) return;
  try {
    tg.ready();
    tg.expand();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    if (tg.setHeaderColor) tg.setHeaderColor('#141d42');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#141d42');
  } catch { /* стара версія Telegram — просто без цих зручностей */ }
}

/* ── картка броні ─────────────────────────────────────────────────────── */
function BookingModal({ b, onClose, act, busy, onPay, onEdit }) {
  if (!b) return null;
  return (
    <div className="veil" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2>{b.boat_name || 'Човен без назви'}</h2>
            <div className="sub">{b.slot_name} · {KIND[b.slot_kind] || b.slot_kind}</div>
          </div>
          <button className="btn sm" onClick={onClose}>×</button>
        </div>

        <div style={{ marginTop: 16 }} className="card">
          <div className="rows">
            <div className="row"><span className="k">Клієнт</span><span className="v">{b.client_name}</span></div>
            <div className="row"><span className="k">Телефон</span><span className="v">{b.phone || '—'}</span></div>
            <div className="row"><span className="k">Telegram</span>
              <span className="v" style={{ color: b.telegram_id ? 'var(--ok)' : 'var(--warn)' }}>
                {b.telegram_id ? 'підключено' : 'не підключено'}</span></div>
            <div className="row"><span className="k">Довжина</span>
              <span className="v">{b.length_cm ? (b.length_cm / 100).toFixed(2).replace('.', ',') + ' м' : '—'}</span></div>
            <div className="row"><span className="k">Тариф</span><span className="v">{money(b.fee_kop)}</span></div>
            <div className="row"><span className="k">Заїзд</span>
              <span className="v">{new Date(b.starts_on).getUTCDate()} {MONTHS_GEN[new Date(b.starts_on).getUTCMonth()]}</span></div>
            <div className="row"><span className="k">Оплачено по</span>
              <span className="v">{b.covered_through ? keyToLabel(mKey(b.covered_through)) : "не оплачено"}</span></div>
            <div className="row"><span className="k">Внесено всього</span>
              <span className="v">{money(b.paid_kop || 0)}</span></div>
            <div className="row"><span className="k">{b.credit_kop ? "Переплата" : "Борг"}</span>
              <span className="v" style={{ color: b.debt_kop ? "var(--warn)" : "var(--ok)" }}>
                {b.debt_kop ? money(b.debt_kop)
                  : b.credit_kop ? money(b.credit_kop) : "немає"}</span></div>
          </div>
        </div>

        <div className="sect">Оплата</div>
        <button className="btn" style={{ width: "100%" }} disabled={busy}
                onClick={() => onPay(b)}>
          Внести оплату — готівкою або переказом
        </button>

        <div className="sect">Рахунок</div>
        <button className="btn solid" style={{ width: '100%' }} disabled={busy}
                onClick={() => act('invoice', { bookingId: b.id })}>
          Виставити й надіслати в Telegram
        </button>

        <button className="btn" style={{ width: "100%", marginTop: 14 }} disabled={busy}
                onClick={() => onEdit(b)}>
          Редагувати стоянку
        </button>

        <div className="note">
          Оплату завжди вносить людина. Сервіс не бачить банківського рахунку
          й ніколи не позначає гроші отриманими сам.
        </div>
      </div>
    </div>
  );
}

/* ── внесення оплати ──────────────────────────────────────────────────────
   Сума довільна: людина могла дати частину. Тоді залишок лишається
   боргом, і його видно прямо тут, перш ніж натиснути. */
function PayModal({ b, onClose, onSave, busy }) {
  const [uah, setUah] = useState("");
  const [how, setHow] = useState("cash");

  useEffect(() => {
    if (b) { setUah(b.debt_kop ? String(Math.round(b.debt_kop / 100)) : ""); setHow("cash"); }
  }, [b]);

  if (!b) return null;

  const kop = Math.round((parseFloat(String(uah).replace(",", ".")) || 0) * 100);
  const left = Math.max(0, (b.debt_kop || 0) - kop);
  const over = Math.max(0, kop - (b.debt_kop || 0));

  return (
    <div className="veil" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h2>Внести оплату</h2>
            <div className="sub">{b.client_name} · {b.slot_name}</div>
          </div>
          <button className="btn sm" onClick={onClose}>×</button>
        </div>

        <div className="note" style={{ marginTop: 14 }}>
          Борг зараз: <b>{b.debt_kop ? money(b.debt_kop) : "немає"}</b>
          {b.fee_kop ? <> · тариф {money(b.fee_kop)} на місяць</> : null}
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="lbl">Скільки внесли, грн</div>
          <input className="field" value={uah} inputMode="decimal" autoFocus
                 onChange={(e) => setUah(e.target.value)} placeholder="3000" />
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="lbl">Як отримали</div>
          <div className="two">
            <button className={"btn" + (how === "cash" ? " blue" : "")}
                    onClick={() => setHow("cash")}>Готівкою</button>
            <button className={"btn" + (how === "bank" ? " blue" : "")}
                    onClick={() => setHow("bank")}>Переказом</button>
          </div>
        </div>

        {kop > 0 && (
          <div className="note" style={{ color: left ? "var(--warn)" : "var(--ok)" }}>
            {left > 0
              ? <>Після цієї оплати лишиться борг <b>{money(left)}</b></>
              : over > 0
                ? <>Борг закриється, і буде переплата <b>{money(over)}</b> — піде на наступні місяці</>
                : <>Борг закриється повністю</>}
          </div>
        )}

        <button className="btn solid" style={{ width: "100%", marginTop: 16 }}
                disabled={busy || kop <= 0}
                onClick={() => onSave({ bookingId: b.id, how, amountKop: kop })}>
          Записати {kop > 0 ? money(kop) : ""}
        </button>

        <div className="note">
          Сервіс не бачить банківського рахунку. Цей запис — ваше
          підтвердження, що гроші справді прийшли.
        </div>
      </div>
    </div>
  );
}

/* ── редагування стоянки ──────────────────────────────────────────────────
   Переставити на інше місце, змінити тариф, закрити стоянку або
   видалити зовсім. Видалення питає підтвердження: разом із бронню
   зникають її оплати й рахунки, а це не відкотиш. */
function EditModal({ b, slots, bookings, onClose, onSave, onDelete, busy }) {
  const [f, setF] = useState(null);

  useEffect(() => {
    if (!b) { setF(null); return; }
    setF({
      slotId: String(b.slot_id),
      feeUah: b.fee_kop ? String(Math.round(b.fee_kop / 100)) : "",
      lengthM: b.length_cm ? String((b.length_cm / 100).toFixed(2)).replace(".", ",") : "",
      boatName: b.boat_name || "",
      clientName: b.client_name || "",
      phone: b.phone || "",
      fromKey: monthToKey(b.starts_on),
      toKey: b.ends_on ? monthToKey(b.ends_on) : "open",
    });
  }, [b]);

  if (!b || !f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Місця, вільні для перестановки, плюс поточне.
  const taken = new Set(bookings.filter((x) => x.id !== b.id).map((x) => x.slot_id));
  const free = slots.filter((s) => !taken.has(s.id));

  return (
    <div className="veil" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h2>Редагувати стоянку</h2>
            <div className="sub">{b.boat_name || "човен"} · {b.client_name}</div>
          </div>
          <button className="btn sm" onClick={onClose}>×</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="lbl">Місце</div>
          <select className="field" value={f.slotId} onChange={set("slotId")}>
            {free.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {KIND[s.kind] || s.kind}{s.id === b.slot_id ? " (зараз тут)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="two" style={{ marginTop: 12 }}>
          <div>
            <div className="lbl">Тариф, грн/міс</div>
            <input className="field" value={f.feeUah} onChange={set("feeUah")}
                   inputMode="decimal" placeholder="3000" />
          </div>
          <div>
            <div className="lbl">Човен</div>
            <input className="field" value={f.boatName} onChange={set("boatName")} />
          </div>
          <div>
            <div className="lbl">Довжина, м</div>
            <input className="field" value={f.lengthM} onChange={set("lengthM")}
                   inputMode="decimal" placeholder="6,4" />
          </div>
        </div>

        <div className="two" style={{ marginTop: 12 }}>
          <div>
            <div className="lbl">З якого місяця</div>
            <select className="field" value={f.fromKey} onChange={set("fromKey")}>
              {monthOptions(monthToKey(b.starts_on)).map((k) => (
                <option key={k} value={k}>{keyToLabel(k)}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="lbl">По який місяць</div>
            <select className="field" value={f.toKey} onChange={set("toKey")}>
              <option value="open">без кінцевої дати</option>
              {monthOptions(monthToKey(b.starts_on))
                .filter((k) => k >= Number(f.fromKey))
                .map((k) => <option key={k} value={k}>{keyToLabel(k)}</option>)}
            </select>
          </div>
        </div>

        <div className="two" style={{ marginTop: 12 }}>
          <div>
            <div className="lbl">Клієнт</div>
            <input className="field" value={f.clientName} onChange={set("clientName")} />
          </div>
          <div>
            <div className="lbl">Телефон</div>
            <input className="field" value={f.phone} onChange={set("phone")} inputMode="tel" />
          </div>
        </div>

        <button className="btn solid" style={{ width: "100%", marginTop: 16 }} disabled={busy}
                onClick={() => onSave({
                  id: b.id,
                  slotId: Number(f.slotId),
                  feeKop: f.feeUah.trim()
                    ? Math.round(parseFloat(f.feeUah.replace(",", ".")) * 100) : null,
                  lengthCm: f.lengthM.trim()
                    ? Math.round(parseFloat(f.lengthM.replace(",", ".")) * 100) : null,
                  boatName: f.boatName.trim(),
                  clientName: f.clientName.trim(),
                  phone: f.phone.trim(),
                  startsOn: keyToMonth(Number(f.fromKey)),
                  endsOn: f.toKey === "open" ? null : keyToMonth(Number(f.toKey)),
                })}>
          Зберегти зміни
        </button>

        <div className="note">
          Тариф можна лишити порожнім — тоді він порахується з довжини
          судна. «Без кінцевої дати» означає, що нарахування йде щомісяця,
          доки ви не поставите кінець.
        </div>

        <button className="btn" style={{ width: "100%", marginTop: 14, color: "var(--warn)" }}
                disabled={busy}
                onClick={() => {
                  if (confirm("Видалити цю стоянку? Разом із нею зникнуть її оплати й рахунки. Це не відкотити."))
                    onDelete(b.id);
                }}>
          Видалити стоянку
        </button>
      </div>
    </div>
  );
}

/* ── нова бронь ───────────────────────────────────────────────────────── */
function NewModal({ slot, monthKey, onClose, onSave, busy }) {
  const [f, setF] = useState(null);

  useEffect(() => {
    if (slot) {
      setF({ clientName: '', phone: '', boatName: '', reg: '', lengthM: '',
             fromKey: monthKey, months: '3' });
    }
  }, [slot, monthKey]);

  if (!slot || !f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const fromKey = Number(f.fromKey);
  const n = f.months === 'open' ? null : Number(f.months);
  const startsOn = keyToMonth(fromKey);
  const endsOn = n ? keyToMonth(fromKey + n - 1) : null;

  return (
    <div className="veil" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2>Нова стоянка</h2>
            <div className="sub">
              місце {slot.name} · {keyToLabel(fromKey).toLowerCase()}
              {endsOn ? " — " + keyToLabel(fromKey + n - 1).toLowerCase() : " і далі"}
            </div>
          </div>
          <button className="btn sm" onClick={onClose}>×</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="lbl">Ім'я клієнта</div>
          <input className="field" value={f.clientName} onChange={set('clientName')}
                 placeholder="Петро Коваль" autoFocus />
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="lbl">Телефон</div>
          <input className="field" value={f.phone} onChange={set('phone')}
                 placeholder="+380 __ ___ __ __" inputMode="tel" />
        </div>
        <div className="two" style={{ marginTop: 12 }}>
          <div>
            <div className="lbl">Човен</div>
            <input className="field" value={f.boatName} onChange={set('boatName')} placeholder="«Чайка»" />
          </div>
          <div>
            <div className="lbl">Довжина, м</div>
            <input className="field" value={f.lengthM} onChange={set('lengthM')}
                   placeholder="6,4" inputMode="decimal" />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="lbl">Реєстраційний номер</div>
          <input className="field" value={f.reg} onChange={set("reg")} placeholder="UA-0000-KV" />
        </div>

        <div className="two" style={{ marginTop: 12 }}>
          <div>
            <div className="lbl">З якого місяця</div>
            <select className="field" value={f.fromKey} onChange={set("fromKey")}>
              {monthOptions(monthKey).map((k) => (
                <option key={k} value={k}>{keyToLabel(k)}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="lbl">На скільки</div>
            <select className="field" value={f.months} onChange={set("months")}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                <option key={m} value={String(m)}>
                  {m} {m === 1 ? "місяць" : m < 5 ? "місяці" : "місяців"}
                </option>
              ))}
              <option value="open">без кінцевої дати</option>
            </select>
          </div>
        </div>

        <button className="btn solid" style={{ width: '100%', marginTop: 16 }} disabled={busy}
                onClick={() => onSave({
                  slotId: slot.id,
                  clientName: f.clientName.trim() || 'Без імені',
                  phone: f.phone.trim(),
                  boatName: f.boatName.trim(),
                  reg: f.reg.trim(),
                  lengthCm: f.lengthM ? Math.round(parseFloat(f.lengthM.replace(',', '.')) * 100) : null,
                  startsOn,
                  endsOn,
                })}>
          Зберегти стоянку
        </button>

        <div className="note">
          Тариф порахується сам за довжиною: до 6&nbsp;м — 2500&nbsp;₴,
          до 8&nbsp;м — 3000&nbsp;₴, до 10&nbsp;м — 4000&nbsp;₴.
          Поза цими межами — «ціну уточнити».
          {endsOn ? null : " Без кінцевої дати стоянка тягнеться далі, і нарахування йде щомісяця."}
        </div>
      </div>
    </div>
  );
}

/* ── каса ─────────────────────────────────────────────────────────────────
   Усі рухи грошей по місяцях: приходи (оплати стоянок, готівкою
   й переказом) і витрати. Прихід можна внести, не відкриваючи
   календар: знайти клієнта за ім'ям чи телефоном — і та сама оплата
   одразу закриває борг у броні й на дашборді. */
const HOW = { cash: 'готівка', bank: 'переказ' };
const dayLabel = (d) => { const x = new Date(d); return x.getDate() + ' ' + MONTHS_GEN[x.getMonth()]; };
const localKey = (d) => { const x = new Date(d); return x.getFullYear() * 12 + x.getMonth(); };

function Kassa({ kassa, nowKey, busy, act, onIncome, onExpense }) {
  const [monthKey, setMonthKey] = useState(nowKey);
  const [filter, setFilter] = useState('all');
  if (!kassa) return <div className="note">Завантажуємо касу…</div>;

  const all = [
    ...kassa.incomes.map((p) => ({ ...p, kind: 'in' })),
    ...kassa.expenses.map((e) => ({ ...e, kind: 'out' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const month = all.filter((e) => localKey(e.created_at) === monthKey);
  const sum = (arr) => arr.reduce((s, e) => s + e.amount_kop, 0);
  const ins = month.filter((e) => e.kind === 'in');
  const outs = month.filter((e) => e.kind === 'out');
  const cash = sum(all.filter((e) => e.kind === 'in' && e.method === 'cash'))
             - sum(all.filter((e) => e.kind === 'out' && e.method === 'cash'));
  const shown = month.filter((e) => filter === 'all' || e.kind === filter);

  const remove = (e) => {
    const what = e.kind === 'in'
      ? `оплату ${money(e.amount_kop)} від ${e.client_name}? Борг у броні повернеться.`
      : `витрату ${money(e.amount_kop)} · ${e.what}?`;
    if (!confirm('Видалити ' + what)) return;
    act((e.kind === 'in' ? 'payment' : 'expense') + '?id=' + e.id, {}, 'DELETE');
  };

  return (
    <div>
      <div className="top" style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={() => setMonthKey(monthKey - 1)}>‹</button>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{keyToLabel(monthKey)}</div>
        <button className="btn sm" onClick={() => setMonthKey(monthKey + 1)}
                disabled={monthKey >= nowKey}>›</button>
      </div>

      <div className="kpi">
        <div className="k"><div className="l">Прийшло</div><div className="v ok">{money(sum(ins))}</div></div>
        <div className="k"><div className="l">з них готівкою</div>
          <div className="v">{money(sum(ins.filter((e) => e.method === 'cash')))}</div></div>
        <div className="k"><div className="l">з них переказом</div>
          <div className="v">{money(sum(ins.filter((e) => e.method === 'bank')))}</div></div>
        <div className="k"><div className="l">Витрати</div><div className="v debt">{money(sum(outs))}</div></div>
        <div className="k"><div className="l">Готівка на&nbsp;руках</div><div className="v">{money(cash)}</div></div>
      </div>

      <div className="two" style={{ marginTop: 16 }}>
        <button className="btn solid" disabled={busy} onClick={onIncome}>+ Прихід</button>
        <button className="btn" disabled={busy} onClick={onExpense}>+ Витрата</button>
      </div>

      <div className="sect">Записи</div>
      <div className="two" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 12 }}>
        {[['all', 'Усе'], ['in', 'Приходи'], ['out', 'Витрати']].map(([k, l]) => (
          <button key={k} className={'btn sm' + (filter === k ? ' blue' : '')}
                  onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {shown.length === 0 && <div className="note">За {keyToLabel(monthKey).toLowerCase()} записів немає.</div>}
      {shown.map((e) => (
        <div className="row-card" key={e.kind + e.id} onClick={() => remove(e)}
             title="Натисніть, щоб видалити помилковий запис">
          <div className={'bchip' + (e.kind === 'out' ? ' out' : '')}>
            {e.kind === 'in' ? e.slot_name : '−'}
          </div>
          <div className="body">
            <div className="n">{e.kind === 'in' ? e.client_name : e.what}</div>
            <div className="m">
              {e.kind === 'in' ? (e.boat_name || 'стоянка') + ' · ' : (e.source === 'bot' ? 'з бота · ' : '')}
              {HOW[e.method] || e.method} · {dayLabel(e.created_at)}
            </div>
          </div>
          <div className={'v ' + (e.kind === 'in' ? 'ok' : 'debt')}>
            {e.kind === 'in' ? '+' : '−'}{money(e.amount_kop)}
          </div>
        </div>
      ))}

      <div className="sect">Бот для витрат</div>
      <div className="card">
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
          Влад пише боту одним рядком: <b>450 пальне</b> або <b>1200 фарба картка</b> —
          і витрата одразу з&apos;являється тут. «скасувати» прибирає останню.
        </div>
        <div className="note">
          Щоб запрацювало: 1) у Vercel додати змінну <b>SKIPPER_STAFF_IDS</b> —
          Telegram ID тих, хто вносить витрати, через кому (бот скаже ID
          на&nbsp;команду <b>/id</b>); 2) задеплоїти; 3) натиснути кнопку нижче один раз.
        </div>
        <button className="btn" style={{ width: '100%', marginTop: 12 }} disabled={busy}
                onClick={() => act('tg-setup', {})}>
          Під&apos;єднати бота
        </button>
      </div>
    </div>
  );
}

/* Прихід без календаря: пошук клієнта за ім'ям, човном або телефоном. */
function IncomeModal({ open, bookings, onClose, onPick }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);
  if (!open) return null;

  const t = q.trim().toLowerCase();
  const digits = t.replace(/\D/g, '');
  const found = !t ? [] : bookings.filter((b) =>
    (b.client_name || '').toLowerCase().includes(t)
    || (b.boat_name || '').toLowerCase().includes(t)
    || (digits.length >= 3 && (b.phone || '').replace(/\D/g, '').includes(digits)));

  return (
    <div className="veil" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2>Новий прихід</h2>
            <div className="sub">оплата за стоянку</div>
          </div>
          <button className="btn sm" onClick={onClose}>×</button>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="lbl">Ім&apos;я, човен або телефон</div>
          <input className="field" value={q} autoFocus onChange={(e) => setQ(e.target.value)}
                 placeholder="Коваль або 067…" />
        </div>
        <div style={{ marginTop: 12 }}>
          {t && found.length === 0 && <div className="note">Нікого не знайдено.</div>}
          {found.map((b) => (
            <div className="row-card" key={b.id} onClick={() => onPick(b)}>
              <div className={'bchip' + (b.debt_kop ? ' debt' : '')}>{b.slot_name}</div>
              <div className="body">
                <div className="n">{b.client_name}</div>
                <div className="m">{b.boat_name || 'човен'} · {b.phone || 'без телефону'}</div>
              </div>
              <div className={'v ' + (b.debt_kop ? 'debt' : 'ok')}>
                {b.debt_kop ? money(b.debt_kop) : '✓'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpenseModal({ open, onClose, onSave, busy }) {
  const [uah, setUah] = useState('');
  const [what, setWhat] = useState('');
  const [how, setHow] = useState('cash');
  useEffect(() => { if (open) { setUah(''); setWhat(''); setHow('cash'); } }, [open]);
  if (!open) return null;

  const kop = Math.round((parseFloat(String(uah).replace(/\s/g, '').replace(',', '.')) || 0) * 100);
  return (
    <div className="veil" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}><h2>Нова витрата</h2></div>
          <button className="btn sm" onClick={onClose}>×</button>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="lbl">Сума, грн</div>
          <input className="field" value={uah} inputMode="decimal" autoFocus
                 onChange={(e) => setUah(e.target.value)} placeholder="450" />
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="lbl">На що</div>
          <input className="field" value={what} onChange={(e) => setWhat(e.target.value)}
                 placeholder="пальне" />
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="lbl">Чим платили</div>
          <div className="two">
            <button className={'btn' + (how === 'cash' ? ' blue' : '')} onClick={() => setHow('cash')}>Готівкою</button>
            <button className={'btn' + (how === 'bank' ? ' blue' : '')} onClick={() => setHow('bank')}>Карткою / переказом</button>
          </div>
        </div>
        <button className="btn solid" style={{ width: '100%', marginTop: 16 }}
                disabled={busy || kop <= 0 || !what.trim()}
                onClick={() => onSave({ amountKop: kop, what: what.trim(), how })}>
          Записати {kop > 0 ? money(kop) : ''}
        </button>
      </div>
    </div>
  );
}

/* ── головний екран ───────────────────────────────────────────────────── */
export default function Page() {
  const [st, setSt] = useState(null);      // що налаштовано
  const [authed, setAuthed] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('cal');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [open, setOpen] = useState(null);      // бронь у вікні
  const [newAt, setNewAt] = useState(null);    // { slot, monthKey }
  const [payFor, setPayFor] = useState(null); // бронь, якій вносимо оплату
  const [editFor, setEditFor] = useState(null); // бронь, яку правимо
  const [kassa, setKassa] = useState(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const now = new Date();
  const nowKey = now.getFullYear() * 12 + now.getMonth();
  const [winStart, setWinStart] = useState(nowKey - 2);

  const say = (t) => { setToast(t); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    const r = await fetch('/api/data');
    if (r.status === 401) { setAuthed(false); return; }
    setAuthed(true);
    setData(await r.json());
    // Каса — окремим запитом: календарю вона не потрібна, і збій каси
    // не має ховати календар.
    const k = await fetch('/api/kassa').catch(() => null);
    if (k && k.ok) setKassa(await k.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (what, body, method = "POST") => {
    setBusy(true);
    const r = await fetch("/api/" + what, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { say(j.error || 'Не вдалось'); return; }

    if (what === "payment") {
      say(j.debtKop > 0
        ? `Внесено ${money(j.amountKop)} · лишився борг ${money(j.debtKop)}`
        : `Внесено ${money(j.amountKop)} · борг закрито`);
    }
    if (what === 'invoice') {
      say(j.sentToTelegram
        ? `Рахунок на ${money(j.totalKop)} надіслано в Telegram`
        : 'Рахунок збережено. ' + (j.note || ''));
    }
    if (what === 'booking') say('Стоянку додано');
    if (what === 'expense') say(`Витрату ${money(j.amountKop)} записано`);
    if (method === 'DELETE' && (what.startsWith('payment') || what.startsWith('expense'))) say('Запис видалено');
    if (what === 'tg-setup') say(j.staff ? 'Бота під\'єднано' : 'Бота під\'єднано. Додайте SKIPPER_STAFF_IDS, щоб він приймав витрати');
    if (what.startsWith("seed")) {
      say(method === "DELETE"
        ? `Прибрано тестових клієнтів: ${j.removed}`
        : `Готово: ${j.slots} місць, ${j.bookingsAdded} тестових броней`);
    }

    setOpen(null); setNewAt(null); setPayFor(null); setEditFor(null);
    setIncomeOpen(false); setExpenseOpen(false);
    await load();
  };

  if (st && (!st.db || !st.password)) return <Setup st={st} />;
  if (authed === null) return <div className="center"><div className="sub">Завантажуємо…</div></div>;
  if (authed === false) return <Login onIn={load} />;
  if (!data) return <div className="center"><div className="sub">Завантажуємо…</div></div>;

  const { slots, bookings } = data;
  const debtors = bookings.filter((b) => b.debt_kop > 0);
  const paid = bookings.filter((b) => !b.debt_kop);
  const debtSum = debtors.reduce((s, b) => s + b.debt_kop, 0);
  const monthSum = paid.reduce((s, b) => s + (b.fee_kop || 0), 0);
  const freeSlots = slots.length - new Set(bookings.map((b) => b.slot_id)).size;

  return (
    <div className="wrap">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive"
              onReady={initTelegram} />
      <div className="top">
        <div className="logo"><Anchor /></div>
        <div>
          <h1>Skipper · CRM</h1>
          <div className="sub">човнова станція · {MONTHS_NOM[now.getMonth()].toLowerCase()} {now.getFullYear()}</div>
        </div>
        <div className="spacer" />
        <div className="nav">
          <button className={tab === 'cal' ? 'on' : ''} onClick={() => setTab('cal')}>Календар</button>
          <button className={tab === 'kassa' ? 'on' : ''} onClick={() => setTab('kassa')}>Каса</button>
          <button className={tab === 'dash' ? 'on' : ''} onClick={() => setTab('dash')}>Дашборд</button>
        </div>
      </div>

      {slots.length === 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <b>База порожня.</b>
          <div className="note">
            Натисніть, щоб завести місця станції (8 на воді, 5 на суші, 5 в ангарі)
            і пʼять тестових броней. Тестові клієнти названі «Тест · …», щоб їх
            було легко знайти й прибрати перед справжніми даними.
          </div>
          <button className="btn sand" style={{ marginTop: 12 }} disabled={busy}
                  onClick={() => act('seed', {})}>
            Заповнити місцями й тестовими бронями
          </button>
        </div>
      )}

      {slots.length > 0 && bookings.some((b) => b.client_name.startsWith("Тест · ")) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <b>У базі є тестові дані.</b>
          <div className="note">
            Клієнти з іменем «Тест&nbsp;·&nbsp;…». Прибрати їх можна одним
            натисканням — справжніх записів це не зачепить.
          </div>
          <div className="two" style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy}
                    onClick={() => act("seed", {}, "DELETE")}>
              Прибрати тестові
            </button>
            <button className="btn" disabled={busy}
                    onClick={async () => {
                      if (!confirm("Прибрати ВСІ брони й завести дві показові? Це не відкотити.")) return;
                      await act("seed?all=1", {}, "DELETE");
                      await act("seed", {});
                    }}>
              Прибрати всі й завести дві
            </button>
          </div>
        </div>
      )}

      {tab === "cal" && slots.length > 0 && (
        <MobileMonth slots={slots} bookings={bookings} nowKey={nowKey}
                     onBooking={setOpen}
                     onFree={(slot, monthKey) => setNewAt({ slot, monthKey })} />
      )}
      {tab === "cal" && slots.length > 0 && (
        <Calendar slots={slots} bookings={bookings} winStart={winStart}
                  setWinStart={setWinStart} nowKey={nowKey}
                  onBooking={setOpen}
                  onFree={(slot, monthKey) => setNewAt({ slot, monthKey })} />
      )}

      {tab === 'kassa' && (
        <Kassa kassa={kassa} nowKey={nowKey} busy={busy} act={act}
               onIncome={() => setIncomeOpen(true)}
               onExpense={() => setExpenseOpen(true)} />
      )}

      {tab === 'dash' && (
        <div>
          <div className="kpi">
            <div className="k"><div className="l">Не оплатили</div><div className="v debt">{debtors.length}</div></div>
            <div className="k"><div className="l">Оплатили</div><div className="v ok">{paid.length}</div></div>
            <div className="k"><div className="l">Борг усього</div><div className="v debt">{money(debtSum)}</div></div>
            <div className="k"><div className="l">Місяць</div><div className="v ok">{money(monthSum)}</div></div>
            <div className="k"><div className="l">Вільних місць</div><div className="v">{freeSlots}</div></div>
          </div>

          <div className="sect">Треба виставити рахунок</div>
          {debtors.length === 0 && <div className="note">Боржників немає.</div>}
          {debtors.map((b) => (
            <div className="row-card" key={b.id} onClick={() => setOpen(b)}>
              <div className="bchip debt">{b.slot_name}</div>
              <div className="body">
                <div className="n">{b.client_name}</div>
                <div className="m">{b.boat_name || 'човен'} · оплачено по{' '}
                  {b.paid_until ? keyToLabel(mKey(b.paid_until)).toLowerCase() : '—'}</div>
              </div>
              <div className="v debt">{money(b.debt_kop)}</div>
            </div>
          ))}

          <div className="note">
            Суми рахуються з тарифів і місяців, а не вписані руками — тому
            дашборд не може розійтися з календарем.
          </div>
        </div>
      )}

      <BookingModal b={open} onClose={() => setOpen(null)} act={act} busy={busy}
                    onPay={(bk) => { setOpen(null); setPayFor(bk); }}
                    onEdit={(bk) => { setOpen(null); setEditFor(bk); }} />
      <EditModal b={editFor} slots={slots} bookings={bookings} busy={busy}
                 onClose={() => setEditFor(null)}
                 onSave={(body) => act("booking", body, "PATCH")}
                 onDelete={(id) => act("booking?id=" + id, {}, "DELETE")} />
      <PayModal b={payFor} onClose={() => setPayFor(null)} busy={busy}
                onSave={(body) => act("payment", body)} />
      <NewModal slot={newAt?.slot} monthKey={newAt?.monthKey}
                onClose={() => setNewAt(null)} busy={busy}
                onSave={(body) => act('booking', body)} />

      <IncomeModal open={incomeOpen} bookings={bookings}
                   onClose={() => setIncomeOpen(false)}
                   onPick={(bk) => { setIncomeOpen(false); setPayFor(bk); }} />
      <ExpenseModal open={expenseOpen} busy={busy} onClose={() => setExpenseOpen(false)}
                    onSave={(body) => act('expense', body)} />

      <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
    </div>
  );
}
