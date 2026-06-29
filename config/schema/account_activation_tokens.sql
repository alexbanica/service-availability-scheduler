CREATE TABLE IF NOT EXISTS account_activation_tokens (
  token_id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  used_at DATETIME NULL,
  invalidated_at DATETIME NULL,
  CONSTRAINT fk_account_activation_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(user_id),
  INDEX idx_account_activation_tokens_user (user_id),
  INDEX idx_account_activation_tokens_hash (token_hash)
) ENGINE=InnoDB;
