import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type OwnedWorkspaceMembershipRow = RowDataPacket & {
  workspace_id: string;
  other_user_id: string | null;
};

type OwnedWorkspaceRow = RowDataPacket & {
  workspace_id: string;
};

type ServiceEnvironmentRow = RowDataPacket & {
  service_key: string;
};

export class AccountDeletionRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  withConnection(connection: PoolConnection): AccountDeletionRepository {
    return new AccountDeletionRepository(connection);
  }

  async hasOwnedWorkspaceWithOtherMembers(userId: string): Promise<boolean> {
    await this.get<RowDataPacket>(
      'SELECT user_id FROM users WHERE user_id = ? FOR UPDATE',
      [userId],
    );

    const memberships = await this.all<OwnedWorkspaceMembershipRow>(
      `SELECT w.workspace_id, wu.user_id AS other_user_id
       FROM workspaces w
       LEFT JOIN workspace_users wu
         ON wu.workspace_id = w.workspace_id
        AND wu.user_id <> ?
       WHERE w.admin_user_id = ?
       FOR UPDATE`,
      [userId, userId],
    );

    return memberships.some((membership) => membership.other_user_id !== null);
  }

  async deleteAttributableData(
    userId: string,
    normalizedEmail: string,
  ): Promise<void> {
    const ownedWorkspaceRows = await this.all<OwnedWorkspaceRow>(
      'SELECT workspace_id FROM workspaces WHERE admin_user_id = ? FOR UPDATE',
      [userId],
    );
    const ownedWorkspaceIds = ownedWorkspaceRows.map((row) => row.workspace_id);
    const workspacePlaceholders = ownedWorkspaceIds.map(() => '?').join(', ');

    let serviceKeys: string[] = [];
    if (ownedWorkspaceIds.length > 0) {
      const serviceEnvironmentRows = await this.all<ServiceEnvironmentRow>(
        `SELECT se.service_key
         FROM service_environments se
         INNER JOIN services s ON s.service_id = se.service_id
         WHERE s.workspace_id IN (${workspacePlaceholders})
         FOR UPDATE`,
        ownedWorkspaceIds,
      );
      serviceKeys = serviceEnvironmentRows.map((row) => row.service_key);
    }

    if (serviceKeys.length > 0) {
      const serviceKeyPlaceholders = serviceKeys.map(() => '?').join(', ');
      await this.run(
        `DELETE FROM reservations
         WHERE user_id = ? OR service_key IN (${serviceKeyPlaceholders})`,
        [userId, ...serviceKeys],
      );
    } else {
      await this.run('DELETE FROM reservations WHERE user_id = ?', [userId]);
    }

    if (ownedWorkspaceIds.length > 0) {
      await this.run(
        `DELETE FROM workspace_invitations
         WHERE workspace_id IN (${workspacePlaceholders})
            OR invited_by_user_id = ?
            OR invited_user_id = ?
            OR LOWER(TRIM(invited_email)) = ?`,
        [...ownedWorkspaceIds, userId, userId, normalizedEmail],
      );
    } else {
      await this.run(
        `DELETE FROM workspace_invitations
         WHERE invited_by_user_id = ?
            OR invited_user_id = ?
            OR LOWER(TRIM(invited_email)) = ?`,
        [userId, userId, normalizedEmail],
      );
    }

    await this.run(
      `DELETE FROM email_jobs
       WHERE user_id = ? OR LOWER(TRIM(recipient_email)) = ?`,
      [userId, normalizedEmail],
    );
    await this.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [
      userId,
    ]);
    await this.run('DELETE FROM account_activation_tokens WHERE user_id = ?', [
      userId,
    ]);

    if (ownedWorkspaceIds.length > 0) {
      await this.run(
        `DELETE se
         FROM service_environments se
         INNER JOIN services s ON s.service_id = se.service_id
         WHERE s.workspace_id IN (${workspacePlaceholders})`,
        ownedWorkspaceIds,
      );
      await this.run(
        `DELETE FROM services
         WHERE workspace_id IN (${workspacePlaceholders})`,
        ownedWorkspaceIds,
      );
      await this.run(
        `DELETE FROM owners
         WHERE workspace_id IN (${workspacePlaceholders})`,
        ownedWorkspaceIds,
      );
      await this.run(
        `DELETE FROM environments
         WHERE workspace_id IN (${workspacePlaceholders})`,
        ownedWorkspaceIds,
      );
      await this.run(
        `DELETE FROM workspace_users
         WHERE workspace_id IN (${workspacePlaceholders}) OR user_id = ?`,
        [...ownedWorkspaceIds, userId],
      );
      await this.run(
        `DELETE FROM workspaces
         WHERE workspace_id IN (${workspacePlaceholders})`,
        ownedWorkspaceIds,
      );
    } else {
      await this.run('DELETE FROM workspace_users WHERE user_id = ?', [userId]);
    }

    await this.run('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    await this.run('DELETE FROM users WHERE user_id = ?', [userId]);
  }
}
