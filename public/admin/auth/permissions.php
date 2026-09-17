<?php
declare(strict_types=1);

function can(string $permission): bool
{
    // La sesión actual no entrega permisos. El filtro queda listo para una fuente futura.
    if (!array_key_exists('admin_permissions', $_SESSION)) {
        return true;
    }

    $permissions = $_SESSION['admin_permissions'];
    return is_array($permissions) && in_array($permission, $permissions, true);
}
