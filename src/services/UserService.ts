import { UserRepository } from '../repositories/UserRepository';
import { User } from '../entities/User';

export type UserWithPasswordHash = {
  userId: string;
  email: string;
  nickname: string;
  passwordHash: string | null;
};

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

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
    };
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
