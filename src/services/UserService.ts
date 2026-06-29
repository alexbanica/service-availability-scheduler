import { randomUUID } from 'node:crypto';
import { UserRepository } from '../repositories/UserRepository';
import { User } from '../entities/User';
import { UserRoleRepository } from '../repositories/UserRoleRepository';
import type { MysqlConnection } from '../repositories/AbstractMysqlRepository';

export type UserWithPasswordHash = {
  userId: string;
  email: string;
  nickname: string;
  passwordHash: string | null;
  activatedAt: Date | null;
  activated: boolean;
};

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userRoleRepository?: UserRoleRepository,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findByEmailWithPasswordHash(
    email: string,
  ): Promise<UserWithPasswordHash | null> {
    const user = await this.userRepository.findByEmailWithPasswordHash(email);
    if (!user) {
      return null;
    }

    return {
      userId: user.userId,
      email: user.email,
      nickname: user.nickname,
      passwordHash: user.passwordHash,
      activatedAt: user.activatedAt,
      activated: user.activated,
    };
  }

  async createUser(
    email: string,
    nickname: string,
    passwordHash: string,
    activated = true,
    connection?: MysqlConnection,
  ): Promise<User> {
    const repository = connection
      ? new UserRepository(connection)
      : this.userRepository;
    const userId = randomUUID();
    const user = new User(
      userId,
      email,
      nickname,
      activated ? new Date() : null,
    );
    await repository.insertWithPasswordHash(
      user.userId,
      user.email,
      user.nickname,
      passwordHash,
      user.activatedAt,
    );
    return user;
  }

  async setUserActivated(
    userId: string,
    activated = true,
    connection?: MysqlConnection,
  ): Promise<void> {
    const repository = connection
      ? new UserRepository(connection)
      : this.userRepository;
    await repository.setActivated(userId, activated ? new Date() : null);
  }

  async activateUser(userId: string): Promise<void> {
    await this.setUserActivated(userId, true);
  }

  async grantPlatformAdminRole(
    userId: string,
    connection?: MysqlConnection,
  ): Promise<void> {
    const repository = connection
      ? new UserRoleRepository(connection)
      : this.userRoleRepository;
    if (!repository) {
      throw new Error('User role repository unavailable');
    }
    await repository.grantPlatformAdmin(userId);
  }

  async getNicknamesByIds(ids: string[]): Promise<Map<string, string>> {
    const users = await this.userRepository.findByIds(ids);
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.userId, user.nickname));
    return map;
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.userRepository.updatePasswordHash(userId, passwordHash);
  }
}
