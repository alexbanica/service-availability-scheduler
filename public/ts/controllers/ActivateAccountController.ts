import { AccountActivationService } from '../services/AccountActivationService.js';
import { ThemeHelper, Theme } from '../helpers/ThemeHelper.js';

export class ActivateAccountController {
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
        const theme = ref(ThemeHelper.getInitialTheme() as Theme);
        const token = window.location.pathname.split('/').pop() || '';
        const loading = ref(false);
        const error = ref('');
        const submitted = ref(false);
        const activating = ref(false);
        const appVersion = ref('');
        const dashboardRedirectSeconds = ref(5);
        let dashboardRedirectTimer: number | undefined;

        const applyTheme = (value: Theme) => {
          theme.value = value;
          ThemeHelper.applyTheme(value);
        };

        const toggleTheme = () => {
          applyTheme(theme.value === 'dark' ? 'light' : 'dark');
        };

        const themeLabel = computed(() => ThemeHelper.getLabel(theme.value));

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

        const validateToken = async () => {
          loading.value = true;
          error.value = '';
          try {
            if (!token) {
              error.value = 'Invalid activation link.';
              return;
            }
            await AccountActivationService.validate({ token });
          } catch (err) {
            error.value = (err as Error).message;
          } finally {
            loading.value = false;
          }
        };

        const activate = async () => {
          error.value = '';
          activating.value = true;
          try {
            await AccountActivationService.activate({ token });
            submitted.value = true;
            dashboardRedirectSeconds.value = 5;
            if (dashboardRedirectTimer !== undefined) {
              window.clearInterval(dashboardRedirectTimer);
            }
            dashboardRedirectTimer = window.setInterval(() => {
              dashboardRedirectSeconds.value -= 1;
              if (dashboardRedirectSeconds.value <= 0) {
                window.clearInterval(dashboardRedirectTimer);
                dashboardRedirectTimer = undefined;
                window.location.assign('/overview');
              }
            }, 1000);
          } catch (err) {
            error.value = (err as Error).message;
          } finally {
            activating.value = false;
          }
        };

        const goLogin = () => {
          window.location.assign('/login');
        };

        const showDashboard = () => {
          window.location.assign('/overview');
        };

        onMounted(async () => {
          applyTheme(theme.value);
          await validateToken();
          await loadAppInfo();
        });

        onBeforeUnmount(() => {
          if (dashboardRedirectTimer !== undefined) {
            window.clearInterval(dashboardRedirectTimer);
          }
        });

        return {
          theme,
          themeLabel,
          toggleTheme,
          loading,
          error,
          submitted,
          activating,
          dashboardRedirectSeconds,
          appVersion,
          goLogin,
          showDashboard,
          activate,
          token,
        };
      },
    }).mount('#activate-account-app');
  }
}
