import { ApiService } from './ApiService.js';
import { User } from '../entities/User.js';

export class AuthService {
  static async loadUser(): Promise<User | null> {
    const response = await ApiService.get('/api/me');
    if (!response.ok) {
      window.location.href = '/login';
      return null;
    }
    const data = (await response.json()) as {
      id: string;
      email: string;
      nickname: string;
    };
    return new User(data.id, data.email, data.nickname);
  }

  static async logout(): Promise<void> {
    await ApiService.post('/api/logout');
    window.location.href = '/login';
  }
}
