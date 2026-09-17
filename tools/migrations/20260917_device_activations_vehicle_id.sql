-- El esquema actual tiene vehicles.id INT y device_activations vacía.
-- Ejecutar una sola vez antes de desplegar los endpoints Driver actualizados.
ALTER TABLE device_activations
    ADD COLUMN vehicle_id INT NOT NULL AFTER device_id,
    ADD INDEX idx_device_activations_vehicle (vehicle_id),
    ADD CONSTRAINT fk_device_activations_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT;
