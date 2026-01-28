-- MariaDB schema.
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  nickname VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE reservations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_key VARCHAR(255) NOT NULL,
  environment_name VARCHAR(120) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  claimed_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  released_at DATETIME NULL,
  CONSTRAINT fk_reservations_user
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE INDEX idx_reservations_service_key ON reservations(service_key);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
