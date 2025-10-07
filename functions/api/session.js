import { requireSession } from '../_util.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const sess = await requireSession(env, token);
  return Response.json(sess);
}
