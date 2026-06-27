CREATE TABLE IF NOT EXISTS environments (
  environment_id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_environments_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id),
  UNIQUE KEY uniq_environments_workspace_name (workspace_id, name),
  INDEX idx_environments_workspace (workspace_id)
) ENGINE=InnoDB;
