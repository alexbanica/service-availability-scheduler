import { PasswordResetService } from '../services/PasswordResetService.js';
import { ThemeHelper, Theme } from '../helpers/ThemeHelper.js';

export class ResetPasswordController {
  bootstrap(Vue: any): void {
    const { createApp, ref, computed, onMounted, onBeforeUnmount } = Vue as {
      createApp: (options: Record<string, unknown>) => {
        mount: (selector: string) => void;
      };
      ref: <T>(value: T) => { value: T };
      computed: <T>(fn: () => T) => { value: T };
      onMounted: (fn: () => void | Promise<void>) => void;
      onBeforeUnmount: (fn: () => void) => void;
    };

    createApp({
      setup: () => {
        const password = ref('');
        const confirmPassword = ref('');
        const loading = ref(false);
        const submitted = ref(false);
        const submitting = ref(false);
        const error = ref('');
        const tokenError = ref('');
        const appVersion = ref('');
        const theme = ref(ThemeHelper.getInitialTheme() as Theme);
        const token = window.location.pathname.split('/').pop() || '';
        const isTokenValid = ref(false);
        const loginRedirectSeconds = ref(5);
        let loginRedirectTimer: number | undefined;

        const scheduleLoginRedirect = () => {
          if (loginRedirectTimer !== undefined) {
            window.clearInterval(loginRedirectTimer);
          }
          loginRedirectSeconds.value = 5;
          loginRedirectTimer = window.setInterval(() => {
            loginRedirectSeconds.value -= 1;
            if (loginRedirectSeconds.value <= 0) {
              window.clearInterval(loginRedirectTimer);
              loginRedirectTimer = undefined;
              window.location.assign('/login');
            }
          }, 1000);
        };

        const applyTheme = (value: Theme) => {
          theme.value = value;
          ThemeHelper.applyTheme(value);
        };

        const toggleTheme = () => {
          applyTheme(theme.value === 'dark' ? 'light' : 'dark');
        };

        const themeLabel = computed(() => ThemeHelper.getLabel(theme.value));

        const validate = async () => {
          loading.value = true;
          tokenError.value = '';
          try {
            if (!token) {
              tokenError.value = 'Invalid reset token.';
              scheduleLoginRedirect();
              return;
            }
            await PasswordResetService.validateToken(token);
            isTokenValid.value = true;
          } catch (err) {
            tokenError.value = (err as Error).message;
            scheduleLoginRedirect();
          } finally {
            loading.value = false;
          }
        };

        const submitReset = async () => {
          error.value = '';

          if (password.value !== confirmPassword.value) {
            error.value = 'Password confirmation does not match';
            return;
          }

          submitting.value = true;

          try {
            await PasswordResetService.resetPassword(
              token,
              password.value,
              confirmPassword.value,
            );
            submitted.value = true;
            scheduleLoginRedirect();
          } catch (err) {
            error.value = (err as Error).message;
          } finally {
            submitting.value = false;
          }
        };

        const loadAppInfo = async () => {
          try {
            const response = await fetch('/api/app-info');
            if (!response.ok) {
              return;
            }
            const data = (await response.json()) as { version?: string };
            appVersion.value =
              typeof data.version === 'string' ? data.version : '';
          } catch {
            appVersion.value = '';
          }
        };

        applyTheme(theme.value);

        onMounted(async () => {
          await validate();
          await loadAppInfo();
        });

        onBeforeUnmount(() => {
          if (loginRedirectTimer !== undefined) {
            window.clearInterval(loginRedirectTimer);
          }
        });

        return {
          password,
          confirmPassword,
          loading,
          submitted,
          submitting,
          error,
          tokenError,
          isTokenValid,
          loginRedirectSeconds,
          appVersion,
          theme,
          themeLabel,
          submitReset,
          toggleTheme,
        };
      },
    }).mount('#reset-password-app');
  }
}
