CREATE TABLE IF NOT EXISTS service_environments (
  service_id CHAR(36) NOT NULL,
  environment_id CHAR(36) NOT NULL,
  service_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_environments_service
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE,
  CONSTRAINT fk_service_environments_environment
    FOREIGN KEY (environment_id) REFERENCES environments(environment_id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, environment_id),
  UNIQUE KEY uniq_service_key (service_key),
  INDEX idx_service_environments_service (service_id),
  INDEX idx_service_environments_environment (environment_id)
) ENGINE=InnoDB;
