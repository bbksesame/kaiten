import { json, requireSession } from '../_util.js';

// GET /api/breakMode — просто вернуть текущий режим (опционально, но пусть будет)
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare('SELECT value FROM settings WHERE key=?')
      .bind('breakMode')
      .all();

    const row = results && results[0];
    const mode = (row && row.value === 'double') ? 'double' : 'single';

    return Response.json({ mode });
  } catch (e) {
    return new Response('ERROR', { status: 500 });
  }
}

// POST /api/breakMode — сменить режим
export async function onRequestPost({ request, env }) {
  const body  = await json(request);
  const mode  = body?.mode;
  const token = body?.token || '';

  // Нажимать могут все залогиненные
  const sess = await requireSession(env, token);
  if (!sess) {
    return new Response('INVALID_SESSION', { status: 401 });
  }

  const normalized = mode === 'double' ? 'double' : 'single';

  try {
    await env.DB.prepare(
      'INSERT INTO settings(key,value) VALUES(?,?) ' +
      'ON CONFLICT(key) DO UPDATE SET value=excluded.value'
    )
      .bind('breakMode', normalized)
      .run();

    return Response.json({ ok: true, mode: normalized });
  } catch (e) {
    return new Response('ERROR', { status: 500 });
  }
}

