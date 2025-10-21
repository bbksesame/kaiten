export default {
  async scheduled(event, env, ctx) {
    console.log('Current worker time:', new Date().toString());
    try {
      // ---- час и дата "как есть" (в TZ аккаунта). Нам не нужно пересчитывать: триггеры приходят ровно в :58
      const now = new Date();
      const today = ymd(now);                // 'YYYY-MM-DD'
      const hhmm  = hhmmStr(now);            // 'HH:MM'

      // 1) Берём всех, кто не "Выходной", у кого есть авто-время и не закрывались сегодня
      const { results: ops } = await env.DB.prepare(`
        SELECT
          id, name, status, statusSince, shiftStart,
          totalLine, totalBreak, totalWait, totalLunch,
          autoCloseAt, lastAutoCloseDate
        FROM operators
        WHERE status != 'Выходной'
          AND autoCloseAt IS NOT NULL
          AND autoCloseAt <> ''
          AND (lastAutoCloseDate IS NULL OR lastAutoCloseDate <> ?)
      `).bind(today).all();

      if (!ops?.length) return;

      // 2) Оставляем тех, чей autoCloseAt <= текущее время слота (напр. '19:58')
      const due = ops.filter(o => (o.autoCloseAt <= hhmm));
      if (!due.length) return;

      for (const o of due) {
        // Досчитать текущий статус до "сейчас"
        const addedSec = calcDeltaSec(o.status, o.statusSince, now);
        const totals = {
          line:  Number(o.totalLine  || 0),
          brk:   Number(o.totalBreak || 0),
          wait:  Number(o.totalWait  || 0),
          lunch: Number(o.totalLunch || 0),
        };
        addToTotals(totals, o.status, addedSec);

        // Лог перехода
        await env.DB.prepare(`
          INSERT INTO logs (operatorId, fromStatus, toStatus, timestamp, actor, note)
          VALUES (?, ?, 'Выходной', ?, 'system/cron', 'auto close shift')
        `).bind(o.id, o.status, now.toISOString()).run();

        // Срез дня (если используешь dailyReports)
        await env.DB.prepare(`
          INSERT INTO dailyReports (date, operatorId, totalLine, totalBreak, totalWait, totalLunch, closedBy)
          VALUES (?, ?, ?, ?, ?, ?, 'system')
          ON CONFLICT(date, operatorId) DO UPDATE SET
            totalLine  = excluded.totalLine,
            totalBreak = excluded.totalBreak,
            totalWait  = excluded.totalWait,
            totalLunch = excluded.totalLunch,
            closedBy   = 'system'
        `).bind(today, o.id, totals.line, totals.brk, totals.wait, totals.lunch).run();

        // Переводим в "Выходной", сбрасываем смену и итоги, помечаем датой автозакрытия
        await env.DB.prepare(`
          UPDATE operators
          SET status='Выходной',
              statusSince=NULL,
              shiftStart=NULL,
              totalLine=0, totalBreak=0, totalWait=0, totalLunch=0,
              lastAutoCloseDate=?
          WHERE id=?
        `).bind(today, o.id).run();
      }

      // 3) Обновляем KV-снимок доски (если используешь его для /api/board/SSE)
      try {
        if (env.BOARD_KV) {
          const board = await buildBoard(env);
          await env.BOARD_KV.put('board:snapshot', JSON.stringify(board));
          await env.BOARD_KV.put('board:version', String(Date.now()));
        }
      } catch (e) {
        console.warn('KV snapshot refresh failed', e);
      }
    } catch (e) {
      console.error('cron error', e);
    }
  }
};

/* ===== helpers ===== */
function pad(n){ return (n<10 ? '0' : '') + n; }
function ymd(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function hhmmStr(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function calcDeltaSec(status, sinceIso, now){
  if (!sinceIso || status === 'Выходной') return 0;
  const t = new Date(sinceIso).getTime();
  return Math.max(0, Math.floor((now.getTime() - t)/1000));
}
function addToTotals(t, status, sec){
  if (!sec) return;
  switch (status) {
    case 'Чаты':
    case 'Хочу в перерыв':
    case 'Звонки':
    case 'Обучение':
      t.line += sec; break;
    case 'Перерыв':
    case 'Перерыв на звонках':
      t.brk  += sec; break;
    case 'Ожидание':
    case 'Ожидание Обед':
      t.wait += sec; break;
    case 'Обед':
      t.lunch += sec; break;
  }
}

// Простейшая сборка доски из D1 (подогнай поля под твою схему, если отличаются)
async function buildBoard(env){
  const statuses = ['Чаты','Звонки','Обучение','Ожидание','Хочу в перерыв','Перерыв','Перерыв на звонках','Обед','Выходной'];
  const { results: rows } = await env.DB.prepare(`
    SELECT id, name, role, teamlead, shift, workHours, status, statusSince, shiftStart,
           totalLine, totalBreak, totalWait, totalLunch, images
    FROM operators
  `).all();

  return {
    statuses,
    cards: (rows||[]).map(c => ({
      id: String(c.id),
      name: c.name,
      role: c.role,
      teamlead: c.teamlead,
      shift: c.shift,
      workHours: c.workHours,
      status: c.status,
      statusSince: c.statusSince,
      shiftStart: c.shiftStart,
      totals: {
        totalLine:  Number(c.totalLine||0),
        totalBreak: Number(c.totalBreak||0),
        totalWait:  Number(c.totalWait||0),
        totalLunch: Number(c.totalLunch||0),
      },
      images: safeParseArr(c.images)
    })),
    serverNowIso: new Date().toISOString()
  };
}
function safeParseArr(v){
  try {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
