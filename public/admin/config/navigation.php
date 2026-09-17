<?php
declare(strict_types=1);

// Única definición de módulos, rutas, archivos y permisos de visualización.
return [
    'operacion' => ['label' => 'Operación', 'icon' => '◫', 'pages' => [
        'pedidos' => ['label' => 'Pedidos', 'description' => 'Consulta y gestión de pedidos.', 'file' => 'operacion/pedidos.php', 'permission' => 'pedidos.ver'],
        'asignacion' => ['label' => 'Asignación', 'description' => 'Planificación de recursos para cada pedido.', 'file' => 'operacion/asignacion.php', 'permission' => 'asignacion.ver'],
        'carga' => ['label' => 'Carga', 'description' => 'Registro y seguimiento de la carga.', 'file' => 'operacion/carga.php', 'permission' => 'carga.ver'],
        'viajes' => ['label' => 'Viajes', 'description' => 'Seguimiento administrativo de viajes.', 'file' => 'operacion/viajes.php', 'permission' => 'viajes.ver'],
    ]],
    'recursos' => ['label' => 'Recursos', 'icon' => '▤', 'pages' => [
        'vehiculos' => ['label' => 'Vehículos', 'description' => 'Flota y disponibilidad de vehículos.', 'file' => 'recursos/vehiculos.php', 'permission' => 'vehiculos.ver'],
        'choferes' => ['label' => 'Choferes', 'description' => 'Personal asignado a la operación.', 'file' => 'recursos/choferes.php', 'permission' => 'choferes.ver'],
        'devices' => ['label' => 'Devices', 'description' => 'Dispositivos vinculados a los recursos.', 'file' => 'recursos/devices.php', 'permission' => 'devices.ver'],
        'asociaciones' => ['label' => 'Asociaciones', 'description' => 'Relaciones entre vehículos, choferes y devices.', 'file' => 'recursos/asociaciones.php', 'permission' => 'asociaciones.ver'],
    ]],
    'comercial' => ['label' => 'Comercial', 'icon' => '◇', 'pages' => [
        'empresas' => ['label' => 'Empresas', 'description' => 'Organizaciones vinculadas a la operación.', 'file' => 'comercial/empresas.php', 'permission' => 'empresas.ver'],
        'clientes' => ['label' => 'Clientes y destinatarios', 'description' => 'Contactos y destinatarios comerciales.', 'file' => 'comercial/clientes.php', 'permission' => 'clientes.ver'],
        'direcciones' => ['label' => 'Direcciones', 'description' => 'Puntos de origen y destino.', 'file' => 'comercial/direcciones.php', 'permission' => 'direcciones.ver'],
    ]],
    'driver' => ['label' => 'Driver / Activación', 'icon' => '⌁', 'pages' => [
        'devices' => ['label' => 'Listado de devices', 'description' => 'Dispositivos de TwyVox Driver.', 'file' => 'driver/devices.php', 'permission' => 'driver.devices.ver'],
        'nueva_activacion' => ['label' => 'Nueva activación', 'description' => 'Inicio del flujo de activación.', 'file' => 'driver/nueva_activacion.php', 'permission' => 'driver.activacion.crear'],
        'gestion_activacion' => ['label' => 'Detalle y gestión', 'description' => 'Consulta y gestión de una activación.', 'file' => 'driver/gestion_activacion.php', 'permission' => 'driver.activacion.ver'],
    ]],
    'configuracion' => ['label' => 'Configuración', 'icon' => '⚙', 'pages' => [
        'base_operativa' => ['label' => 'Base operativa', 'description' => 'Datos generales de la base operativa.', 'file' => 'configuracion/base_operativa.php', 'permission' => 'configuracion.base.ver'],
        'parametros' => ['label' => 'Parámetros generales', 'description' => 'Preferencias generales del espacio.', 'file' => 'configuracion/parametros.php', 'permission' => 'configuracion.parametros.ver'],
    ]],
    'acceso' => ['label' => 'Acceso y seguridad', 'icon' => '▣', 'pages' => [
        'usuarios' => ['label' => 'Usuarios', 'description' => 'Personas con acceso a TwyVox.', 'file' => 'acceso/usuarios.php', 'permission' => 'usuarios.ver'],
        'roles' => ['label' => 'Roles', 'description' => 'Perfiles de acceso.', 'file' => 'acceso/roles.php', 'permission' => 'roles.ver'],
        'permisos' => ['label' => 'Permisos', 'description' => 'Capacidades asociadas a cada rol.', 'file' => 'acceso/permisos.php', 'permission' => 'permisos.ver'],
    ]],
];
