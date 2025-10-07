import { json, requireSession } from '../_util.js';

export async function onRequestPost({ request, env }) {
  const body = await json(request);
  const { operatorId, token, dataUrl } = body;

  const sess = await requireSession(env, token);
  if (!sess) return new Response('INVALID_SESSION', { status:401 });

  const id = String(operatorId||'').trim();
  if (!id) return new Response('EMPTY_ID', { status:400 });

  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(String(dataUrl||''))) {
    return new Response('BAD_IMAGE', { status:400 });
  }

  const { results } = await env.DB.prepare('SELECT images FROM operators WHERE id=?').bind(id).all();
  const row = results?.[0];
  if (!row) return new Response('NOT_FOUND', { status:404 });

  const trimmed = JSON.stringify([String(dataUrl)]);
  await env.DB.prepare('UPDATE operators SET images=? WHERE id=?').bind(trimmed, id).run();

  await env.DB.prepare('INSERT INTO logs(ts,actor,operatorId,fromStatus,toStatus,note) VALUES(?,?,?,?,?,?)')
    .bind(new Date().toISOString(), (sess.displayName||sess.operatorId), id, '-', 'SetImage', 'avatar replaced').run();

  return Response.json({ ok:true });
}
