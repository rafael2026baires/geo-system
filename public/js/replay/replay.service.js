export async function loadReplayData({
  tenantId,
  unitId,
  from,
  to
}) {
  const url = `
    /apps/geo-system/web/trayecto.php
    ?tenantId=${tenantId}
    &unitId=${unitId}
    &from=${encodeURIComponent(from)}
    &to=${encodeURIComponent(to)}
  `.replace(/\s+/g, '');

  const res = await fetch(url);
  const json = await res.json();

  return json.points.map(p => ({
    lat: parseFloat(p.lat),
    lng: parseFloat(p.lng),
    ts: new Date(p.server_ts).getTime()
  }));
}
