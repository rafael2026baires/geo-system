ALTER TABLE device_activations
    ADD COLUMN replaces_device_id BIGINT UNSIGNED NULL AFTER driver_id,
    ADD INDEX idx_device_activations_replaces_device (replaces_device_id),
    ADD CONSTRAINT fk_device_activations_replaces_device
        FOREIGN KEY (replaces_device_id) REFERENCES devices(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT;
