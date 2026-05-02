<?php

/*
implementación concreta que usa APCu para guardar en memoria del servidor.
Hoy usa APCu.
Mañana puede ser Redis sin cambiar la lógica.
*/

require_once __DIR__ . '/OperStateStore.php';

class ApcuOperStateStore implements OperStateStore
{
    private function key(string $tenantId, string $unitId): string
    {
        return "oper_state:{$tenantId}:{$unitId}";
    }

    public function set(string $tenantId, string $unitId, array $data): void
    {
        apcu_store($this->key($tenantId, $unitId), $data);
    }

    public function get(string $tenantId, string $unitId): ?array
    {
        $value = apcu_fetch($this->key($tenantId, $unitId));
        return $value !== false ? $value : null;
    }
}
