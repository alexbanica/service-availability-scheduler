ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255) NULL AFTER password_hash;

ALTER TABLE users
  ADD UNIQUE KEY google_subject (google_subject);
