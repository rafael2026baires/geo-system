export function renderKPIs(kpi) {
  
    if (!kpi) return;

    const v = kpi.vehicles || {};
    const o = kpi.orders || {};

    setText('kpi-veh-activos-main', `${v.active || 0} / ${v.total || 0}`);
    setText('kpi-veh-base-main', v.in_base || 0);
    setText('kpi-veh-calle-main', v.in_street || 0);
    setText('kpi-veh-cliente-main', v.in_client || 0);

    // ----------------------- SEÑAL  -------------------------------------
    setText('kpi-signal-ok-main', v.signal_ok || 0);
    setText('kpi-signal-nodata-main', v.signal_nodata || 0);  
    setAlertText('kpi-signal-alert-main', v.signal_alert || 0);

    // ----------------------- ACTIVIDAD  ---------------------------------
    setText('kpi-activity-moving-main', v.activity_moving || 0);
    setText('kpi-activity-stopped-main', v.activity_stopped || 0);
    setAlertText('kpi-activity-stopped-alert-main', v.activity_alert || 0);

    setText('kpi-ped-operacion-main', o.in_operation || 0);
    setText('kpi-ped-asignados-main', o.pending_load || 0);
    setText('kpi-ped-carga-main', o.pending_delivery || 0);
    setText('kpi-ped-carga-sub', '');
    setText('kpi-ped-entrega-main', o.delivered || 0);
    setText('kpi-ped-entrega-sub', '');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;

}

function setAlertText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = value;

  if (Number(value) > 0) {
    el.classList.add('kpi-alert-value');
  } else {
    el.classList.remove('kpi-alert-value');
  }
}