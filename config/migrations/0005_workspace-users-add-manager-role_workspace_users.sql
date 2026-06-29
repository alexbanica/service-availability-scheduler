ALTER TABLE workspace_users
  MODIFY COLUMN role ENUM('admin', 'manager', 'member') NOT NULL;
