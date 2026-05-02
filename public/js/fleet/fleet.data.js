export async function loadFleetFromDB(tenantId) {
  const res = await fetch(`/api/catalogs/vehicles/list_active_vehicles.php?tenantId=${tenantId}`);
  const json = await res.json();
  window.fleetBackend = json.data;
}