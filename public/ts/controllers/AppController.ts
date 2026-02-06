import { AuthService } from '../services/AuthService.js';
import { ReservationService } from '../services/ReservationService.js';
import { EventsService } from '../services/EventsService.js';
import { User } from '../entities/User.js';
import { Service } from '../entities/Service.js';
import { ServicesResponseDto } from '../dtos/ServicesResponseDto.js';
import { TimeHelper } from '../helpers/TimeHelper.js';
import { ThemeHelper, Theme } from '../helpers/ThemeHelper.js';
import { WorkspaceService } from '../services/WorkspaceService.js';
import { Workspace } from '../entities/Workspace.js';

export class AppController {
  private refreshTimer: number | null = null;
  private readonly eventsService = new EventsService();
  private readonly ownerFilterStorageKey = 'ownerFilter';
  private readonly workspaceFilterStorageKey = 'workspaceFilter';

  bootstrap(Vue: any): void {
    const { createApp, ref, computed, onMounted, watch } = Vue as {
      createApp: (options: Record<string, unknown>) => {
        mount: (selector: string) => void;
      };
      ref: <T>(value: T) => { value: T };
      computed: <T>(fn: () => T) => { value: T };
      onMounted: (fn: () => void | Promise<void>) => void;
      watch: <T>(source: { value: T }, cb: (value: T) => void) => void;
    };

    createApp({
      setup: () => {
        const user = ref<User | null>(null);
        const services = ref<Service[]>([]);
        const expiryWarningMinutes = ref(5);
        const autoRefreshMinutes = ref(2);
        const ownerFilter = ref(
          localStorage.getItem(this.ownerFilterStorageKey) || 'all',
        );
        const workspaceFilter = ref(
          localStorage.getItem(this.workspaceFilterStorageKey) || 'all',
        );
        const serviceNameFilter = ref('');
        const expandedOverrides = ref<Record<string, boolean>>({});
        const toastMessage = ref('');
        const toastVisible = ref(false);
        const isLoading = ref(true);
        const appVersion = ref('');
        const theme = ref(ThemeHelper.getInitialTheme() as Theme);
        const claimModalOpen = ref(false);
        const claimType = ref<'self' | 'team'>('self');
        const teamName = ref('');
        const teamNameError = ref('');
        const claimSubmitting = ref(false);
        const claimServiceKey = ref<string | null>(null);
        const currentView = ref<'overview' | 'availability' | 'admin'>(
          'overview',
        );
        const adminSection = ref<'workspace' | 'services' | 'users'>(
          'workspace',
        );
        const workspaces = ref<Workspace[]>([]);
        const workspaceName = ref('');
        const workspaceError = ref('');
        const workspaceSubmitting = ref(false);
        const inviteEmails = ref<Record<number, string>>({});
        const inviteErrors = ref<Record<number, string>>({});
        const inviteSubmitting = ref<Record<number, boolean>>({});
        const workspaceEnvironments = ref<
          Record<number, Array<{ environmentId: string; environmentName: string }>>
        >({});
        const workspaceOwners = ref<Record<number, string[]>>({});
        const workspaceServiceCatalog = ref<
          Record<
            number,
            Array<{
              serviceId: string;
              label: string;
              owner: string | null;
              defaultMinutes: number;
            }>
          >
        >({});
        const serviceForms = ref<
          Record<
            number,
            {
              environmentName: string;
              environmentMode: 'existing' | 'new';
              existingEnvironmentId: string;
              serviceMode: 'existing' | 'new';
              existingServiceId: string;
              label: string;
              defaultMinutes: number;
              owner: string;
              ownerMode: 'existing' | 'new';
              existingOwner: string;
            }
          >
        >({});
        const serviceErrors = ref<Record<number, string>>({});
        const serviceSubmitting = ref<Record<number, boolean>>({});
        const serviceFormVisible = ref<Record<number, boolean>>({});

        const normalizeOwner = (owner: string | null): string =>
          owner || 'unowned';

        const parsedServiceRegex = computed(() => {
          const raw = serviceNameFilter.value.trim();
          if (!raw) {
            return { regex: null as RegExp | null, error: '' };
          }
          try {
            return { regex: new RegExp(raw, 'i'), error: '' };
          } catch (err) {
            return { regex: null, error: (err as Error).message };
          }
        });

        const owners = computed(() => {
          const uniqueOwners = new Map<string, string>();
          services.value.forEach((svc) => {
            const ownerKey = normalizeOwner(svc.owner);
            if (!uniqueOwners.has(ownerKey)) {
              uniqueOwners.set(
                ownerKey,
                ownerKey === 'unowned' ? 'Unowned' : ownerKey,
              );
            }
          });
          return Array.from(uniqueOwners.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([value, label]) => ({ value, label }));
        });

        const workspaceOptions = computed(() => {
          const map = new Map<number, string>();
          workspaces.value.forEach((workspace) => {
            map.set(workspace.id, workspace.name);
          });
          services.value.forEach((service) => {
            if (!map.has(service.workspaceId)) {
              map.set(service.workspaceId, service.workspaceName);
            }
          });
          return Array.from(map.entries())
            .sort(([, a], [, b]) => a.localeCompare(b))
            .map(([id, name]) => ({ value: String(id), label: name }));
        });

        const filteredServices = computed(() => {
          let list = services.value;
          if (workspaceFilter.value !== 'all') {
            list = list.filter(
              (svc) => String(svc.workspaceId) === workspaceFilter.value,
            );
          }
          if (ownerFilter.value === 'all') {
            return list;
          }
          return list.filter(
            (svc) => normalizeOwner(svc.owner) === ownerFilter.value,
          );
        });

        const getExpandedState = (label: string, matches: boolean): boolean => {
          const override = expandedOverrides.value[label];
          if (typeof override === 'boolean') {
            return override;
          }
          return matches;
        };

        const inUseServices = computed(() =>
          filteredServices.value
            .filter((svc: Service) => svc.active)
            .sort((a: Service, b: Service) =>
              (a.expiresAt || '').localeCompare(b.expiresAt || ''),
            ),
        );

        const groupedServices = computed(() => {
          const map = new Map<string, Service[]>();
          filteredServices.value.forEach((svc: Service) => {
            const serviceLabel = svc.label;
            const groupKey = `${svc.workspaceId}:${serviceLabel}`;
            if (!map.has(groupKey)) {
              map.set(groupKey, []);
            }
            map.get(groupKey)?.push(svc);
          });
          const { regex } = parsedServiceRegex.value;
          const groups = Array.from(map.entries()).map(([key, items]) => {
            const serviceLabel = items[0]?.label || key;
            const ownerLabel = normalizeOwner(items[0]?.owner ?? null);
            const matches = regex ? regex.test(serviceLabel) : true;
            return {
              serviceLabel,
              ownerLabel,
              workspaceId: items[0]?.workspaceId ?? 0,
              workspaceName: items[0]?.workspaceName ?? 'Unknown',
              matches,
              expanded: getExpandedState(key, matches),
              services: items.sort((a, b) =>
                a.environment.localeCompare(b.environment),
              ),
              groupKey: key,
            };
          });

          const sortByOwner = (
            a: (typeof groups)[number],
            b: (typeof groups)[number],
          ) => {
            const workspaceCompare =
              a.workspaceName.localeCompare(b.workspaceName);
            if (workspaceCompare !== 0) {
              return workspaceCompare;
            }
            const ownerCompare = a.ownerLabel.localeCompare(b.ownerLabel);
            if (ownerCompare !== 0) {
              return ownerCompare;
            }
            return a.serviceLabel.localeCompare(b.serviceLabel);
          };

          const matched = groups
            .filter((group) => group.matches)
            .sort(sortByOwner);
          const unmatched = groups
            .filter((group) => !group.matches)
            .sort(sortByOwner);
          return matched.concat(unmatched);
        });

        const serviceNameFilterError = computed(
          () => parsedServiceRegex.value.error,
        );

        const adminWorkspaces = computed(() => {
          if (!user.value) {
            return [];
          }
          return workspaces.value.filter(
            (workspace) => workspace.adminUserId === user.value?.id,
          );
        });

        const workspaceServices = computed(() => {
          const map = new Map<number, Service[]>();
          workspaces.value.forEach((workspace) => {
            map.set(workspace.id, []);
          });
          services.value.forEach((service) => {
            const list = map.get(service.workspaceId);
            if (list) {
              list.push(service);
            }
          });
          map.forEach((list, id) => {
            list.sort((a, b) => a.label.localeCompare(b.label));
            map.set(id, list);
          });
          return map;
        });

        const claimedByUser = computed(() => {
          if (!user.value) {
            return [];
          }
          return services.value.filter(
            (service) => service.claimedById === user.value?.id,
          );
        });

        const totalServicesCount = computed(() => services.value.length);
        const claimedServicesCount = computed(
          () => services.value.filter((service) => service.active).length,
        );
        const availableServicesCount = computed(
          () => services.value.filter((service) => !service.active).length,
        );

        const showToast = (message: string) => {
          toastMessage.value = message;
          toastVisible.value = true;
          window.setTimeout(() => {
            toastVisible.value = false;
          }, 5000);
        };

        const applyTheme = (value: Theme) => {
          theme.value = value;
          ThemeHelper.applyTheme(value);
        };

        const toggleTheme = () => {
          applyTheme(theme.value === 'dark' ? 'light' : 'dark');
        };

        const themeLabel = computed(() => ThemeHelper.getLabel(theme.value));

        const applyServiceResponse = (data: ServicesResponseDto) => {
          services.value = data.services;
          expiryWarningMinutes.value = data.expiryWarningMinutes;
          autoRefreshMinutes.value = data.autoRefreshMinutes;

          const ownerKeys = new Set(owners.value.map((owner) => owner.value));
          if (
            ownerFilter.value !== 'all' &&
            !ownerKeys.has(ownerFilter.value)
          ) {
            ownerFilter.value = 'all';
          }

          const labels = new Set(
            data.services.map((svc) => `${svc.workspaceId}:${svc.label}`),
          );
          const nextOverrides: Record<string, boolean> = {};
          Object.entries(expandedOverrides.value).forEach(
            ([label, expanded]) => {
              if (labels.has(label)) {
                nextOverrides[label] = expanded;
              }
            },
          );
          expandedOverrides.value = nextOverrides;

          const availableWorkspaceIds = new Set<string>();
          workspaces.value.forEach((workspace) =>
            availableWorkspaceIds.add(String(workspace.id)),
          );
          services.value.forEach((service) =>
            availableWorkspaceIds.add(String(service.workspaceId)),
          );
          if (
            workspaceFilter.value !== 'all' &&
            !availableWorkspaceIds.has(workspaceFilter.value)
          ) {
            workspaceFilter.value = 'all';
          }
        };

        const loadUser = async () => {
          user.value = await AuthService.loadUser();
        };

        const loadWorkspaces = async () => {
          try {
            workspaces.value = await WorkspaceService.list();
            const nextForms = { ...serviceForms.value };
            workspaces.value.forEach((workspace) => {
              if (!nextForms[workspace.id]) {
                nextForms[workspace.id] = {
                  environmentName: '',
                  environmentMode: 'new',
                  existingEnvironmentId: '',
                  serviceMode: 'new',
                  existingServiceId: '',
                  label: '',
                  defaultMinutes: 60,
                  owner: '',
                  ownerMode: 'new',
                  existingOwner: '',
                };
              }
            });
            serviceForms.value = nextForms;
            const nextVisible = { ...serviceFormVisible.value };
            workspaces.value.forEach((workspace) => {
              if (typeof nextVisible[workspace.id] !== 'boolean') {
                nextVisible[workspace.id] = false;
              }
            });
            serviceFormVisible.value = nextVisible;
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const loadServices = async () => {
          try {
            const data = await ReservationService.loadServices();
            applyServiceResponse(data);
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const loadAppInfo = async () => {
          try {
            const response = await fetch('/api/app-info', {
              credentials: 'include',
            });
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

        const loadEnvironments = async (workspaceId: number) => {
          try {
            const environments =
              await WorkspaceService.listEnvironments(workspaceId);
            workspaceEnvironments.value = {
              ...workspaceEnvironments.value,
              [workspaceId]: environments,
            };
            const form = serviceForms.value[workspaceId];
            if (form && environments.length) {
              if (!form.existingEnvironmentId) {
                form.existingEnvironmentId = environments[0].environmentId;
              }
              if (form.environmentMode === 'new') {
                form.environmentMode = 'existing';
              }
            }
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const loadOwners = async (workspaceId: number) => {
          try {
            const owners = await WorkspaceService.listOwners(workspaceId);
            workspaceOwners.value = {
              ...workspaceOwners.value,
              [workspaceId]: owners,
            };
            const form = serviceForms.value[workspaceId];
            if (form && owners.length) {
              if (!form.existingOwner) {
                form.existingOwner = owners[0];
              }
              if (form.ownerMode === 'new') {
                form.ownerMode = 'existing';
              }
            }
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const loadServiceCatalog = async (workspaceId: number) => {
          try {
            const catalog =
              await WorkspaceService.listServiceCatalog(workspaceId);
            workspaceServiceCatalog.value = {
              ...workspaceServiceCatalog.value,
              [workspaceId]: catalog,
            };
            const form = serviceForms.value[workspaceId];
            if (form && catalog.length) {
              if (!form.existingServiceId) {
                form.existingServiceId = catalog[0].serviceId;
              }
              if (form.serviceMode === 'new') {
                form.serviceMode = 'existing';
              }
            }
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const resetClaimModal = () => {
          claimType.value = 'self';
          teamName.value = '';
          teamNameError.value = '';
          claimSubmitting.value = false;
          claimServiceKey.value = null;
        };

        const openClaimModal = (serviceKey: string) => {
          claimServiceKey.value = serviceKey;
          claimModalOpen.value = true;
        };

        const closeClaimModal = () => {
          claimModalOpen.value = false;
          resetClaimModal();
        };

        const submitClaim = async () => {
          if (!claimServiceKey.value) {
            return;
          }
          teamNameError.value = '';
          let teamLabel: string | null = null;
          if (claimType.value === 'team') {
            const trimmed = teamName.value.trim();
            if (!trimmed) {
              teamNameError.value = 'Team name is required.';
              return;
            }
            if (trimmed.length > 255) {
              teamNameError.value = 'Team name is too long.';
              return;
            }
            teamLabel = trimmed;
          }
          claimSubmitting.value = true;
          try {
            await ReservationService.claim(claimServiceKey.value, teamLabel);
            await loadServices();
            closeClaimModal();
            showToast('Service claimed.');
          } catch (err) {
            showToast((err as Error).message);
          } finally {
            claimSubmitting.value = false;
          }
        };

        const release = async (serviceKey: string) => {
          try {
            await ReservationService.release(serviceKey);
            await loadServices();
            showToast('Service released.');
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const extend = async (serviceKey: string) => {
          try {
            await ReservationService.extend(serviceKey);
            await loadServices();
            showToast('Service extended.');
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const logout = async () => {
          await AuthService.logout();
          localStorage.removeItem(this.ownerFilterStorageKey);
        };

        const createWorkspace = async () => {
          const trimmed = workspaceName.value.trim();
          workspaceError.value = '';
          if (!trimmed) {
            workspaceError.value = 'Workspace name is required.';
            return;
          }
          workspaceSubmitting.value = true;
          try {
            await WorkspaceService.create(trimmed);
            workspaceName.value = '';
            await loadWorkspaces();
            showToast('Workspace created.');
          } catch (err) {
            workspaceError.value = (err as Error).message;
          } finally {
            workspaceSubmitting.value = false;
          }
        };

        const inviteUser = async (workspaceId: number) => {
          const email = (inviteEmails.value[workspaceId] || '').trim();
          inviteErrors.value = { ...inviteErrors.value, [workspaceId]: '' };
          if (!email) {
            inviteErrors.value = {
              ...inviteErrors.value,
              [workspaceId]: 'Email is required.',
            };
            return;
          }
          inviteSubmitting.value = {
            ...inviteSubmitting.value,
            [workspaceId]: true,
          };
          try {
            await WorkspaceService.invite(workspaceId, email);
            inviteEmails.value = { ...inviteEmails.value, [workspaceId]: '' };
            showToast('Invitation sent.');
          } catch (err) {
            inviteErrors.value = {
              ...inviteErrors.value,
              [workspaceId]: (err as Error).message,
            };
          } finally {
            inviteSubmitting.value = {
              ...inviteSubmitting.value,
              [workspaceId]: false,
            };
          }
        };

        const createService = async (workspaceId: number | null) => {
          if (!workspaceId) {
            return;
          }
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return;
          }
          serviceErrors.value = { ...serviceErrors.value, [workspaceId]: '' };
          const resolvedEnvironment = resolveEnvironment(workspaceId);
          if (!resolvedEnvironment) {
            serviceErrors.value = {
              ...serviceErrors.value,
              [workspaceId]: 'Select or enter an environment.',
            };
            return;
          }
          const resolvedService = resolveServiceBase(workspaceId);
          if (!resolvedService) {
            serviceErrors.value = {
              ...serviceErrors.value,
              [workspaceId]: 'Select or create a service.',
            };
            return;
          }
          serviceSubmitting.value = {
            ...serviceSubmitting.value,
            [workspaceId]: true,
          };
          try {
            await WorkspaceService.createService(workspaceId, {
              environmentId: resolvedEnvironment.environmentId,
              environmentName: resolvedEnvironment.environmentName,
              serviceId: resolvedService.serviceId,
              label: resolvedService.label,
              defaultMinutes: resolvedService.defaultMinutes,
              owner: resolvedService.owner || '',
            });
            serviceForms.value = {
              ...serviceForms.value,
              [workspaceId]: {
                environmentName: '',
                environmentMode:
                  form.environmentMode === 'existing' ? 'existing' : 'new',
                existingEnvironmentId: form.existingEnvironmentId,
                serviceMode:
                  form.serviceMode === 'existing' ? 'existing' : 'new',
                existingServiceId: form.existingServiceId,
                label: '',
                defaultMinutes: form.defaultMinutes || 60,
                owner: '',
                ownerMode: form.ownerMode === 'existing' ? 'existing' : 'new',
                existingOwner: form.existingOwner,
              },
            };
            showToast('Service created.');
            await loadServices();
            await loadEnvironments(workspaceId);
            await loadOwners(workspaceId);
            await loadServiceCatalog(workspaceId);
            serviceFormVisible.value = {
              ...serviceFormVisible.value,
              [workspaceId]: false,
            };
          } catch (err) {
            serviceErrors.value = {
              ...serviceErrors.value,
              [workspaceId]: (err as Error).message,
            };
          } finally {
            serviceSubmitting.value = {
              ...serviceSubmitting.value,
              [workspaceId]: false,
            };
          }
        };

        const toggleGroup = (key: string) => {
          const current = groupedServices.value.find(
            (group) => group.groupKey === key,
          );
          if (!current) {
            return;
          }
          expandedOverrides.value = {
            ...expandedOverrides.value,
            [key]: !current.expanded,
          };
        };

        const refresh = async () => {
          await loadServices();
        };

        const resolveEnvironment = (
          workspaceId: number,
        ): { environmentId: string; environmentName: string } | null => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return null;
          }
          if (form.environmentMode === 'existing') {
            const environments = workspaceEnvironments.value[workspaceId] || [];
            const selected = environments.find(
              (env) => env.environmentId === form.existingEnvironmentId,
            );
            if (!selected) {
              return null;
            }
            return {
              environmentId: selected.environmentId,
              environmentName: selected.environmentName,
            };
          }
          const environmentName = form.environmentName.trim();
          if (!environmentName) {
            return null;
          }
          return {
            environmentId: '',
            environmentName,
          };
        };

        const resolveOwner = (workspaceId: number): string | null => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return null;
          }
          if (form.ownerMode === 'existing') {
            return form.existingOwner || null;
          }
          const owner = form.owner.trim();
          return owner.length ? owner : null;
        };

        const resolveServiceBase = (
          workspaceId: number,
        ): {
          serviceId: string;
          label: string;
          owner: string | null;
          defaultMinutes: number;
        } | null => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return null;
          }
          if (form.serviceMode === 'existing') {
            const catalog = workspaceServiceCatalog.value[workspaceId] || [];
            const selected = catalog.find(
              (svc) => svc.serviceId === form.existingServiceId,
            );
            if (!selected) {
              return null;
            }
            return {
              serviceId: selected.serviceId,
              label: selected.label,
              owner: selected.owner,
              defaultMinutes: selected.defaultMinutes,
            };
          }
          const resolvedOwner = resolveOwner(workspaceId);
          return {
            serviceId: '',
            label: form.label.trim(),
            owner: resolvedOwner,
            defaultMinutes: Number(form.defaultMinutes),
          };
        };

        const setView = (view: 'overview' | 'availability' | 'admin') => {
          currentView.value = view;
        };

        const setAdminSection = (
          section: 'workspace' | 'services' | 'users',
        ) => {
          adminSection.value = section;
        };

        const toggleServiceForm = (workspaceId: number) => {
          serviceFormVisible.value = {
            ...serviceFormVisible.value,
            [workspaceId]: !serviceFormVisible.value[workspaceId],
          };
          if (serviceFormVisible.value[workspaceId]) {
            loadEnvironments(workspaceId);
            loadOwners(workspaceId);
            loadServiceCatalog(workspaceId);
          }
        };

        const deleteService = async (service: Service) => {
          try {
            await WorkspaceService.deleteService(
              service.workspaceId,
              service.key,
            );
            showToast('Service deleted.');
            await loadServices();
            await loadEnvironments(service.workspaceId);
            await loadOwners(service.workspaceId);
            await loadServiceCatalog(service.workspaceId);
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const formatClaimedBy = (service: Service): string => {
          if (!service.claimedBy) {
            return 'Unknown';
          }
          return service.claimedByTeam
            ? `${service.claimedBy} (team)`
            : service.claimedBy;
        };

        const scheduleAutoRefresh = () => {
          if (this.refreshTimer) {
            window.clearTimeout(this.refreshTimer);
          }
          const intervalMinutes = Math.max(autoRefreshMinutes.value || 1, 1);
          this.refreshTimer = window.setTimeout(async () => {
            await loadServices();
            scheduleAutoRefresh();
          }, intervalMinutes * 60000);
        };

        const initEvents = () => {
          this.eventsService.start((data) => {
            const message = `${data.environment} / ${data.service_name} expires in ${data.minutes_left} minute(s). Extend?`;
            if (confirm(message)) {
              extend(data.service_key);
            }
          });
        };

        onMounted(async () => {
          applyTheme(theme.value);
          try {
            await loadUser();
            await loadWorkspaces();
            await loadServices();
            await loadAppInfo();
            initEvents();
            scheduleAutoRefresh();
          } finally {
            isLoading.value = false;
          }
        });

        watch(ownerFilter, (value) => {
          localStorage.setItem(this.ownerFilterStorageKey, value);
        });

        watch(workspaceFilter, (value) => {
          localStorage.setItem(this.workspaceFilterStorageKey, value);
        });

        watch(serviceNameFilter, () => {
          expandedOverrides.value = {};
        });

        watch(claimType, () => {
          teamNameError.value = '';
        });

        return {
          user,
          services,
          inUseServices,
          groupedServices,
          ownerFilter,
          workspaceFilter,
          owners,
          workspaceOptions,
          serviceNameFilter,
          serviceNameFilterError,
          toggleGroup,
          toastMessage,
          toastVisible,
          isLoading,
          appVersion,
          theme,
          themeLabel,
          toggleTheme,
          formatTime: TimeHelper.formatTime,
          formatClaimedBy,
          claimModalOpen,
          claimType,
          teamName,
          teamNameError,
          claimSubmitting,
          openClaimModal,
          closeClaimModal,
          submitClaim,
          release,
          extend,
          refresh,
          logout,
          currentView,
          adminSection,
          setView,
          setAdminSection,
          workspaces,
          adminWorkspaces,
          claimedByUser,
          totalServicesCount,
          claimedServicesCount,
          availableServicesCount,
          workspaceName,
          workspaceError,
          workspaceSubmitting,
          inviteEmails,
          inviteErrors,
          inviteSubmitting,
          createWorkspace,
          inviteUser,
          workspaceEnvironments,
          workspaceOwners,
          workspaceServiceCatalog,
          workspaceServices,
          serviceFormVisible,
          serviceForms,
          serviceErrors,
          serviceSubmitting,
          toggleServiceForm,
          deleteService,
          createService,
        };
      },
    }).mount('#app');
  }
}
