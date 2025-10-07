import { json, requireSession, mskDateStr } from '../_util.js';

export async function onRequestPost({ request, env }) {
  const body = await json(request);
  const { token, actor='' } = body;

  const sess = await requireSession(env, token);
  if (!sess || (sess.role||'') !== 'admin') return new Response('FORBIDDEN', { status:403 });

  const now = new Date();
  const nowIso = now.toISOString();
  const dateStr = mskDateStr(now);

  const { results } = await env.DB.prepare('SELECT * FROM operators').all();
  for (const r of (results||[])) {
    if (r.statusSince) {
      const passedSec = Math.max(0, Math.floor((Date.now() - new Date(r.statusSince).getTime())/1000));
      const k = {
        'Чаты':'totalLine','Звонки':'totalLine','Обучение':'totalLine','Хочу в перерыв':'totalLine',
        'Перерыв':'totalBreak','Перерыв на звонках':'totalBreak',
        'Ожидание':'totalWait','Ожидание Обед':'totalWait','Обед':'totalLunch'
      }[r.status] || null;
      if (k) {
        const newTotal = (r[k]||0) + passedSec;
        await env.DB.prepare(`UPDATE operators SET ${k}=? WHERE id=?`).bind(newTotal, r.id).run();
        r[k] = newTotal;
      }
    }

    await env.DB.prepare(
      'INSERT INTO dailyReports(date,operatorId,name,teamlead,totalLine,totalBreak,totalWait,totalLunch) VALUES(?,?,?,?,?,?,?,?)'
    ).bind(dateStr, r.id, r.name||'', r.teamlead||'', r.totalLine||0, r.totalBreak||0, r.totalWait||0, r.totalLunch||0).run();

    await env.DB.prepare(
      'UPDATE operators SET status=?, statusSince=?, shiftStart="", totalLine=0,totalWant=0,totalBreak=0,totalWait=0,totalLunch=0 WHERE id=?'
    ).bind('Выходной', nowIso, r.id).run();
  }

  await env.DB.prepare('INSERT INTO logs(ts,actor,operatorId,fromStatus,toStatus,note) VALUES(?,?,?,?,?,?)')
    .bind(nowIso, actor||'system', '*', '-', 'Manual Close Day', 'snapshot to dailyReports & reset totals').run();

  return Response.json({ ok:true });
}
