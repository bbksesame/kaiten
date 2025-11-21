import { STATUSES } from '../_util.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM operators').all();

  const cards = (results||[]).map(r => ({
    id: r.id,
    name: r.name,
    teamlead: r.teamlead || '',
    role: r.role || '',
    status: r.status || STATUSES[0],
    statusSince: r.statusSince || '',
    note: r.note || '',
    totals: {
      totalLine:  r.totalLine  || 0,
      totalWant:  r.totalWant  || 0,
      totalBreak: r.totalBreak || 0,
      totalWait:  r.totalWait  || 0,
      totalLunch: r.totalLunch || 0,
    },
    shiftStart: r.shiftStart || '',
    shift: r.shift || '',
    workHours: r.workHours || '',
    images: (() => { try { return JSON.parse(r.images || '[]'); } catch { return []; } })()
  }));

  // читаем глобальный режим перерыва из таблицы settings
  let breakMode = 'single';
  try {
    const { results: settingsRows } = await env.DB
      .prepare('SELECT value FROM settings WHERE key=?')
      .bind('breakMode')
      .all();

    const row = settingsRows && settingsRows[0];
    if (row && row.value === 'double') {
      breakMode = 'double';
    }
  } catch (e) {
    // если таблицы ещё нет или другая ошибка — просто оставляем single
  }

  return Response.json({
    statuses: STATUSES,
    cards,
    serverNowIso: new Date().toISOString(),
    breakMode
  });
}
