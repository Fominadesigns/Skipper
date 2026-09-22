'use client';

import { useEffect, useState, useCallback } from 'react';
import Script from 'next/script';

/* ══════════════════════════════════════════════════════════════════════
   Клієнтський міні-додаток Skipper. Відкривається лише з бота в Telegram:
   сервер довіряє тільки підписаним Telegram даним (initData), тож
   у звичайному браузері тут нічого не показується.

   Три вкладки, як у прототипі: човен, рахунок, вільні місця.
   «Причал» і «Чат» із прототипу — пізніше: для них потрібні справжні
   код шлагбаума, маршрут і людина, що відповідає в чаті.
   ══════════════════════════════════════════════════════════════════ */

const MONTHS_SHORT = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];
const MONTHS_GEN = ['січня','лютого','березня','квітня','травня','червня',
                    'липня','серпня','вересня','жовтня','листопада','грудня'];
const MONTHS_NOM = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                    'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const KIND = { water: 'на воді', land: 'на суші', hangar: 'в ангарі' };
const money = (kop) => Math.round(kop / 100).toLocaleString('uk-UA').replace(/ /g, ' ') + ' ₴';
const mKey = (d) => { const x = new Date(d); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
const label = (k) => MONTHS_NOM[k % 12] + ' ' + Math.floor(k / 12);
const places = (n) => { const t = n % 10, h = n % 100;
  return t === 1 && h !== 11 ? 'місце' : t >= 2 && t <= 4 && (h < 12 || h > 14) ? 'місця' : 'місць'; };

function tg() { return typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp; }

/* ── вкладка «Мій човен» ──────────────────────────────────────────────── */
function Boat({ b, nowKey, onBill }) {
  const covered = b.covered_through ? mKey(b.covered_through) : -Infinity;
  const from = mKey(b.starts_on), to = b.ends_on ? mKey(b.ends_on) : Infinity;
  const months = [nowKey, nowKey + 1, nowKey + 2];
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="bchip">{b.slot_name}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{b.boat_name || 'Ваш човен'}</div>
            <div className="sub">місце {b.slot_name}, {KIND[b.slot_kind] || b.slot_kind}</div>
          </div>
        </div>
        <div className="mcells">
          {months.map((k) => {
            const inside = k >= from && k <= to;
            const cls = !inside ? 'free' : k > covered ? 'on debt' : 'on';
            return <div key={k} className={'mcell ' + cls + (k === nowKey ? ' now' : '')}>{MONTHS_SHORT[k % 12]}</div>;
          })}
        </div>
        <div className="rows" style={{ marginTop: 14 }}>
          <div className="row"><span className="k">Тариф</span><span className="v">{b.fee_kop ? money(b.fee_kop) + ' / міс' : 'уточнити'}</span></div>
          <div className="row"><span className="k">Оплачено по</span>
            <span className="v">{b.covered_through ? label(covered).toLowerCase() : 'ще не оплачено'}</span></div>
          {b.ends_on && <div className="row"><span className="k">Стоянка по</span><span className="v">{label(to).toLowerCase()}</span></div>}
        </div>
      </div>
      {b.debt_kop > 0 && (
        <div className="due" onClick={onBill}>
          <div>
            <div className="due-l">До&nbsp;оплати</div>
            <div className="due-v">{money(b.debt_kop)}</div>
          </div>
          <div className="due-go">Оплатити&nbsp;→</div>
        </div>
      )}
    </div>
  );
}

/* ── вкладка «Рахунок» ────────────────────────────────────────────────── */
/* Посилання НБУ відкриваємо через Telegram: звичайне посилання відкрилось би
   у вбудованому вікні, звідки в банк не перейти (так само в Butler). */
function openPay(url) {
  if (!url) return;
  const w = tg();
  if (w && w.openLink) w.openLink(url); else window.open(url, '_blank', 'noopener');
}
async function copyIban(iban) {
  try { await navigator.clipboard.writeText(iban); tg()?.showAlert?.('IBAN скопійовано'); }
  catch { tg()?.showAlert?.('Не вдалося скопіювати — номер на екрані, його можна переписати'); }
}

function Bill({ bookings, payee, busy, onPaid }) {
  const owing = bookings.filter((b) => b.debt_kop > 0);
  if (!owing.length) {
    return <div className="note" style={{ fontSize: 15 }}>Боргу немає — усе оплачено. Дякуємо!</div>;
  }
  return owing.map((b) => (
    <div key={b.id} style={{ marginBottom: 18 }}>
      <div className="card">
        <div className="sub" style={{ marginBottom: 10 }}>{b.boat_name || 'Ваш човен'} · місце {b.slot_name}</div>
        <div className="rows">
          {b.unpaid.map((m) => (
            <div className="row" key={m}>
              <span className="k">Стоянка, {MONTHS_NOM[new Date(m).getUTCMonth()].toLowerCase()}</span>
              <span className="v">{money(b.fee_kop)}</span>
            </div>
          ))}
        </div>
        <div className="bill-sum"><span>До&nbsp;оплати</span><span>{money(b.debt_kop)}</span></div>
      </div>

      {b.qrSvg && <>
        <div className="sect">Як оплатити</div>
        <div className="card" style={{ textAlign: 'center' }}>
          {/* Той самий QR, що в Butler: посилання НБУ з реквізитами й сумою. */}
          <button className="qr-frame" aria-label="Відкрити застосунок банку"
                  onClick={() => openPay(b.payUrl)}
                  dangerouslySetInnerHTML={{ __html: b.qrSvg }} />
          <p className="qr-cap">
            Натисніть код — відкриється ваш банк.<br />
            З&nbsp;іншого телефона його можна відсканувати камерою.<br />
            <b>Сума вже вписана всередині</b>
          </p>
          <button className="btn solid" style={{ width: '100%', marginTop: 12 }}
                  onClick={() => openPay(b.payUrl)}>
            Оплатити в&nbsp;застосунку банку
          </button>
        </div>
      </>}

      {payee ? <>
        <div className="sect">Або переказом за&nbsp;реквізитами</div>
        <div className="card">
          <div className="rows">
            <div className="row"><span className="k">Отримувач</span><span className="v">{payee.name}</span></div>
            <div className="row"><span className="k">IBAN</span><span className="v mono" style={{ wordBreak: 'break-all' }}>{payee.iban}</span></div>
            <div className="row"><span className="k">ІПН</span><span className="v mono">{payee.taxId}</span></div>
            <div className="row"><span className="k">Сума</span><span className="v">{money(b.debt_kop)}</span></div>
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => copyIban(payee.iban)}>
            Скопіювати IBAN
          </button>
        </div>
      </> : <div className="note">Реквізити для оплати надішле станція.</div>}

      <button className="btn solid" style={{ width: '100%', marginTop: 14 }} disabled={busy}
              onClick={() => onPaid(b)}>
        Я&nbsp;оплатив
      </button>
      <div className="note">
        Це повідомлення для станції, а&nbsp;не&nbsp;списання коштів. Ми звіримо
        надходження з&nbsp;банком і&nbsp;підтвердимо.
      </div>
    </div>
  ));
}

/* ── вкладка «Вільні місця» ───────────────────────────────────────────── */
function Free({ free, busy, onAsk }) {
  const keys = Object.keys(free || {}).slice(0, 6);
  const [kind, setKind] = useState('water');
  return (
    <>
      <div className="two" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
        {[['water', 'На воді'], ['land', 'На суші'], ['hangar', 'Ангар']].map(([k, l]) => (
          <button key={k} className={'btn sm' + (kind === k ? ' blue' : '')} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      {keys.map((key) => {
        const [y, m] = key.split('-').map(Number);
        const n = free[key][kind]?.free || 0;
        return (
          <div className="mslot" key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={'bchip' + (n ? '' : ' free')}>{MONTHS_SHORT[m - 1]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{MONTHS_NOM[m - 1]} {y}</div>
              <div className="sub">{n ? `${n} ${places(n)} вільно` : 'вільних немає'}</div>
            </div>
            {n > 0 && <button className="btn sm solid" disabled={busy} onClick={() => onAsk(kind, key)}>Хочу</button>}
          </div>
        );
      })}
      <div className="note">
        «Хочу» — це заявка, а&nbsp;не&nbsp;бронь. Станція передзвонить і&nbsp;підтвердить місце.
      </div>
    </>
  );
}

export default function Client() {
  const [state, setState] = useState('loading');   // loading | outside | ok | error
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('boat');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const say = (t) => { setToast(t); setTimeout(() => setToast(''), 3000); };

  const now = new Date();
  const nowKey = now.getFullYear() * 12 + now.getMonth();

  const call = useCallback(async (path, body) => {
    const r = await fetch('/api/client/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-tg-init-data': tg()?.initData || '', 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Не вдалося');
    return j;
  }, []);

  const load = useCallback(async () => {
    const w = tg();
    if (!w || !w.initData) { setState('outside'); return; }
    try {
      w.ready(); w.expand();
      w.disableVerticalSwipes?.();
      w.setHeaderColor?.('#141d42'); w.setBackgroundColor?.('#141d42');
    } catch { /* стара версія Telegram */ }
    try { setData(await call('me')); setState('ok'); }
    catch { setState('error'); }
  }, [call]);

  const onPaid = async (b) => {
    setBusy(true);
    try { await call('paid', { bookingId: b.id }); say('Дякуємо! Ми звіримо з банком і підтвердимо.'); }
    catch (e) { say(e.message); }
    setBusy(false);
  };
  const onAsk = async (kind, month) => {
    setBusy(true);
    try { await call('request', { kind, month }); say('Заявку надіслано — ми передзвонимо'); }
    catch (e) { say(e.message); }
    setBusy(false);
  };

  const debt = data ? data.bookings.reduce((s, b) => s + (b.debt_kop || 0), 0) : 0;

  return (
    <div className="wrap" style={{ maxWidth: 560 }}>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive"
              onReady={load} onError={() => setState('outside')} />

      {state === 'loading' && <div className="center"><div className="sub">Завантажуємо…</div></div>}
      {state === 'outside' && (
        <div className="center"><div className="card" style={{ maxWidth: 360 }}>
          <b>Відкрийте через бота</b>
          <div className="note">Цей кабінет працює лише всередині Telegram — через кнопку в&nbsp;боті станції.</div>
        </div></div>
      )}
      {state === 'error' && (
        <div className="center"><div className="card" style={{ maxWidth: 360 }}>
          <b>Не вдалося завантажити</b>
          <div className="note">Закрийте й відкрийте ще раз. Якщо не минає — зателефонуйте на станцію.</div>
        </div></div>
      )}

      {state === 'ok' && (
        <>
          <div className="top">
            <div>
              <h1>{tab === 'boat' ? 'Ваш човен' : tab === 'bill' ? 'Рахунок' : 'Вільні місця'}</h1>
              <div className="sub">{data.name ? data.name + ' · ' : ''}Skipper, човнова станція</div>
            </div>
          </div>

          {tab === 'boat' && (data.bookings.length
            ? data.bookings.map((b) => <Boat key={b.id} b={b} nowKey={nowKey} onBill={() => setTab('bill')} />)
            : <div className="note" style={{ fontSize: 15 }}>
                Броні за вашим номером поки немає. Залиште заявку у вкладці «Вільні місця».
              </div>)}
          {tab === 'bill' && <Bill bookings={data.bookings} payee={data.payee} busy={busy} onPaid={onPaid} />}
          {tab === 'free' && <Free free={data.free} busy={busy} onAsk={onAsk} />}

          <div className="nav">
            <button className={tab === 'boat' ? 'on' : ''} onClick={() => setTab('boat')}>Човен</button>
            <button className={tab === 'bill' ? 'on' : ''} onClick={() => setTab('bill')}>
              Рахунок{debt > 0 ? ' •' : ''}</button>
            <button className={tab === 'free' ? 'on' : ''} onClick={() => setTab('free')}>Місця</button>
          </div>
        </>
      )}

      <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
    </div>
  );
}
