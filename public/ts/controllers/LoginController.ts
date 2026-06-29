import { LoginService } from '../services/LoginService.js';
import { PasswordResetService } from '../services/PasswordResetService.js';
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
        const password = ref('');
        const error = ref('');
        const submitting = ref(false);
        const forgotMode = ref(false);
        const forgotEmail = ref('');
        const forgotChallengeId = ref('');
        const forgotChallengePrompt = ref('');
        const forgotChallengeAnswer = ref('');
        const forgotRequestSubmitting = ref(false);
        const forgotRequestError = ref('');
        const forgotRequestSuccess = ref(false);
        const appVersion = ref('');
        const theme = ref(ThemeHelper.getInitialTheme() as Theme);

        const submit = async () => {
          error.value = '';
          submitting.value = true;
          try {
            await LoginService.login(email.value.trim(), password.value);
            window.location.href = '/';
          } catch (err) {
            error.value = (err as Error).message;
          } finally {
            submitting.value = false;
          }
        };

        const openForgotMode = () => {
          forgotMode.value = true;
          forgotEmail.value = email.value;
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
          forgotChallengeId.value = '';
          forgotChallengePrompt.value = '';
          forgotChallengeAnswer.value = '';
        };

        const resetForgotMode = () => {
          forgotMode.value = false;
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
          forgotChallengeId.value = '';
          forgotChallengePrompt.value = '';
          forgotChallengeAnswer.value = '';
        };

        const loadResetChallenge = async () => {
          forgotRequestSubmitting.value = true;
          forgotRequestError.value = '';
          try {
            const challenge = await PasswordResetService.requestChallenge();
            forgotChallengeId.value = challenge.challengeId;
            forgotChallengePrompt.value = challenge.challengePrompt;
          } catch (err) {
            forgotRequestError.value = (err as Error).message;
          } finally {
            forgotRequestSubmitting.value = false;
          }
        };

        const requestResetLink = async () => {
          forgotRequestSubmitting.value = true;
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
          try {
            await PasswordResetService.requestPasswordReset(
              forgotEmail.value.trim(),
              forgotChallengeId.value,
              forgotChallengeAnswer.value,
            );
            forgotRequestSuccess.value = true;
          } catch (err) {
            forgotRequestError.value = (err as Error).message;
          } finally {
            forgotRequestSubmitting.value = false;
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
          password,
          error,
          submitting,
          forgotMode,
          forgotEmail,
          forgotChallengeId,
          forgotChallengePrompt,
          forgotChallengeAnswer,
          forgotRequestSubmitting,
          forgotRequestError,
          forgotRequestSuccess,
          submit,
          openForgotMode,
          resetForgotMode,
          loadResetChallenge,
          requestResetLink,
          appVersion,
          theme,
          themeLabel,
          toggleTheme,
        };
      },
    }).mount('#login-app');
  }
}
