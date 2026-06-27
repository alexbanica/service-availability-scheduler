CREATE TABLE IF NOT EXISTS services (
  service_id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  label VARCHAR(255) NOT NULL,
  default_minutes INT NOT NULL,
  owner_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_services_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id),
  CONSTRAINT fk_services_owner
    FOREIGN KEY (owner_id) REFERENCES owners(owner_id),
  INDEX idx_services_workspace (workspace_id),
  INDEX idx_services_owner (owner_id)
) ENGINE=InnoDB;
