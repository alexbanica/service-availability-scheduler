import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

export class PasswordService {
  private readonly iterations = 210_000;
  private readonly keyLength = 64;

  validatePassword(password: string): boolean {
    return typeof password === 'string' && password.length >= 8;
  }

  async hashPassword(password: string): Promise<string> {
    if (!this.validatePassword(password)) {
      throw new Error('Password is too short');
    }

    const salt = randomBytes(16);
    const key = pbkdf2Sync(
      password,
      salt,
      this.iterations,
      this.keyLength,
      'sha512',
    );
    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }

  async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    const parts = passwordHash.split(':');
    if (parts.length !== 2) {
      return false;
    }

    const [saltHex, hashHex] = parts;
    if (!saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const expectedHash = Buffer.from(hashHex, 'hex');
    const candidateHash = pbkdf2Sync(
      password,
      salt,
      this.iterations,
      this.keyLength,
      'sha512',
    );

    if (candidateHash.length !== expectedHash.length) {
      return false;
    }

    return timingSafeEqual(candidateHash, expectedHash);
  }
}
