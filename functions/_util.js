export const STATUSES = [
  'Чаты','Звонки','Хочу в перерыв','Ожидание','Ожидание Обед',
  'Перерыв','Перерыв на звонках','Обед','Обучение','Выходной'
];

export const TOTAL_KEYS = {
  'Чаты': 'totalLine',
  'Звонки': 'totalLine',
  'Обучение': 'totalLine',
  'Хочу в перерыв': 'totalLine',
  'Перерыв': 'totalBreak',
  'Перерыв на звонках': 'totalBreak',
  'Ожидание': 'totalWait',
  'Ожидание Обед': 'totalWait',
  'Обед': 'totalLunch',
};

export const TOTAL_COLUMNS = [
  'totalLine',
  'totalWant',
  'totalBreak',
  'totalWait',
  'totalLunch'
];

/** Текущее время в ISO */
export const nowIso = () => new Date().toISOString();

/** Грубая "московская" дата YYYY-MM-DD (UTC+3) */
export const mskDateStr = (d = new Date()) => {
  const ms = d.getTime() + 3 * 3600 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
};

/** Безопасный парс JSON тела запроса */
export async function json(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Проверка сессии по токену */
export async function requireSession(env, token) {
  if (!token) return null;

  const { results } = await env.DB
    .prepare('SELECT token,operatorId,role,displayName,expiresIso FROM sessions WHERE token=?')
    .bind(token)
    .all();

  const s = results?.[0];
  if (!s) return null;

  if (s.expiresIso && new Date(s.expiresIso).getTime() < Date.now()) {
    return null;
  }

  return s;
}
