CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role ENUM('platform_admin') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role),
  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
