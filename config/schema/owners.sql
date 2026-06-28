CREATE TABLE IF NOT EXISTS owners (
  owner_id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_owners_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id),
  UNIQUE KEY uniq_workspace_owner_name (workspace_id, name)
) ENGINE=InnoDB;
