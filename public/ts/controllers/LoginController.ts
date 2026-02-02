import { LoginService } from '../services/LoginService.js';
import { ThemeHelper, Theme } from '../helpers/ThemeHelper.js';

export class LoginController {
  bootstrap(Vue: any): void {
    const { createApp, ref, computed } = Vue;

    createApp({
      setup: () => {
        const email = ref('');
        const error = ref('');
        const submitting = ref(false);
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

        applyTheme(theme.value);

        return {
          email,
          error,
          submitting,
          submit,
          theme,
          themeLabel,
          toggleTheme,
        };
      },
    }).mount('#login-app');
  }
}
