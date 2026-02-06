CREATE TABLE IF NOT EXISTS workspace_users (
  workspace_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('admin', 'member') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT fk_workspace_users_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  CONSTRAINT fk_workspace_users_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_workspace_users_user (user_id),
  INDEX idx_workspace_users_role (workspace_id, role)
) ENGINE=InnoDB;
