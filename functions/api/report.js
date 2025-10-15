// functions/api/report.js
// Cloudflare Pages Function — отчёты по периодам
// Ожидаем D1-базу в env.DB (резерв: env.DB_MAIN)

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

// ——— helpers ———
function toYYYYMMDD(d) {
  // принимает Date | string-ISO | YYYY-MM-DD
  if (d instanceof Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  if (typeof d === 'string') {
    // уже YYYY-MM-DD?
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime())) return toYYYYMMDD(dt);
  }
  return null;
}

function badRequest(msg, extra = {}) {
  return new Response(JSON.stringify({ ok: false, error: msg, ...extra }), {
    status: 400,
    headers: JSON_HEADERS,
  });
}

function serverError(msg, extra = {}) {
  return new Response(JSON.stringify({ ok: false, error: msg, ...extra }), {
    status: 500,
    headers: JSON_HEADERS,
  });
}

// ——— main ———
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    // поддерживаем оба формата параметров
    const fromRaw = url.searchParams.get('from') ?? url.searchParams.get('fromIso');
    const toRaw   = url.searchParams.get('to')   ?? url.searchParams.get('toIso');
    const operatorId = (url.searchParams.get('operatorId') || '').trim();
    const teamlead   = (url.searchParams.get('teamlead') || '').trim();

    // нормализуем даты к YYYY-MM-DD
    const from = toYYYYMMDD(fromRaw);
    const to   = toYYYYMMDD(toRaw);

    if (!from || !to) {
      return badRequest('Invalid or missing date range. Expect from/to as YYYY-MM-DD (or fromIso/toIso).', {
        got: { from: fromRaw, to: toRaw },
      });
    }

    // безопасность: убедимся, что from <= to
    if (from > to) {
      return badRequest('`from` must be earlier or equal to `to`.', { from, to });
    }

    const DB = env.DB || env.DB_MAIN;
    if (!DB || typeof DB.prepare !== 'function') {
      return serverError('D1 database binding not found. Please bind env.DB to your D1 instance.');
    }

    // Строим SQL динамически (только нужные фильтры)
    // Предполагаем таблицу dailyReports с колонками:
    // date TEXT(YYYY-MM-DD), operatorId TEXT, name TEXT, teamlead TEXT,
    // totalLine INTEGER, totalBreak INTEGER, totalWait INTEGER, totalLunch INTEGER
    const where = ['date BETWEEN ? AND ?'];
    const binds = [from, to];

    if (operatorId) {
      where.push('operatorId = ?');
      binds.push(operatorId);
    }
    if (teamlead) {
      where.push('teamlead = ?');
      binds.push(teamlead);
    }

    // Группируем по оператору (id, name, teamlead), суммируем поля
    const sql = `
      SELECT
        operatorId,
        COALESCE(name, operatorId) AS name,
        COALESCE(teamlead, '')     AS teamlead,
        SUM(COALESCE(totalLine,  0)) AS totalLine,
        SUM(COALESCE(totalBreak, 0)) AS totalBreak,
        SUM(COALESCE(totalWait,  0)) AS totalWait,
        SUM(COALESCE(totalLunch, 0)) AS totalLunch
      FROM dailyReports
      WHERE ${where.join(' AND ')}
      GROUP BY operatorId, name, teamlead
      ORDER BY name COLLATE NOCASE ASC
    `;

    const stmt = DB.prepare(sql);
    const rows = (await stmt.bind(...binds).all()).results ?? [];

    return new Response(JSON.stringify({ ok: true, rows, from, to, filters: { operatorId, teamlead } }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    // Никогда не отдаём HTML-страницу CF — только JSON
    const message = (err && err.message) ? String(err.message) : 'Unhandled error';
    return serverError('Report worker failed', { message });
  }
}
