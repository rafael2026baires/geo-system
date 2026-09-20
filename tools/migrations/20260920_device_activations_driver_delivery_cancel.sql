-- Alinea device_activations con el flujo Driver actual.
-- Ejecutar una sola vez después de verificar el esquema real.

ALTER TABLE device_activations
    ADD COLUMN driver_id BIGINT UNSIGNED NULL AFTER vehicle_id,
    MODIFY COLUMN status ENUM('PENDING','USED','EXPIRED','CANCELLED')
        COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'PENDING',
    ADD COLUMN delivery_started_at DATETIME NULL DEFAULT NULL AFTER expires_at,
    ADD COLUMN cancelled_at DATETIME NULL DEFAULT NULL AFTER used_at,
    ADD CONSTRAINT fk_device_activations_driver
        FOREIGN KEY (driver_id) REFERENCES drivers (id);