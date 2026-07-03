CREATE TABLE IF NOT EXISTS email_jobs (
  job_id CHAR(36) PRIMARY KEY,
  email_kind ENUM('password_reset', 'account_activation', 'workspace_invitation') NOT NULL,
  recipient_email VARCHAR(320) NOT NULL,
  user_id CHAR(36) NULL,
  template_id VARCHAR(255) NOT NULL,
  payload_json JSON NOT NULL,
  idempotency_key CHAR(36) NOT NULL,
  status ENUM('pending', 'sending', 'retryable', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NULL,
  last_attempt_at DATETIME NULL,
  onesignal_message_id VARCHAR(255) NULL,
  last_error_summary VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_jobs_user
    FOREIGN KEY (user_id) REFERENCES users(user_id),
  UNIQUE KEY uniq_email_jobs_idempotency_key (idempotency_key),
  INDEX idx_email_jobs_due (status, next_attempt_at, created_at),
  INDEX idx_email_jobs_kind_status (email_kind, status),
  INDEX idx_email_jobs_user (user_id),
  INDEX idx_email_jobs_recipient (recipient_email)
) ENGINE=InnoDB;
