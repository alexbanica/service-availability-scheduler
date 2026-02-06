CREATE TABLE IF NOT EXISTS workspaces (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  admin_user_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_workspaces_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES users(id),
  INDEX idx_workspaces_admin_user (admin_user_id)
) ENGINE=InnoDB;
