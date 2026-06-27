import { UserRepository } from '../repositories/UserRepository';
import { User } from '../entities/User';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async getNicknamesByIds(ids: string[]): Promise<Map<string, string>> {
    const users = await this.userRepository.findByIds(ids);
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.userId, user.nickname));
    return map;
  }
}
