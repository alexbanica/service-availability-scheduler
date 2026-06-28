import { LoginService } from '../services/LoginService.js';
import { ThemeHelper, Theme } from '../helpers/ThemeHelper.js';

export class LoginController {
  bootstrap(Vue: any): void {
    const { createApp, ref, computed, onMounted } = Vue as {
      createApp: (options: Record<string, unknown>) => {
        mount: (selector: string) => void;
      };
      ref: <T>(value: T) => { value: T };
      computed: <T>(fn: () => T) => { value: T };
      onMounted: (fn: () => void | Promise<void>) => void;
    };

    createApp({
      setup: () => {
        const email = ref('');
        const error = ref('');
        const submitting = ref(false);
        const appVersion = ref('');
        const theme = ref(ThemeHelper.getInitialTheme() as Theme);

        const submit = async () => {
          error.value = '';
          submitting.value = true;
          try {
            await LoginService.login(email.value.trim());
            window.location.href = '/';
          } catch (err) {
            error.value = (err as Error).message;
          } finally {
            submitting.value = false;
          }
        };

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

        applyTheme(theme.value);

        onMounted(async () => {
          await loadAppInfo();
        });

        return {
          email,
          error,
          submitting,
          appVersion,
          submit,
          theme,
          themeLabel,
          toggleTheme,
        };
      },
    }).mount('#login-app');
  }
}
