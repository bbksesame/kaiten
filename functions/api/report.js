export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const from = (url.searchParams.get('fromIso')||'0000-01-01').slice(0,10);
  const to   = (url.searchParams.get('toIso')||'9999-12-31').slice(0,10);
  const operatorId = (url.searchParams.get('operatorId')||'').trim();
  const teamlead   = (url.searchParams.get('teamlead')||'').trim();

  let q = 'SELECT * FROM dailyReports WHERE date>=? AND date<=?';
  const bind = [from, to];
  if (operatorId) { q += ' AND operatorId=?'; bind.push(operatorId); }
  if (teamlead)   { q += ' AND teamlead=?';   bind.push(teamlead);   }

  const { results } = await env.DB.prepare(q).bind(...bind).all();

  const acc = {};
  for (const r of (results||[])) {
    const op = r.operatorId;
    if (!acc[op]) acc[op] = { operatorId: op, name: r.name||op, teamlead: r.teamlead||'', totalLine:0,totalBreak:0,totalWait:0,totalLunch:0 };
    acc[op].totalLine  += r.totalLine||0;
    acc[op].totalBreak += r.totalBreak||0;
    acc[op].totalWait  += r.totalWait||0;
    acc[op].totalLunch += r.totalLunch||0;
  }

  const rows = Object.values(acc).sort((a,b)=> String(a.name||'').localeCompare(String(b.name||''),'ру'));
  return Response.json({ rows });
}
