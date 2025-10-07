import { json } from '../_util.js';

export async function onRequestPost({ request, env }) {
  const body = await json(request);
  const code = String(body.code||'').trim();
  if (!/^\d{6}$/.test(code)) return new Response('Bad code', { status:400 });

  const { results } = await env.DB.prepare(
    'SELECT code,displayName,operatorId,role FROM accessCodes WHERE code=?'
  ).bind(code).all();
  const row = results?.[0];
  if (!row) return new Response('Bad code', { status:403 });

  const token = crypto.randomUUID();
  const exp = new Date(Date.now() + 24*3600*1000).toISOString();

  await env.DB.prepare(
    'INSERT INTO sessions(token,operatorId,role,displayName,expiresIso) VALUES(?,?,?,?,?)'
  ).bind(token, row.operatorId, row.role||'', row.displayName||'', exp).run();

  return Response.json({ token, operatorId: row.operatorId, role: row.role||'', displayName: row.displayName||'' });
}
