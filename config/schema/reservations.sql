CREATE TABLE IF NOT EXISTS reservations (
  reservation_id CHAR(36) PRIMARY KEY,
  service_key VARCHAR(255) NOT NULL,
  environment_name VARCHAR(120) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  user_id CHAR(36) NOT NULL,
  claimed_by_label VARCHAR(255) NULL,
  claimed_by_team TINYINT(1) NOT NULL DEFAULT 0,
  claimed_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  released_at DATETIME NULL,
  CONSTRAINT fk_reservations_user
    FOREIGN KEY (user_id) REFERENCES users(user_id),
  INDEX idx_reservations_service_key (service_key),
  INDEX idx_reservations_user_id (user_id)
) ENGINE=InnoDB;
