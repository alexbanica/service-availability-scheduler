import path from 'path';
import express from 'express';
import type { Pool } from 'mysql2/promise';
import { initDb } from './db';
import { ConfigLoaderService } from './services/ConfigLoaderService';
import { JwtAuthService } from './services/JwtAuthService';
import { PasswordService } from './services/PasswordService';
import { PasswordResetTokenService } from './services/PasswordResetTokenService';
import { PasswordResetTokenRepository } from './repositories/PasswordResetTokenRepository';
import { CaptchaService } from './services/CaptchaService';
import { UserService } from './services/UserService';
import { ReservationService } from './services/ReservationService';
import { WorkspaceService } from './services/WorkspaceService';
import { UserRepository } from './repositories/UserRepository';
import { ReservationRepository } from './repositories/ReservationRepository';
import { ServiceRepository } from './repositories/ServiceRepository';
import { WorkspaceRepository } from './repositories/WorkspaceRepository';
import { WorkspaceUserRepository } from './repositories/WorkspaceUserRepository';
import { WorkspaceInvitationRepository } from './repositories/WorkspaceInvitationRepository';
import { UserRoleRepository } from './repositories/UserRoleRepository';
import { AccountActivationTokenRepository } from './repositories/AccountActivationTokenRepository';
import { AccountActivationTokenService } from './services/AccountActivationTokenService';
import { AuthController } from './controllers/AuthController';
import { ServiceController } from './controllers/ServiceController';
import { ReservationController } from './controllers/ReservationController';
import { PageController } from './controllers/PageController';
import { WorkspaceController } from './controllers/WorkspaceController';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const CLEANUP_INTERVAL_MS = 60 * 1000;

const ROOT_DIR = path.join(__dirname, '..');
const APP_CONFIG_PATH = path.join(ROOT_DIR, 'config', 'app.yml');

app.use(express.json());

app.use('/public', express.static(path.join(ROOT_DIR, 'public')));

let db: Pool;

async function start() {
  const configLoader = new ConfigLoaderService();
  const config = configLoader.loadConfig(APP_CONFIG_PATH);

  db = await initDb(config.runMigrationsOnStartup);

  const userRepository = new UserRepository(db);
  const reservationRepository = new ReservationRepository(db);
  const serviceRepository = new ServiceRepository(db);
  const workspaceRepository = new WorkspaceRepository(db);
  const workspaceUserRepository = new WorkspaceUserRepository(db);
  const invitationRepository = new WorkspaceInvitationRepository(db);
  const userRoleRepository = new UserRoleRepository(db);
  const passwordResetTokenRepository = new PasswordResetTokenRepository(db);
  const accountActivationTokenRepository = new AccountActivationTokenRepository(
    db,
  );

  const userService = new UserService(userRepository, userRoleRepository);
  const reservationService = new ReservationService(
    reservationRepository,
    userService,
    serviceRepository,
    config.expiryWarningMinutes,
    config.autoRefreshSeconds,
  );
  const jwtAuthService = new JwtAuthService(
    SESSION_SECRET,
    config.jwtExpiresInSeconds,
  );
  const passwordService = new PasswordService();
  const captchaService = new CaptchaService();
  const passwordResetTokenService = new PasswordResetTokenService(
    passwordResetTokenRepository,
    config.passwordResetTokenExpiresInSeconds,
  );
  const accountActivationTokenService = new AccountActivationTokenService(
    accountActivationTokenRepository,
    config.passwordResetTokenExpiresInSeconds,
    undefined,
    db,
  );
  const workspaceService = new WorkspaceService(
    db,
    workspaceRepository,
    workspaceUserRepository,
    serviceRepository,
    invitationRepository,
    userRepository,
    userRoleRepository,
  );

  setInterval(() => {
    reservationService.cleanupExpired(new Date()).catch((err) => {
      console.error('Failed to cleanup expired reservations', err);
    });
  }, CLEANUP_INTERVAL_MS);

  new PageController(ROOT_DIR).register(app);
  new AuthController(
    userService,
    jwtAuthService,
    passwordService,
    captchaService,
    passwordResetTokenService,
    console,
    accountActivationTokenService,
    console,
    db,
  ).register(app);
  new WorkspaceController(workspaceService).register(app);
  new ServiceController(reservationService).register(app);
  new ReservationController(reservationService).register(app);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
