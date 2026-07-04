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

type RecaptchaApi = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
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
        const mode = ref<'login' | 'emailLogin' | 'register' | 'forgot'>(
          initialMode,
        );
        const registerEmail = ref('');
        const registerNickname = ref('');
        const registerPassword = ref('');
        const registerConfirmPassword = ref('');
        const registerRequestSubmitting = ref(false);
        const registerRequestError = ref('');
        const registerRequestSuccess = ref(false);
        const invitationCode = ref('');
        const loginInvitationCode = ref('');
        const invitationEmailLocked = ref(false);
        const forgotEmail = ref('');
        const forgotRequestSubmitting = ref(false);
        const forgotRequestError = ref('');
        const forgotRequestSuccess = ref(false);
        const appVersion = ref('');
        const googleAuthEnabled = ref(false);
        const googleAuthClientId = ref('');
        const googleAuthError = ref('');
        const googleAuthSubmitting = ref(false);
        const googleScriptLoaded = ref(false);
        const recaptchaEnabled = ref(false);
        const recaptchaSiteKey = ref('');
        const recaptchaScriptLoaded = ref(false);
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

        const openEmailLoginMode = () => {
          if (window.location.pathname === '/register') {
            window.history.pushState({}, '', '/login');
          }
          mode.value = 'emailLogin';
          error.value = '';
          googleAuthError.value = '';
        };

        const openForgotMode = () => {
          if (window.location.pathname === '/register') {
            window.history.pushState({}, '', '/login');
          }
          mode.value = 'forgot';
          forgotEmail.value = email.value;
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
        };

        const resetForgotMode = () => {
          mode.value = 'login';
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
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
          registerRequestError.value = '';
          registerRequestSuccess.value = false;
          error.value = '';
          googleAuthError.value = '';
          renderGoogleButtonSoon();
        };

        const resetForgotChallenge = () => {
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
        };

        const resetRegisterChallenge = () => {
          registerRequestError.value = '';
          registerRequestSuccess.value = false;
        };

        const requestResetLink = async () => {
          forgotRequestSubmitting.value = true;
          forgotRequestError.value = '';
          forgotRequestSuccess.value = false;
          try {
            const recaptchaToken = await executeRecaptcha(
              'password_reset_request',
            );
            await PasswordResetService.requestPasswordReset(
              forgotEmail.value.trim(),
              recaptchaToken,
            );
            forgotRequestSuccess.value = true;
          } catch (err) {
            forgotRequestError.value = (err as Error).message;
          } finally {
            forgotRequestSubmitting.value = false;
          }
        };

        const isValidEmail = (value: string): boolean =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

        const validateRegisterRequest = (): string => {
          const trimmedEmail = registerEmail.value.trim();
          const trimmedNickname = registerNickname.value.trim();
          if (!trimmedEmail) {
            return 'Email required';
          }
          if (!isValidEmail(trimmedEmail)) {
            return 'Invalid email';
          }
          if (!trimmedNickname) {
            return 'Nickname required';
          }
          if (!registerPassword.value) {
            return 'Password required';
          }
          if (registerPassword.value.length < 8) {
            return 'Password is too short';
          }
          if (!registerConfirmPassword.value) {
            return 'Password confirmation required';
          }
          if (registerPassword.value !== registerConfirmPassword.value) {
            return 'Password confirmation does not match';
          }
          return '';
        };

        const register = async () => {
          registerRequestError.value = '';
          registerRequestSuccess.value = false;
          const validationError = validateRegisterRequest();
          if (validationError) {
            registerRequestError.value = validationError;
            return;
          }
          registerRequestSubmitting.value = true;
          try {
            const recaptchaToken = await executeRecaptcha('register');
            await RegistrationService.register({
              email: registerEmail.value.trim(),
              nickname: registerNickname.value.trim(),
              password: registerPassword.value,
              confirm_password: registerConfirmPassword.value,
              recaptcha_token: recaptchaToken,
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
        const isEmailLoginMode = computed(() => mode.value === 'emailLogin');
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
          if (mode.value === 'emailLogin') {
            return 'Sign in with email';
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
              recaptcha_enabled?: boolean;
              recaptcha_site_key?: string;
            };
            appVersion.value =
              typeof data.version === 'string' ? data.version : '';
            googleAuthEnabled.value = data.google_auth_enabled === true;
            googleAuthClientId.value =
              typeof data.google_auth_client_id === 'string'
                ? data.google_auth_client_id
                : '';
            recaptchaEnabled.value = data.recaptcha_enabled === true;
            recaptchaSiteKey.value =
              typeof data.recaptcha_site_key === 'string'
                ? data.recaptcha_site_key
                : '';
            if (googleAuthEnabled.value && googleAuthClientId.value) {
              ensureGoogleCsrfToken();
              await loadGoogleScript();
              initializeGoogleAuth();
              renderGoogleButtonSoon();
            }
            if (recaptchaEnabled.value && recaptchaSiteKey.value) {
              await loadRecaptchaScript();
            }
          } catch {
            appVersion.value = '';
            googleAuthEnabled.value = false;
            googleAuthClientId.value = '';
            recaptchaEnabled.value = false;
            recaptchaSiteKey.value = '';
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

        const createCsrfToken = (): string => {
          const bytes = new Uint8Array(24);
          if (window.crypto?.getRandomValues) {
            window.crypto.getRandomValues(bytes);
            return Array.from(bytes, (byte) =>
              byte.toString(16).padStart(2, '0'),
            ).join('');
          }
          return `${Date.now()}-${Math.random()}`;
        };

        const ensureGoogleCsrfToken = (): string => {
          const existing = readCookie('g_csrf_token');
          if (existing) {
            return existing;
          }

          const token = createCsrfToken();
          const secure = window.location.protocol === 'https:' ? '; Secure' : '';
          document.cookie = `g_csrf_token=${encodeURIComponent(
            token,
          )}; Path=/; SameSite=Lax${secure}`;
          return token;
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

        const loadRecaptchaScript = async (): Promise<void> => {
          if (recaptchaScriptLoaded.value) {
            return;
          }
          if ((window as unknown as { grecaptcha?: RecaptchaApi }).grecaptcha) {
            recaptchaScriptLoaded.value = true;
            return;
          }
          if (
            typeof document.querySelector !== 'function' ||
            typeof document.createElement !== 'function' ||
            !document.head
          ) {
            recaptchaScriptLoaded.value = true;
            return;
          }
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector(
              'script[data-google-recaptcha="true"]',
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
            script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(
              recaptchaSiteKey.value,
            )}`;
            script.async = true;
            script.defer = true;
            script.dataset.googleRecaptcha = 'true';
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => reject(), { once: true });
            document.head.appendChild(script);
          });
          recaptchaScriptLoaded.value = true;
        };

        const executeRecaptcha = async (action: string): Promise<string> => {
          if (!recaptchaEnabled.value || !recaptchaSiteKey.value) {
            throw new Error('Captcha is not configured.');
          }
          await loadRecaptchaScript();
          const grecaptcha = (window as unknown as { grecaptcha?: RecaptchaApi })
            .grecaptcha;
          if (!grecaptcha?.execute || !grecaptcha.ready) {
            throw new Error('Captcha is unavailable.');
          }
          await new Promise<void>((resolve) => {
            grecaptcha.ready(() => resolve());
          });
          const token = await grecaptcha.execute(recaptchaSiteKey.value, {
            action,
          });
          if (!token) {
            throw new Error('Captcha is unavailable.');
          }
          return token;
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
              g_csrf_token: ensureGoogleCsrfToken(),
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
          isEmailLoginMode,
          isForgotMode,
          isRegisterModeComputed,
          registerModeTitle,
          registerEmail,
          registerNickname,
          registerPassword,
          registerConfirmPassword,
          registerRequestSubmitting,
          registerRequestError,
          registerRequestSuccess,
          invitationEmailLocked,
          forgotEmail,
          forgotRequestSubmitting,
          forgotRequestError,
          forgotRequestSuccess,
          submit,
          openEmailLoginMode,
          openForgotMode,
          openLoginMode,
          openRegisterMode,
          resetForgotMode,
          resetForgotChallenge,
          resetRegisterChallenge,
          requestResetLink,
          register,
          appVersion,
          googleAuthEnabled,
          googleAuthClientId,
          googleAuthError,
          googleAuthSubmitting,
          recaptchaEnabled,
          theme,
          themeLabel,
          toggleTheme,
        };
      },
    }).mount('#login-app');
  }
}
