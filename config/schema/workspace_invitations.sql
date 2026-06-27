CREATE TABLE IF NOT EXISTS workspace_invitations (
  invitation_id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  invited_user_id CHAR(36) NOT NULL,
  invited_by_user_id CHAR(36) NOT NULL,
  status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_workspace_invitations_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id),
  CONSTRAINT fk_workspace_invitations_invited_user
    FOREIGN KEY (invited_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_workspace_invitations_invited_by_user
    FOREIGN KEY (invited_by_user_id) REFERENCES users(user_id),
  UNIQUE KEY uniq_workspace_invitations_status (workspace_id, invited_user_id, status),
  INDEX idx_workspace_invitations_invited_user (invited_user_id)
) ENGINE=InnoDB;
