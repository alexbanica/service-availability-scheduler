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
              environments: Array<{ environmentId: string; environmentName: string }>;
            }>
          >
        >({});
        const serviceForms = ref<
          Record<
            number,
            {
              environmentInput: string;
              environmentTags: string[];
              serviceLabel: string;
              defaultMinutes: number;
              owner: string;
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
          if (ownerFilter.value !== 'all') {
            list = list.filter(
              (svc) => normalizeOwner(svc.owner) === ownerFilter.value,
            );
          }
          const { regex } = parsedServiceRegex.value;
          if (!regex) {
            return list;
          }
          return list.filter((svc) => regex.test(svc.label));
        });

        const getExpandedState = (label: string, matches: boolean): boolean => {
          const override = expandedOverrides.value[label];
          if (typeof override === 'boolean') {
            return override;
          }
          return matches;
        };

        const inUseServices = computed(() => {
          const envs = filteredServices.value.flatMap((svc) =>
            svc.environments.map((env) => ({
              service: svc,
              environment: env,
            })),
          );
          return envs
            .filter((item) => item.environment.active)
            .sort((a, b) =>
              (a.environment.expiresAt || '').localeCompare(
                b.environment.expiresAt || '',
              ),
            );
        });

        const groupedServices = computed(() => {
          const groups = filteredServices.value.map((svc) => ({
            serviceId: svc.serviceId,
            serviceLabel: svc.label,
            ownerLabel: normalizeOwner(svc.owner),
            workspaceId: svc.workspaceId,
            workspaceName: svc.workspaceName,
            expanded: getExpandedState(svc.serviceId, true),
            environments: [...svc.environments].sort((a, b) =>
              a.environment.localeCompare(b.environment),
            ),
          }));
          return groups.sort((a, b) => {
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
          });
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


        const claimedByUser = computed(() => {
          if (!user.value) {
            return [];
          }
          return services.value.flatMap((service) =>
            service.environments
              .filter((env) => env.claimedById === user.value?.id)
              .map((env) => ({ service, environment: env })),
          );
        });

        const totalServicesCount = computed(() => services.value.length);
        const claimedServicesCount = computed(
          () =>
            services.value.reduce(
              (total, service) =>
                total +
                service.environments.filter((env) => env.active).length,
              0,
            ),
        );
        const availableServicesCount = computed(
          () =>
            services.value.reduce(
              (total, service) =>
                total +
                service.environments.filter((env) => !env.active).length,
              0,
            ),
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

          const labels = new Set(data.services.map((svc) => svc.serviceId));
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
                  environmentInput: '',
                  environmentTags: [],
                  serviceLabel: '',
                  defaultMinutes: 60,
                  owner: '',
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
          commitEnvironmentInput(workspaceId);
          const environments = resolveEnvironments(workspaceId);
          if (!environments.length) {
            serviceErrors.value = {
              ...serviceErrors.value,
              [workspaceId]: 'Add at least one environment.',
            };
            return;
          }
          const serviceLabel = form.serviceLabel.trim();
          if (!serviceLabel) {
            serviceErrors.value = {
              ...serviceErrors.value,
              [workspaceId]: 'Service name is required.',
            };
            return;
          }
          const selectedService = getServiceSelection(workspaceId);
          if (!selectedService) {
            const minutes = Number(form.defaultMinutes);
            if (!Number.isFinite(minutes) || minutes <= 0) {
              serviceErrors.value = {
                ...serviceErrors.value,
                [workspaceId]: 'Default minutes must be positive.',
              };
              return;
            }
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
              environmentNames: environments,
              serviceId: resolvedService.serviceId,
              label: resolvedService.label,
              defaultMinutes: resolvedService.defaultMinutes,
              owner: resolvedService.owner || '',
            });
            serviceForms.value = {
              ...serviceForms.value,
              [workspaceId]: {
                environmentInput: '',
                environmentTags: [],
                serviceLabel: '',
                defaultMinutes: form.defaultMinutes || 60,
                owner: '',
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
            (group) => group.serviceId === key,
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

        const normalizeTag = (value: string): string => value.trim();

        const extractEnvironmentTags = (
          raw: string,
        ): { tags: string[]; remainder: string } => {
          if (!/[,\s]/.test(raw)) {
            return { tags: [], remainder: raw };
          }
          const endsWithSeparator = /[,\s]$/.test(raw);
          const parts = raw.split(/[,\s]+/);
          const remainder = endsWithSeparator ? '' : parts.pop() || '';
          const tags = parts
            .map((part) => normalizeTag(part))
            .filter((part) => part.length > 0);
          return { tags, remainder };
        };

        const addEnvironmentTags = (workspaceId: number, raw: string) => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return;
          }
          const parts = raw
            .split(/[,\s]+/)
            .map((part) => normalizeTag(part))
            .filter((part) => part.length > 0);
          if (!parts.length) {
            return;
          }
          const existing = new Set(
            form.environmentTags.map((tag) => tag.toLowerCase()),
          );
          const nextTags = [...form.environmentTags];
          parts.forEach((part) => {
            if (!existing.has(part.toLowerCase())) {
              existing.add(part.toLowerCase());
              nextTags.push(part);
            }
          });
          serviceForms.value = {
            ...serviceForms.value,
            [workspaceId]: {
              ...form,
              environmentTags: nextTags,
            },
          };
        };

        const commitEnvironmentInput = (workspaceId: number) => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return;
          }
          const raw = form.environmentInput;
          addEnvironmentTags(workspaceId, raw);
          serviceForms.value = {
            ...serviceForms.value,
            [workspaceId]: {
              ...form,
              environmentInput: '',
            },
          };
        };

        const removeEnvironmentTag = (workspaceId: number, tag: string) => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return;
          }
          serviceForms.value = {
            ...serviceForms.value,
            [workspaceId]: {
              ...form,
              environmentTags: form.environmentTags.filter(
                (existing) => existing !== tag,
              ),
            },
          };
        };

        const handleEnvironmentInput = (workspaceId: number) => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return;
          }
          const raw = form.environmentInput;
          const { tags, remainder } = extractEnvironmentTags(raw);
          if (!tags.length) {
            return;
          }
          addEnvironmentTags(workspaceId, tags.join(','));
          serviceForms.value = {
            ...serviceForms.value,
            [workspaceId]: {
              ...form,
              environmentInput: remainder.trimStart(),
            },
          };
        };

        const onEnvironmentKeydown = (
          workspaceId: number,
          event: KeyboardEvent,
        ) => {
          if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
            event.preventDefault();
            commitEnvironmentInput(workspaceId);
          }
        };

        const resolveEnvironments = (workspaceId: number): string[] => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return [];
          }
          const tags = form.environmentTags
            .map((tag) => normalizeTag(tag))
            .filter((tag) => tag.length > 0);
          return Array.from(new Set(tags));
        };

        const resolveOwner = (workspaceId: number): string | null => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return null;
          }
          const owner = form.owner.trim();
          return owner.length ? owner : null;
        };

        const resolveServiceBase = (
          workspaceId: number,
        ): {
          serviceId: string | null;
          label: string;
          owner: string | null;
          defaultMinutes: number;
        } | null => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return null;
          }
          const label = form.serviceLabel.trim();
          if (!label) {
            return null;
          }
          const catalog = workspaceServiceCatalog.value[workspaceId] || [];
          const selected = catalog.find(
            (svc) => svc.label.toLowerCase() === label.toLowerCase(),
          );
          if (selected) {
            return {
              serviceId: selected.serviceId,
              label: selected.label,
              owner: selected.owner,
              defaultMinutes: selected.defaultMinutes,
            };
          }
          const resolvedOwner = resolveOwner(workspaceId);
          return {
            serviceId: null,
            label,
            owner: resolvedOwner,
            defaultMinutes: Number(form.defaultMinutes),
          };
        };

        const getServiceSelection = (workspaceId: number) => {
          const form = serviceForms.value[workspaceId];
          if (!form) {
            return null;
          }
          const label = form.serviceLabel.trim().toLowerCase();
          if (!label) {
            return null;
          }
          const catalog = workspaceServiceCatalog.value[workspaceId] || [];
          return (
            catalog.find((svc) => svc.label.toLowerCase() === label) || null
          );
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

        const deleteService = async (
          workspaceId: number,
          serviceId: string,
        ) => {
          try {
            await WorkspaceService.deleteService(workspaceId, serviceId);
            showToast('Service deleted.');
            await loadServices();
            await loadEnvironments(workspaceId);
            await loadOwners(workspaceId);
            await loadServiceCatalog(workspaceId);
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const formatClaimedBy = (environment: Service['environments'][number]): string => {
          if (!environment.claimedBy) {
            return 'Unknown';
          }
          return environment.claimedByTeam
            ? `${environment.claimedBy} (team)`
            : environment.claimedBy;
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

        watch(adminSection, (value) => {
          if (value === 'services') {
            workspaces.value.forEach((workspace) => {
              loadServiceCatalog(workspace.id);
            });
          }
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
          serviceFormVisible,
          serviceForms,
          serviceErrors,
          serviceSubmitting,
          addEnvironmentTags,
          commitEnvironmentInput,
          removeEnvironmentTag,
          toggleServiceForm,
          deleteService,
          createService,
          handleEnvironmentInput,
          onEnvironmentKeydown,
          getServiceSelection,
        };
      },
    }).mount('#app');
  }
}
