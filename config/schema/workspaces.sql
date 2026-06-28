CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  admin_user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_workspaces_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES users(user_id),
  INDEX idx_workspaces_admin_user (admin_user_id)
) ENGINE=InnoDB;
