import { json, requireSession, TOTAL_KEYS, mskDateStr } from '../_util.js';

export async function onRequestPost({ request, env }) {
  const body = await json(request);
  const { operatorId, newStatus, token, note='' } = body;

  const sess = await requireSession(env, token);
  if (!sess) return new Response('INVALID_SESSION', { status:401 });
  const isAdmin = (sess.role||'') === 'admin';

  const id = String(operatorId||'').trim();
  if (!id) return new Response('EMPTY_ID', { status:400 });

  const { results } = await env.DB.prepare('SELECT * FROM operators WHERE id=?').bind(id).all();
  const op = results?.[0];
  if (!op) return new Response('NOT_FOUND', { status:404 });

  if (!isAdmin && (sess.operatorId||'').trim() !== id) {
    return new Response('FORBIDDEN', { status:403 });
  }

  const prevStatus = op.status || 'Чаты';
  const prevSince  = op.statusSince ? new Date(op.statusSince) : null;

  if (prevSince && TOTAL_KEYS[prevStatus]) {
    const passedSec = Math.max(0, Math.floor((Date.now() - prevSince.getTime())/1000));
    const totalCol  = TOTAL_KEYS[prevStatus];
    const newTotal  = (op[totalCol]||0) + passedSec;
    await env.DB.prepare(`UPDATE operators SET ${totalCol}=? WHERE id=?`).bind(newTotal, id).run();
    op[totalCol] = newTotal;
  }

  const nowIso = new Date().toISOString();

  if (newStatus === 'Выходной') {
    await env.DB.prepare(
      'INSERT INTO dailyReports(date,operatorId,name,teamlead,totalLine,totalBreak,totalWait,totalLunch) VALUES(?,?,?,?,?,?,?,?)'
    ).bind(
      mskDateStr(new Date()), op.id, op.name||'', op.teamlead||'',
      op.totalLine||0, op.totalBreak||0, op.totalWait||0, op.totalLunch||0
    ).run();

    await env.DB.prepare(
      'UPDATE operators SET totalLine=0,totalWant=0,totalBreak=0,totalWait=0,totalLunch=0,shiftStart="" WHERE id=?'
    ).bind(id).run();
  }

  await env.DB.prepare('UPDATE operators SET status=?, statusSince=?, note=? WHERE id=?')
    .bind(newStatus, nowIso, note, id).run();

  if (newStatus === 'Чаты' && !op.shiftStart) {
    await env.DB.prepare('UPDATE operators SET shiftStart=? WHERE id=?').bind(nowIso, id).run();
  }

  await env.DB.prepare('INSERT INTO logs(ts,actor,operatorId,fromStatus,toStatus,note) VALUES(?,?,?,?,?,?)')
    .bind(nowIso, (sess.displayName || sess.operatorId), id, prevStatus, newStatus, note).run();

  return Response.json({ ok: true });
}
