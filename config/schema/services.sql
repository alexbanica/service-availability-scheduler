CREATE TABLE IF NOT EXISTS services (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workspace_id INT NOT NULL,
  service_id VARCHAR(36) NOT NULL,
  label VARCHAR(255) NOT NULL,
  default_minutes INT NOT NULL,
  owner VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_services_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  UNIQUE KEY uniq_services_workspace_service_id (workspace_id, service_id),
  INDEX idx_services_workspace (workspace_id)
) ENGINE=InnoDB;
