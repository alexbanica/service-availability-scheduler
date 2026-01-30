import { UserRepository } from '../repositories/UserRepository';
import { User } from '../entities/User';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async getNicknamesByIds(ids: number[]): Promise<Map<number, string>> {
    const users = await this.userRepository.findByIds(ids);
    const map = new Map<number, string>();
    users.forEach((user) => map.set(user.id, user.nickname));
    return map;
  }

  async getEmailsByIds(ids: number[]): Promise<Map<number, string>> {
    const users = await this.userRepository.findByIds(ids);
    const map = new Map<number, string>();
    users.forEach((user) => map.set(user.id, user.email));
    return map;
  }
}
