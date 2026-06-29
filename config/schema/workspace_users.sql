CREATE TABLE IF NOT EXISTS workspace_users (
  workspace_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('admin', 'manager', 'member') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT fk_workspace_users_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id),
  CONSTRAINT fk_workspace_users_user
    FOREIGN KEY (user_id) REFERENCES users(user_id),
  INDEX idx_workspace_users_user (user_id),
  INDEX idx_workspace_users_role (workspace_id, role)
) ENGINE=InnoDB;
