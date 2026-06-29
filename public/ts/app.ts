import { AppController } from './controllers/AppController.js';
import { AuthService } from './services/AuthService.js';

if (!AuthService.redirectToLoginWhenUnauthenticated()) {
  document.documentElement.classList.remove('auth-redirecting');

  window.addEventListener('pagehide', () => {
    document.documentElement.classList.add('auth-redirecting');
  });

  window.addEventListener('pageshow', () => {
    if (!AuthService.redirectToLoginWhenUnauthenticated()) {
      document.documentElement.classList.remove('auth-redirecting');
    }
  });

  const controller = new AppController();
  controller.bootstrap(Vue);
}
