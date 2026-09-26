<?php

declare(strict_types=1);

final class VehicleRegularDriverException extends RuntimeException
{
    public function __construct(
        public int $httpStatus,
        public string $errorCode,
        string $message
    ) {
        parent::__construct($message);
    }
}

final class VehicleRegularDriverService
{
    public static function getCurrent(PDO $pdo, int $tenantId, int $vehicleId): ?array
    {
        self::requireVehicle($pdo, $tenantId, $vehicleId, false, false);

        $query = $pdo->prepare(
            'SELECT a.id, a.vehicle_id, a.driver_id, a.assigned_at, a.ended_at,
                    d.name AS driver_name, d.dni, d.phone, d.email, d.active AS driver_active
             FROM vehicle_regular_driver_assignments a
             INNER JOIN drivers d ON d.id = a.driver_id AND d.tenant_id = a.tenant_id
             WHERE a.tenant_id = ? AND a.vehicle_id = ? AND a.ended_at IS NULL
             LIMIT 1'
        );
        $query->execute([$tenantId, $vehicleId]);
        return self::normalize($query->fetch(PDO::FETCH_ASSOC) ?: null);
    }

    public static function getHistory(PDO $pdo, int $tenantId, int $vehicleId): array
    {
        self::requireVehicle($pdo, $tenantId, $vehicleId, false, false);

        $query = $pdo->prepare(
            'SELECT a.id, a.vehicle_id, a.driver_id, a.assigned_at, a.ended_at,
                    d.name AS driver_name, d.dni, d.phone, d.email, d.active AS driver_active
             FROM vehicle_regular_driver_assignments a
             INNER JOIN drivers d ON d.id = a.driver_id AND d.tenant_id = a.tenant_id
             WHERE a.tenant_id = ? AND a.vehicle_id = ?
             ORDER BY a.assigned_at DESC, a.id DESC'
        );
        $query->execute([$tenantId, $vehicleId]);
        return array_map([self::class, 'normalize'], $query->fetchAll(PDO::FETCH_ASSOC));
    }

    public static function getDetail(PDO $pdo, int $tenantId, int $vehicleId): array
    {
        return [
            'vehicle_id' => $vehicleId,
            'current' => self::getCurrent($pdo, $tenantId, $vehicleId),
            'history' => self::getHistory($pdo, $tenantId, $vehicleId),
        ];
    }

    public static function set(PDO $pdo, int $tenantId, int $vehicleId, int $driverId): array
    {
        $ownsTransaction = !$pdo->inTransaction();
        try {
            if ($ownsTransaction) {
                $pdo->beginTransaction();
            }
            self::requireVehicle($pdo, $tenantId, $vehicleId, true, true);
            self::requireDriver($pdo, $tenantId, $driverId, true, true);

            $current = self::lockCurrentForVehicle($pdo, $tenantId, $vehicleId);
            if ($current !== null && (int)$current['driver_id'] === $driverId) {
                if ($ownsTransaction) {
                    $pdo->commit();
                }
                return ['changed' => false, 'assignment' => self::getCurrent($pdo, $tenantId, $vehicleId)];
            }

            if ($current !== null) {
                self::closeById($pdo, (int)$current['id']);
            }

            $insert = $pdo->prepare(
                'INSERT INTO vehicle_regular_driver_assignments
                 (tenant_id, vehicle_id, driver_id, assigned_at, ended_at)
                 VALUES (?, ?, ?, NOW(), NULL)'
            );
            $insert->execute([$tenantId, $vehicleId, $driverId]);
            $assignmentId = (int)$pdo->lastInsertId();
            if ($ownsTransaction) {
                $pdo->commit();
            }

            $assignment = self::getCurrent($pdo, $tenantId, $vehicleId);
            if ($assignment === null || (int)$assignment['id'] !== $assignmentId) {
                throw new RuntimeException('No se pudo recuperar la asignación creada.');
            }
            return ['changed' => true, 'assignment' => $assignment];
        } catch (Throwable $e) {
            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function remove(PDO $pdo, int $tenantId, int $vehicleId): array
    {
        $ownsTransaction = !$pdo->inTransaction();
        try {
            if ($ownsTransaction) {
                $pdo->beginTransaction();
            }
            self::requireVehicle($pdo, $tenantId, $vehicleId, false, true);
            $current = self::lockCurrentForVehicle($pdo, $tenantId, $vehicleId);
            if ($current === null) {
                if ($ownsTransaction) {
                    $pdo->commit();
                }
                return ['changed' => false, 'vehicle_id' => $vehicleId];
            }

            self::closeById($pdo, (int)$current['id']);
            if ($ownsTransaction) {
                $pdo->commit();
            }
            return ['changed' => true, 'vehicle_id' => $vehicleId];
        } catch (Throwable $e) {
            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function closeCurrentForVehicle(PDO $pdo, int $tenantId, int $vehicleId): int
    {
        $update = $pdo->prepare(
            'UPDATE vehicle_regular_driver_assignments
             SET ended_at = NOW()
             WHERE tenant_id = ? AND vehicle_id = ? AND ended_at IS NULL'
        );
        $update->execute([$tenantId, $vehicleId]);
        return $update->rowCount();
    }

    public static function closeCurrentForDriver(PDO $pdo, int $tenantId, int $driverId): int
    {
        $update = $pdo->prepare(
            'UPDATE vehicle_regular_driver_assignments
             SET ended_at = NOW()
             WHERE tenant_id = ? AND driver_id = ? AND ended_at IS NULL'
        );
        $update->execute([$tenantId, $driverId]);
        return $update->rowCount();
    }

    private static function requireVehicle(
        PDO $pdo,
        int $tenantId,
        int $vehicleId,
        bool $activeRequired,
        bool $lock
    ): array {
        $sql = 'SELECT id, tenant_id, active FROM vehicles WHERE id = ? AND tenant_id = ? LIMIT 1';
        if ($lock) {
            $sql .= ' FOR UPDATE';
        }
        $query = $pdo->prepare($sql);
        $query->execute([$vehicleId, $tenantId]);
        $vehicle = $query->fetch(PDO::FETCH_ASSOC);
        if (!$vehicle) {
            throw new VehicleRegularDriverException(404, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado.');
        }
        if ($activeRequired && (int)$vehicle['active'] !== 1) {
            throw new VehicleRegularDriverException(409, 'VEHICLE_NOT_ACTIVE', 'El vehículo no está activo.');
        }
        return $vehicle;
    }

    private static function requireDriver(
        PDO $pdo,
        int $tenantId,
        int $driverId,
        bool $activeRequired,
        bool $lock
    ): array {
        $sql = 'SELECT id, tenant_id, active FROM drivers WHERE id = ? AND tenant_id = ? LIMIT 1';
        if ($lock) {
            $sql .= ' FOR UPDATE';
        }
        $query = $pdo->prepare($sql);
        $query->execute([$driverId, $tenantId]);
        $driver = $query->fetch(PDO::FETCH_ASSOC);
        if (!$driver) {
            throw new VehicleRegularDriverException(404, 'DRIVER_NOT_FOUND', 'Chofer no encontrado.');
        }
        if ($activeRequired && (int)$driver['active'] !== 1) {
            throw new VehicleRegularDriverException(409, 'DRIVER_NOT_ACTIVE', 'El chofer no está activo.');
        }
        return $driver;
    }

    private static function lockCurrentForVehicle(PDO $pdo, int $tenantId, int $vehicleId): ?array
    {
        $query = $pdo->prepare(
            'SELECT id, driver_id
             FROM vehicle_regular_driver_assignments
             WHERE tenant_id = ? AND vehicle_id = ? AND ended_at IS NULL
             LIMIT 1 FOR UPDATE'
        );
        $query->execute([$tenantId, $vehicleId]);
        return $query->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private static function closeById(PDO $pdo, int $assignmentId): void
    {
        $update = $pdo->prepare(
            'UPDATE vehicle_regular_driver_assignments
             SET ended_at = NOW()
             WHERE id = ? AND ended_at IS NULL'
        );
        $update->execute([$assignmentId]);
        if ($update->rowCount() !== 1) {
            throw new RuntimeException('La asignación habitual cambió durante la operación.');
        }
    }

    private static function normalize(?array $row): ?array
    {
        if ($row === null) {
            return null;
        }
        foreach (['id', 'vehicle_id', 'driver_id', 'driver_active'] as $field) {
            if (array_key_exists($field, $row)) {
                $row[$field] = (int)$row[$field];
            }
        }
        return $row;
    }
}
