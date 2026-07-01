import { LoginService } from '../services/LoginService.js';
import { PasswordResetService } from '../services/PasswordResetService.js';
import { RegistrationService } from '../services/RegistrationService.js';
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
        const initialMode =
          window.location.pathname === '/register' ? 'register' : 'login';
        const mode = ref<'login' | 'register' | 'forgot'>(initialMode);
        const registerEmail = ref('');
        const registerNickname = ref('');
        const registerPassword = ref('');
        const registerConfirmPassword = ref('');
        const registerChallengeId = ref('');
        const registerChallengePrompt = ref('');
        const registerChallengeAnswer = ref('');
        const registerRequestSubmitting = ref(false);
        const registerRequestError = ref('');
        const registerRequestSuccess = ref(false);
        const invitationCode = ref('');
        const loginInvitationCode = ref('');
        const invitationEmailLocked = ref(false);
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
            if (loginInvitationCode.value) {
              window.sessionStorage?.setItem(
                'workspace_invitation_pending_accept_code',
                loginInvitationCode.value,
              );
              window.location.replace('/overview');
              return;
            }
            window.location.replace('/overview');
          } catch (err) {
            error.value = (err as Error).message;
          } finally {
            submitting.value = false;
          }
        };

        const openLoginMode = () => {
          if (window.location.pathname === '/register') {
            window.history.pushState({}, '', '/login');
          }
          mode.value = 'login';
          error.value = '';
        };

        const openForgotMode = () => {
          if (window.location.pathname === '/register') {
            window.history.pushState({}, '', '/login');
          }
          mode.value = 'forgot';
          forgotEmail.value = email.value;
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
          forgotChallengeId.value = '';
          forgotChallengePrompt.value = '';
          forgotChallengeAnswer.value = '';
        };

        const resetForgotMode = () => {
          mode.value = 'login';
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
          forgotChallengeId.value = '';
          forgotChallengePrompt.value = '';
          forgotChallengeAnswer.value = '';
        };

        const openRegisterMode = () => {
          if (window.location.pathname !== '/register') {
            window.history.pushState({}, '', '/register');
          }
          mode.value = 'register';
          if (!invitationEmailLocked.value) {
            registerEmail.value = '';
          }
          registerNickname.value = '';
          registerPassword.value = '';
          registerConfirmPassword.value = '';
          registerChallengeId.value = '';
          registerChallengePrompt.value = '';
          registerChallengeAnswer.value = '';
          registerRequestError.value = '';
          registerRequestSuccess.value = false;
          error.value = '';
        };

        const loadResetChallenge = async () => {
          forgotRequestSubmitting.value = true;
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
          try {
            const challenge = await PasswordResetService.requestChallenge();
            forgotChallengeId.value = challenge.challengeId;
            forgotChallengePrompt.value = challenge.challengePrompt;
            forgotChallengeAnswer.value = '';
          } catch (err) {
            forgotRequestError.value = (err as Error).message;
          } finally {
            forgotRequestSubmitting.value = false;
          }
        };

        const resetForgotChallenge = () => {
          if (!forgotChallengePrompt.value && !forgotChallengeId.value) {
            return;
          }
          forgotChallengeId.value = '';
          forgotChallengePrompt.value = '';
          forgotChallengeAnswer.value = '';
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
        };

        const loadRegisterChallenge = async () => {
          registerRequestSubmitting.value = true;
          registerRequestError.value = '';
          registerRequestSuccess.value = false;
          try {
            const challenge = await RegistrationService.requestChallenge();
            registerChallengeId.value = challenge.challengeId;
            registerChallengePrompt.value = challenge.challengePrompt;
            registerChallengeAnswer.value = '';
          } catch (err) {
            registerRequestError.value = (err as Error).message;
          } finally {
            registerRequestSubmitting.value = false;
          }
        };

        const resetRegisterChallenge = () => {
          if (!registerChallengePrompt.value && !registerChallengeId.value) {
            return;
          }
          registerChallengeId.value = '';
          registerChallengePrompt.value = '';
          registerChallengeAnswer.value = '';
          registerRequestError.value = '';
          registerRequestSuccess.value = false;
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

        const register = async () => {
          registerRequestError.value = '';
          registerRequestSuccess.value = false;
          registerRequestSubmitting.value = true;
          try {
            await RegistrationService.register({
              email: registerEmail.value.trim(),
              nickname: registerNickname.value.trim(),
              password: registerPassword.value,
              confirm_password: registerConfirmPassword.value,
              challenge_id: registerChallengeId.value,
              challenge_answer: registerChallengeAnswer.value,
              invitation_code: invitationCode.value || undefined,
            });
            registerRequestSuccess.value = true;
            window.location.replace('/overview');
          } catch (err) {
            registerRequestError.value = (err as Error).message;
          } finally {
            registerRequestSubmitting.value = false;
          }
        };

        const isLoginMode = computed(() => mode.value === 'login');
        const isForgotMode = computed(() => mode.value === 'forgot');
        const isRegisterModeComputed = computed(
          () => mode.value === 'register',
        );

        const registerModeTitle = computed(() => {
          if (mode.value === 'register') {
            return 'Register';
          }
          if (mode.value === 'forgot') {
            return 'Reset password';
          }
          return 'Sign in';
        });

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
          const params = new URLSearchParams(window.location.search);
          const queryInvitationCode = params.get('invitation_code') || '';
          const queryEmail = params.get('email') || '';
          const hasInvitationHandoff =
            window.location.pathname === '/login' &&
            params.get('invitation_handoff') === '1';
          if (queryInvitationCode) {
            invitationCode.value = queryInvitationCode;
            mode.value = 'register';
            if (queryEmail) {
              registerEmail.value = queryEmail;
              invitationEmailLocked.value = true;
            }
          }
          if (hasInvitationHandoff) {
            const storedInvitationCode =
              window.sessionStorage?.getItem(
                'workspace_invitation_login_code',
              ) || '';
            loginInvitationCode.value = storedInvitationCode;
          }
          await loadAppInfo();
        });

        return {
          email,
          password,
          error,
          submitting,
          mode,
          isLoginMode,
          isForgotMode,
          isRegisterModeComputed,
          registerModeTitle,
          registerEmail,
          registerNickname,
          registerPassword,
          registerConfirmPassword,
          registerChallengeId,
          registerChallengePrompt,
          registerChallengeAnswer,
          registerRequestSubmitting,
          registerRequestError,
          registerRequestSuccess,
          invitationEmailLocked,
          forgotEmail,
          forgotChallengeId,
          forgotChallengePrompt,
          forgotChallengeAnswer,
          forgotRequestSubmitting,
          forgotRequestError,
          forgotRequestSuccess,
          submit,
          openForgotMode,
          openLoginMode,
          openRegisterMode,
          resetForgotMode,
          resetForgotChallenge,
          loadRegisterChallenge,
          resetRegisterChallenge,
          loadResetChallenge,
          requestResetLink,
          register,
          appVersion,
          theme,
          themeLabel,
          toggleTheme,
        };
      },
    }).mount('#login-app');
  }
}
