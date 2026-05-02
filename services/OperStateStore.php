<?php

/*
regla de cómo guardar y leer el estado operativo en memoria.
No sabe nada de pedidos ni viajes.
Solo guarda y devuelve datos.
*/

interface OperStateStore
{
    public function set(string $tenantId, string $unitId, array $data): void;
    public function get(string $tenantId, string $unitId): ?array;
}