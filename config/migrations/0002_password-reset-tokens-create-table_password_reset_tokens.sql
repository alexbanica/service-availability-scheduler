CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  invalidated_at DATETIME NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(user_id),
  INDEX idx_password_reset_tokens_user (user_id),
  INDEX idx_password_reset_tokens_hash (token_hash)
) ENGINE=InnoDB;
