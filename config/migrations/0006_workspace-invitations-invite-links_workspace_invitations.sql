ALTER TABLE workspace_invitations
  ADD COLUMN IF NOT EXISTS invited_email VARCHAR(320) NULL,
  ADD COLUMN IF NOT EXISTS invitation_code_hash CHAR(64) NULL,
  MODIFY invited_user_id CHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS accepted_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS consumed_at DATETIME NULL;

UPDATE workspace_invitations AS wi
LEFT JOIN users AS u
  ON wi.invited_user_id = u.user_id
SET wi.invited_email = COALESCE(wi.invited_email, LOWER(TRIM(u.email))),
    wi.invitation_code_hash = COALESCE(
      wi.invitation_code_hash,
      SHA2(
        CONCAT_WS(
          '|',
          wi.invitation_id,
          wi.workspace_id,
          wi.invited_by_user_id,
          COALESCE(wi.invited_user_id, ''),
          COALESCE(wi.invited_email, LOWER(TRIM(u.email)))
        ),
        256
      )
    ),
    wi.expires_at = COALESCE(
      wi.expires_at,
      DATE_ADD(wi.created_at, INTERVAL 24 HOUR)
    );

UPDATE workspace_invitations
SET invited_email = LOWER(TRIM(invited_email))
WHERE invited_email IS NOT NULL;

UPDATE workspace_invitations
SET invitation_code_hash = SHA2(
  CONCAT_WS(
    '|',
    invitation_id,
    workspace_id,
    invited_by_user_id,
    COALESCE(invited_user_id, '')
  ),
  256
)
WHERE invitation_code_hash IS NULL;

UPDATE workspace_invitations
SET expires_at = DATE_ADD(created_at, INTERVAL 24 HOUR)
WHERE expires_at IS NULL;

ALTER TABLE workspace_invitations
  MODIFY invited_email VARCHAR(320) NOT NULL,
  MODIFY invitation_code_hash CHAR(64) NOT NULL,
  MODIFY expires_at DATETIME NOT NULL;

ALTER TABLE workspace_invitations
  ADD UNIQUE KEY IF NOT EXISTS uniq_workspace_invitations_code_hash (invitation_code_hash),
  ADD INDEX IF NOT EXISTS idx_workspace_invitations_workspace_email (workspace_id, invited_email),
  ADD INDEX IF NOT EXISTS idx_workspace_invitations_workspace_status (workspace_id, status),
  ADD INDEX IF NOT EXISTS idx_workspace_invitations_workspace_email_status (workspace_id, invited_email, status),
  ADD INDEX IF NOT EXISTS idx_workspace_invitations_invited_user (invited_user_id),
  ADD INDEX IF NOT EXISTS idx_workspace_invitations_invited_by_user (invited_by_user_id),
  ADD INDEX IF NOT EXISTS idx_workspace_invitations_expires_at (expires_at);

ALTER TABLE workspace_invitations
  DROP INDEX IF EXISTS uniq_workspace_invitations_status;
