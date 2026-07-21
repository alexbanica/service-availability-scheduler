import type { Pool, PoolConnection } from 'mysql2/promise';
import type { UserService } from './UserService';

const OWNED_WORKSPACE_CONFLICT_MESSAGE =
  'Account cannot be deleted because one or more workspaces you own still have other members. Remove those members before deleting your account.';

export type AccountDeletionResult =
  | { status: 'deleted' }
  | { status: 'user_not_found' }
  | { status: 'confirmation_mismatch' }
  | { status: 'owned_workspace_conflict'; error: string };

interface AccountDeletionRepositoryInterface {
  withConnection(
    connection: PoolConnection,
  ): AccountDeletionRepositoryInterface;
  hasOwnedWorkspaceWithOtherMembers(userId: string): Promise<boolean>;
  deleteAttributableData(
    userId: string,
    normalizedEmail: string,
  ): Promise<void>;
}

export class AccountDeletionService {
  constructor(
    private readonly repository: AccountDeletionRepositoryInterface,
    private readonly userService: UserService,
    private readonly db: Pool,
  ) {}

  async deleteCurrentUser(
    userId: string,
    confirmationEmail: string,
  ): Promise<AccountDeletionResult> {
    const user = await this.userService.findById(userId);
    if (!user) {
      return { status: 'user_not_found' };
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    if (confirmationEmail.trim().toLowerCase() !== normalizedEmail) {
      return { status: 'confirmation_mismatch' };
    }

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const repository = this.repository.withConnection(connection);

      if (await repository.hasOwnedWorkspaceWithOtherMembers(userId)) {
        await connection.rollback();
        return {
          status: 'owned_workspace_conflict',
          error: OWNED_WORKSPACE_CONFLICT_MESSAGE,
        };
      }

      await repository.deleteAttributableData(userId, normalizedEmail);
      await connection.commit();
      return { status: 'deleted' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
