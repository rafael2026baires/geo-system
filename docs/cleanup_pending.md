# Pendientes preservados del cierre técnico

Estos componentes tienen valor funcional o técnico conocido y no son residuos.

## Cancelación de órdenes

`public/api/operations/orders/order_cancel.php` depende de una implementación ausente de `OperStateService`. El contrato observado es:

- constructor `OperStateService($pdo)`;
- método `actualizar_estado($tenantId, $vehicleId, $tripId, $estadoOperativo)`.

No debe inventarse una implementación sin definir antes el comportamiento operativo esperado.

## Móvil

Se preservan `movil/emisor_datos.html` y `movil/estados_operativos.html`. Quedan pendientes los endpoints de transición `activate_unit.php`, `deactivate_unit.php`, `load_confirmed.php`, `dispatch_trip.php`, `delivery_completed.php` y `checkin_depot.php`.

## Replay

Se preserva `public/js/replay/`. Faltan `public/js/common/state.engine.js` y el endpoint `web/trayecto.php`.

## OBD

El módulo `public/js/grid_obd/` está suspendido y preservado para una etapa futura.

## Editor de tema

`public/js/dashboard/dashboard.theme.editor.js` es una herramienta futura preservada; su carga permanece inactiva en el HTML.

## Endpoints técnicos

Los endpoints `_test.php` se preservan como interfaz técnica temporal hasta disponer del frontend productivo. Su ejecución web queda limitada al entorno local mediante `config/technical_access.php`.
