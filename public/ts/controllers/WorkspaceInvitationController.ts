import { ThemeHelper, Theme } from '../helpers/ThemeHelper.js';
import { WorkspaceService } from '../services/WorkspaceService.js';

export class WorkspaceInvitationController {
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
        const theme = ref(ThemeHelper.getInitialTheme() as Theme);
        const code = window.location.pathname.split('/').pop() || '';
        const loading = ref(true);
        const accepting = ref(false);
        const error = ref('');
        const status = ref('');
        const invitedEmail = ref('');
        const existingUserInvite = ref(false);
        const accepted = ref(false);
        const appVersion = ref('');

        const applyTheme = (value: Theme) => {
          theme.value = value;
          ThemeHelper.applyTheme(value);
        };

        const toggleTheme = () => {
          applyTheme(theme.value === 'dark' ? 'light' : 'dark');
        };

        const themeLabel = computed(() => ThemeHelper.getLabel(theme.value));
        const isValidExistingInvite = computed(
          () => status.value === 'valid' && existingUserInvite.value,
        );
        const isUnregisteredInvite = computed(
          () => status.value === 'unregistered',
        );

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

        const validateInvitation = async () => {
          loading.value = true;
          error.value = '';
          try {
            const result = await WorkspaceService.validateInvitation(code);
            status.value = result.status;
            existingUserInvite.value = result.existingUserInvite;
            invitedEmail.value = result.invitation?.invitedEmail || '';
            if (result.status === 'invalid' || result.status === 'used') {
              error.value = 'Invalid invitation link.';
            }
            if (result.status === 'expired') {
              error.value = 'Invitation link expired.';
            }
            if (result.status === 'wrong_user') {
              error.value = 'This invitation belongs to another account.';
            }
          } catch (err) {
            error.value = (err as Error).message;
          } finally {
            loading.value = false;
          }
        };

        const acceptInvitation = async () => {
          accepting.value = true;
          error.value = '';
          try {
            await WorkspaceService.acceptInvitation(code);
            accepted.value = true;
          } catch (err) {
            error.value = (err as Error).message;
          } finally {
            accepting.value = false;
          }
        };

        const registerInvitedAccount = () => {
          const params = new URLSearchParams({
            invitation_code: code,
            email: invitedEmail.value,
          });
          window.location.assign(`/register?${params.toString()}`);
        };

        const goLogin = () => {
          const params = new URLSearchParams({ invitation_code: code });
          window.location.assign(`/login?${params.toString()}`);
        };

        const showDashboard = () => {
          window.location.assign('/overview');
        };

        onMounted(async () => {
          applyTheme(theme.value);
          await validateInvitation();
          await loadAppInfo();
        });

        return {
          theme,
          themeLabel,
          toggleTheme,
          loading,
          accepting,
          error,
          status,
          invitedEmail,
          accepted,
          appVersion,
          isValidExistingInvite,
          isUnregisteredInvite,
          acceptInvitation,
          registerInvitedAccount,
          goLogin,
          showDashboard,
        };
      },
    }).mount('#workspace-invitation-app');
  }
}
