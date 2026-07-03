import { LoginService } from '../services/LoginService.js';
import { PasswordResetService } from '../services/PasswordResetService.js';
import { RegistrationService } from '../services/RegistrationService.js';
import { ThemeHelper, Theme } from '../helpers/ThemeHelper.js';

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityServices = {
  accounts?: {
    id?: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: Record<string, string | number | boolean>,
      ) => void;
    };
  };
};

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
        const googleAuthEnabled = ref(false);
        const googleAuthClientId = ref('');
        const googleAuthError = ref('');
        const googleAuthSubmitting = ref(false);
        const googleScriptLoaded = ref(false);
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
          googleAuthError.value = '';
          renderGoogleButtonSoon();
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
          googleAuthError.value = '';
          renderGoogleButtonSoon();
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
            const data = (await response.json()) as {
              version?: string;
              google_auth_enabled?: boolean;
              google_auth_client_id?: string;
            };
            appVersion.value =
              typeof data.version === 'string' ? data.version : '';
            googleAuthEnabled.value = data.google_auth_enabled === true;
            googleAuthClientId.value =
              typeof data.google_auth_client_id === 'string'
                ? data.google_auth_client_id
                : '';
            if (googleAuthEnabled.value && googleAuthClientId.value) {
              await loadGoogleScript();
              initializeGoogleAuth();
              renderGoogleButtonSoon();
            }
          } catch {
            appVersion.value = '';
            googleAuthEnabled.value = false;
            googleAuthClientId.value = '';
          }
        };

        const readCookie = (name: string): string => {
          const prefix = `${name}=`;
          const cookie = (document.cookie || '')
            .split(';')
            .map((entry) => entry.trim())
            .find((entry) => entry.startsWith(prefix));
          return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
        };

        const loadGoogleScript = async (): Promise<void> => {
          if (googleScriptLoaded.value) {
            return;
          }
          if ((window as unknown as { google?: GoogleIdentityServices }).google) {
            googleScriptLoaded.value = true;
            return;
          }
          if (
            typeof document.querySelector !== 'function' ||
            typeof document.createElement !== 'function' ||
            !document.head
          ) {
            googleScriptLoaded.value = true;
            return;
          }
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector(
              'script[data-google-identity-services="true"]',
            );
            if (existing) {
              existing.addEventListener('load', () => resolve(), {
                once: true,
              });
              existing.addEventListener('error', () => reject(), {
                once: true,
              });
              return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.dataset.googleIdentityServices = 'true';
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => reject(), { once: true });
            document.head.appendChild(script);
          });
          googleScriptLoaded.value = true;
        };

        const initializeGoogleAuth = () => {
          const google = (window as unknown as { google?: GoogleIdentityServices })
            .google;
          google?.accounts?.id?.initialize({
            client_id: googleAuthClientId.value,
            callback: (response: GoogleCredentialResponse) => {
              void handleGoogleCredential(response);
            },
          });
        };

        const renderGoogleButtonSoon = () => {
          window.setTimeout(() => {
            renderGoogleButton();
          }, 0);
        };

        const renderGoogleButton = () => {
          if (!googleAuthEnabled.value || !googleAuthClientId.value) {
            return;
          }
          if (
            typeof window === 'undefined' ||
            typeof document === 'undefined' ||
            typeof document.getElementById !== 'function'
          ) {
            return;
          }
          const google = (window as unknown as { google?: GoogleIdentityServices })
            .google;
          const containerId =
            mode.value === 'register'
              ? 'google-register-button'
              : 'google-login-button';
          const container = document.getElementById(containerId);
          if (!container || !google?.accounts?.id?.renderButton) {
            return;
          }
          container.innerHTML = '';
          google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            width: container.clientWidth || 280,
            text: mode.value === 'register' ? 'signup_with' : 'signin_with',
          });
        };

        const handleGoogleCredential = async (
          response: GoogleCredentialResponse,
        ) => {
          googleAuthError.value = '';
          googleAuthSubmitting.value = true;
          try {
            await LoginService.loginWithGoogle({
              credential: response.credential || '',
              g_csrf_token: readCookie('g_csrf_token'),
              invitation_code:
                mode.value === 'register'
                  ? invitationCode.value || undefined
                  : loginInvitationCode.value || undefined,
            });
            if (loginInvitationCode.value && mode.value !== 'register') {
              window.sessionStorage?.setItem(
                'workspace_invitation_pending_accept_code',
                loginInvitationCode.value,
              );
            }
            window.location.replace('/overview');
          } catch (err) {
            googleAuthError.value = (err as Error).message;
          } finally {
            googleAuthSubmitting.value = false;
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
          googleAuthEnabled,
          googleAuthClientId,
          googleAuthError,
          googleAuthSubmitting,
          theme,
          themeLabel,
          toggleTheme,
        };
      },
    }).mount('#login-app');
  }
}
