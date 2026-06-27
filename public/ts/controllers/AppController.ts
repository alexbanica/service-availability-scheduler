import { AuthService } from '../services/AuthService.js';
import { ReservationService } from '../services/ReservationService.js';
import { EventsService } from '../services/EventsService.js';
import { User } from '../entities/User.js';
import { Service } from '../entities/Service.js';
import { ServicesResponseDto } from '../dtos/ServicesResponseDto.js';
import { TimeHelper } from '../helpers/TimeHelper.js';
import { ThemeHelper, Theme } from '../helpers/ThemeHelper.js';
import {
  WorkspaceResourceType,
  WorkspaceOwnerOption,
  WorkspaceService,
} from '../services/WorkspaceService.js';
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
        const isCreateWorkspaceModalOpen = ref(false);
        const workspaceName = ref('');
        const workspaceError = ref('');
        const workspaceSubmitting = ref(false);
        const isInviteModalOpen = ref(false);
        const inviteWorkspaceId = ref<string | null>(null);
        const inviteEmail = ref('');
        const inviteError = ref('');
        const inviteSubmitting = ref(false);
        const ownerModalWorkspaceId = ref<string | null>(null);
        const ownerName = ref('');
        const ownerError = ref('');
        const ownerSubmitting = ref(false);
        const environmentModalWorkspaceId = ref<string | null>(null);
        const environmentName = ref('');
        const environmentError = ref('');
        const environmentSubmitting = ref(false);
        const workspaceRowsModal = ref<{
          workspaceId: string;
          workspaceName: string;
          resourceType: WorkspaceResourceType;
          rows: Array<Record<string, unknown>>;
          loading: boolean;
          error: string;
        } | null>(null);
        const workspaceEnvironments = ref<
          Record<string, Array<{ environmentId: string; environmentName: string }>>
        >({});
        const workspaceOwners = ref<Record<string, WorkspaceOwnerOption[]>>({});
        const workspaceServiceCatalog = ref<
          Record<
            string,
            Array<{
              serviceId: string;
              label: string;
              owner: string | null;
              ownerId: string | null;
              defaultMinutes: number;
              environments: Array<{ environmentId: string; environmentName: string }>;
            }>
          >
        >({});
        const selectedServiceWorkspaceId = ref<string | null>(null);
        const serviceManagementWorkspaceStorageKey =
          'serviceManagementWorkspace';

        type ServiceManagementForm = {
          environmentInput: string;
          environmentTags: string[];
          serviceLabel: string;
          defaultMinutes: number;
          ownerId: string;
        };

        const createEmptyServiceManagementForm = (): ServiceManagementForm => ({
          environmentInput: '',
          environmentTags: [],
          serviceLabel: '',
          defaultMinutes: 60,
          ownerId: '',
        });

        const serviceCreateForm = ref<ServiceManagementForm>(
          createEmptyServiceManagementForm(),
        );
        const serviceCreateError = ref('');
        const serviceCreateSubmitting = ref(false);

        const serviceEditForm = ref<ServiceManagementForm>(
          createEmptyServiceManagementForm(),
        );
        const serviceEditError = ref('');
        const serviceEditSubmitting = ref(false);
        const editingServiceId = ref<string | null>(null);

        const selectedServiceWorkspace = computed(
          () =>
            workspaces.value.find(
              (workspace) => workspace.id === selectedServiceWorkspaceId.value,
            ) || null,
        );
        const selectedServiceCatalog = computed(
          () =>
            selectedServiceWorkspaceId.value
              ? workspaceServiceCatalog.value[selectedServiceWorkspaceId.value] || []
              : [],
        );
        const selectedServiceCatalogByName = computed(() =>
          [...selectedServiceCatalog.value].sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        );
        const selectedServiceWorkspaceIsAdmin = computed(
          () =>
            !!user.value &&
            selectedServiceWorkspace.value?.adminUserId === user.value?.id,
        );

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
          const map = new Map<string, string>();
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
            .map(([id, name]) => ({ value: id, label: name }));
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
        const selectedInviteWorkspace = computed(() =>
          inviteWorkspaceId.value === null
            ? null
            : adminWorkspaces.value.find(
                (workspace) => workspace.id === inviteWorkspaceId.value,
              ) || null,
        );

        const selectedOwnerWorkspace = computed(() =>
          ownerModalWorkspaceId.value === null
            ? null
            : adminWorkspaces.value.find(
                (workspace) => workspace.id === ownerModalWorkspaceId.value,
              ) || null,
        );

        const selectedEnvironmentWorkspace = computed(() =>
          environmentModalWorkspaceId.value === null
            ? null
            : adminWorkspaces.value.find(
                (workspace) =>
                  workspace.id === environmentModalWorkspaceId.value,
              ) || null,
        );


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
            const persistedWorkspaceId =
              localStorage.getItem(serviceManagementWorkspaceStorageKey) || null;
            const firstWorkspaceId =
              workspaces.value.length > 0 ? workspaces.value[0].id : null;
            if (
              selectedServiceWorkspaceId.value !== null &&
              workspaces.value.some(
                (workspace) => workspace.id === selectedServiceWorkspaceId.value,
              )
            ) {
              return;
            }
            if (
              persistedWorkspaceId &&
              workspaces.value.some(
                (workspace) => workspace.id === persistedWorkspaceId,
              )
            ) {
              selectedServiceWorkspaceId.value = persistedWorkspaceId;
              return;
            }
            selectedServiceWorkspaceId.value = firstWorkspaceId;
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

        const loadEnvironments = async (workspaceId: string) => {
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

        const loadOwners = async (workspaceId: string) => {
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

        const loadServiceCatalog = async (workspaceId: string) => {
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

        const resetCreateWorkspaceModal = () => {
          isCreateWorkspaceModalOpen.value = false;
          workspaceName.value = '';
          workspaceError.value = '';
          workspaceSubmitting.value = false;
        };

        const resetInviteModal = () => {
          inviteWorkspaceId.value = null;
          inviteEmail.value = '';
          inviteError.value = '';
          inviteSubmitting.value = false;
          isInviteModalOpen.value = false;
        };

        const resetOwnerModal = () => {
          ownerModalWorkspaceId.value = null;
          ownerName.value = '';
          ownerError.value = '';
          ownerSubmitting.value = false;
        };

        const resetEnvironmentModal = () => {
          environmentModalWorkspaceId.value = null;
          environmentName.value = '';
          environmentError.value = '';
          environmentSubmitting.value = false;
        };

        const openInviteModal = (workspaceId: string) => {
          inviteWorkspaceId.value = workspaceId;
          inviteEmail.value = '';
          inviteError.value = '';
          inviteSubmitting.value = false;
          isInviteModalOpen.value = true;
        };

        const openOwnerModal = (workspaceId: string) => {
          resetOwnerModal();
          ownerModalWorkspaceId.value = workspaceId;
        };

        const openEnvironmentModal = (workspaceId: string) => {
          resetEnvironmentModal();
          environmentModalWorkspaceId.value = workspaceId;
        };

        const closeInviteModal = () => {
          resetInviteModal();
        };

        const closeOwnerModal = () => {
          resetOwnerModal();
        };

        const closeEnvironmentModal = () => {
          resetEnvironmentModal();
        };

        const closeWorkspaceRowsModal = () => {
          workspaceRowsModal.value = null;
        };

        const openCreateWorkspaceModal = () => {
          resetCreateWorkspaceModal();
          isCreateWorkspaceModalOpen.value = true;
        };

        const closeCreateWorkspaceModal = () => {
          resetCreateWorkspaceModal();
        };

        const cancelCreateWorkspace = () => {
          closeCreateWorkspaceModal();
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
            await loadWorkspaces();
            showToast('Workspace created.');
            closeCreateWorkspaceModal();
          } catch (err) {
            workspaceError.value = (err as Error).message;
          } finally {
            workspaceSubmitting.value = false;
          }
        };

        const submitInvite = async () => {
          const workspaceId = inviteWorkspaceId.value;
          if (!workspaceId) {
            return;
          }
          const email = inviteEmail.value.trim();
          inviteError.value = '';
          if (!email) {
            inviteError.value = 'Email is required.';
            return;
          }
          inviteSubmitting.value = true;
          try {
            await WorkspaceService.invite(workspaceId, email);
            closeInviteModal();
            showToast('Invitation sent.');
          } catch (err) {
            inviteError.value = (err as Error).message;
            inviteSubmitting.value = false;
          }
        };

        const createOwner = async () => {
          const workspaceId = ownerModalWorkspaceId.value;
          const name = ownerName.value.trim();
          ownerError.value = '';
          if (!workspaceId) {
            return;
          }
          if (!name) {
            ownerError.value = 'Owner name is required.';
            return;
          }
          ownerSubmitting.value = true;
          try {
            await WorkspaceService.createOwner(workspaceId, name);
            await loadWorkspaces();
            await loadOwners(workspaceId);
            showToast('Owner created.');
            closeOwnerModal();
          } catch (err) {
            ownerError.value = (err as Error).message;
            ownerSubmitting.value = false;
          }
        };

        const createEnvironment = async () => {
          const workspaceId = environmentModalWorkspaceId.value;
          const name = environmentName.value.trim();
          environmentError.value = '';
          if (!workspaceId) {
            return;
          }
          if (!name) {
            environmentError.value = 'Environment name is required.';
            return;
          }
          environmentSubmitting.value = true;
          try {
            await WorkspaceService.createEnvironment(workspaceId, name);
            await loadWorkspaces();
            await loadEnvironments(workspaceId);
            showToast('Environment created.');
            closeEnvironmentModal();
          } catch (err) {
            environmentError.value = (err as Error).message;
            environmentSubmitting.value = false;
          }
        };

        const openWorkspaceRowsModal = async (
          workspace: Workspace,
          resourceType: WorkspaceResourceType,
        ) => {
          workspaceRowsModal.value = {
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            resourceType,
            rows: [],
            loading: true,
            error: '',
          };
          try {
            const rows = await WorkspaceService.listWorkspaceRows(
              workspace.id,
              resourceType,
            );
            if (
              workspaceRowsModal.value?.workspaceId === workspace.id &&
              workspaceRowsModal.value.resourceType === resourceType
            ) {
              workspaceRowsModal.value = {
                ...workspaceRowsModal.value,
                rows,
                loading: false,
              };
            }
          } catch (err) {
            if (
              workspaceRowsModal.value?.workspaceId === workspace.id &&
              workspaceRowsModal.value.resourceType === resourceType
            ) {
              workspaceRowsModal.value = {
                ...workspaceRowsModal.value,
                loading: false,
                error: (err as Error).message,
              };
            }
          }
        };

        const workspaceRowLabel = (row: Record<string, unknown>): string => {
          const values = [
            row.email,
            row.serviceName,
            row.ownerName,
            row.environmentName,
            row.userId,
            row.serviceId,
            row.ownerId,
            row.environmentId,
          ];
          const value = values.find((entry) => typeof entry === 'string');
          return typeof value === 'string' ? value : 'Unknown';
        };

        const cancelInvite = () => {
          closeInviteModal();
        };

        const normalizeTag = (value: string): string => value.trim();

        const resetServiceCreateForm = () => {
          serviceCreateForm.value = createEmptyServiceManagementForm();
          serviceCreateError.value = '';
        };

        const resetServiceEditForm = () => {
          serviceEditForm.value = createEmptyServiceManagementForm();
          serviceEditError.value = '';
          serviceEditSubmitting.value = false;
          editingServiceId.value = null;
        };

        const resetServiceForms = () => {
          resetServiceCreateForm();
          resetServiceEditForm();
        };

        const loadServiceManagementWorkspaceData = async (
          workspaceId: string,
        ) => {
          const selectedWorkspace = workspaces.value.find(
            (workspace) => workspace.id === workspaceId,
          );
          const isAdminWorkspace =
            !!user.value &&
            !!selectedWorkspace &&
            selectedWorkspace.adminUserId === user.value.id;
          const requests = [loadServiceCatalog(workspaceId)];
          if (isAdminWorkspace) {
            requests.push(loadEnvironments(workspaceId), loadOwners(workspaceId));
          }
          await Promise.all(requests);
        };

        const selectedServiceCatalogLookup = (serviceLabel: string) => {
          const trimmed = serviceLabel.trim().toLowerCase();
          if (!trimmed) {
            return null;
          }
          return (
            selectedServiceCatalog.value.find(
              (svc) => svc.label.toLowerCase() === trimmed,
            ) || null
          );
        };

        const splitEnvironmentInput = (
          input: string,
        ): { tags: string[]; remainder: string } => {
          if (!/[ ,\t\n\r\f]/.test(input)) {
            return { tags: [], remainder: input };
          }
          const endsWithSeparator = /[ ,\t\n\r\f]$/.test(input);
          const parts = input.split(/[ ,\t\n\r\f]+/);
          const remainder = endsWithSeparator ? '' : parts.pop() || '';
          const tags = parts
            .map((part) => normalizeTag(part))
            .filter((part) => part.length > 0);
          return { tags, remainder };
        };

        const dedupeEnvironmentTags = (
          existingTags: string[],
          nextTags: string[],
        ): string[] => {
          const seen = new Set(existingTags.map((tag) => tag.toLowerCase()));
          const merged = [...existingTags];
          nextTags.forEach((tag) => {
            const normalized = normalizeTag(tag);
            if (!normalized) {
              return;
            }
            const key = normalized.toLowerCase();
            if (seen.has(key)) {
              return;
            }
            seen.add(key);
            merged.push(normalized);
          });
          return merged;
        };

        const addEnvironmentTags = (
          form: ServiceManagementForm,
          raw: string,
        ): ServiceManagementForm => {
          const parts = raw
            .split(/[ ,\t\n\r\f]+/)
            .map((part) => normalizeTag(part))
            .filter((part) => part.length > 0);
          if (!parts.length) {
            return form;
          }
          return {
            ...form,
            environmentTags: dedupeEnvironmentTags(form.environmentTags, parts),
          };
        };

        const resolveEnvironmentTags = (
          form: ServiceManagementForm,
        ): string[] => {
          const tags = form.environmentTags
            .map((tag) => normalizeTag(tag))
            .filter((tag) => tag.length > 0);
          return Array.from(new Set(tags));
        };

        const commitCreateEnvironmentInput = () => {
          const form = serviceCreateForm.value;
          const nextForm = addEnvironmentTags(form, form.environmentInput);
          serviceCreateForm.value = { ...nextForm, environmentInput: '' };
        };

        const commitEditEnvironmentInput = () => {
          const form = serviceEditForm.value;
          const nextForm = addEnvironmentTags(form, form.environmentInput);
          serviceEditForm.value = { ...nextForm, environmentInput: '' };
        };

        const handleCreateEnvironmentInput = () => {
          const form = serviceCreateForm.value;
          const { tags, remainder } = splitEnvironmentInput(form.environmentInput);
          if (!tags.length) {
            return;
          }
          serviceCreateForm.value = {
            ...addEnvironmentTags(form, tags.join(' ')),
            environmentInput: remainder,
          };
        };

        const handleEditEnvironmentInput = () => {
          const form = serviceEditForm.value;
          const { tags, remainder } = splitEnvironmentInput(form.environmentInput);
          if (!tags.length) {
            return;
          }
          serviceEditForm.value = {
            ...addEnvironmentTags(form, tags.join(' ')),
            environmentInput: remainder,
          };
        };

        const onCreateEnvironmentKeydown = (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
            event.preventDefault();
            commitCreateEnvironmentInput();
          }
        };

        const onEditEnvironmentKeydown = (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
            event.preventDefault();
            commitEditEnvironmentInput();
          }
        };

        const onCreateEnvironmentBlur = () => {
          commitCreateEnvironmentInput();
        };

        const onEditEnvironmentBlur = () => {
          commitEditEnvironmentInput();
        };

        const removeCreateEnvironmentTag = (tag: string) => {
          serviceCreateForm.value = {
            ...serviceCreateForm.value,
            environmentTags: serviceCreateForm.value.environmentTags.filter(
              (existing) => existing.toLowerCase() !== tag.toLowerCase(),
            ),
          };
        };

        const removeEditEnvironmentTag = (tag: string) => {
          serviceEditForm.value = {
            ...serviceEditForm.value,
            environmentTags: serviceEditForm.value.environmentTags.filter(
              (existing) => existing.toLowerCase() !== tag.toLowerCase(),
            ),
          };
        };

        const createService = async () => {
          if (!selectedServiceWorkspaceId.value) {
            return;
          }
          if (!selectedServiceWorkspaceIsAdmin.value) {
            serviceCreateError.value = 'Not authorized for workspace';
            return;
          }

          commitCreateEnvironmentInput();
          serviceCreateError.value = '';

          const environments = resolveEnvironmentTags(serviceCreateForm.value);
          if (!environments.length) {
            serviceCreateError.value = 'Add at least one environment.';
            return;
          }

          const serviceLabel = serviceCreateForm.value.serviceLabel.trim();
          if (!serviceLabel) {
            serviceCreateError.value = 'Service name is required.';
            return;
          }

          const selectedService = selectedServiceCatalogLookup(serviceLabel);
          const minutes =
            selectedService?.defaultMinutes ??
            Number(serviceCreateForm.value.defaultMinutes);
          if (!selectedService && (!Number.isFinite(minutes) || minutes <= 0)) {
            serviceCreateError.value = 'Default minutes must be positive.';
            return;
          }

          serviceCreateSubmitting.value = true;
          try {
            await WorkspaceService.createService(
              selectedServiceWorkspaceId.value,
              {
                environmentIds: environments,
                serviceId: selectedService ? selectedService.serviceId : null,
                label: serviceLabel,
                defaultMinutes: selectedService
                  ? selectedService.defaultMinutes
                  : minutes,
                ownerId: selectedService
                  ? selectedService.ownerId
                  : serviceCreateForm.value.ownerId || null,
              },
            );
            resetServiceCreateForm();
            showToast('Service created.');
            await loadServiceManagementWorkspaceData(selectedServiceWorkspaceId.value);
          } catch (err) {
            serviceCreateError.value = (err as Error).message;
          } finally {
            serviceCreateSubmitting.value = false;
          }
        };

        const openEditService = (
          serviceId: string,
          label: string,
          defaultMinutes: number,
          environments: Array<{ environmentId: string; environmentName: string }>,
        ) => {
          if (editingServiceId.value === serviceId) {
            resetServiceEditForm();
            return;
          }
          serviceEditError.value = '';
          serviceEditSubmitting.value = false;
          editingServiceId.value = serviceId;
          serviceEditForm.value = {
            environmentInput: '',
            environmentTags: environments.map((env) => env.environmentId),
            serviceLabel: label,
            defaultMinutes,
            ownerId:
              selectedServiceCatalog.value.find(
                (service) => service.serviceId === serviceId,
              )?.ownerId || '',
          };
        };

        const cancelEditService = () => {
          resetServiceEditForm();
        };

        const editService = async () => {
          const serviceId = editingServiceId.value;
          if (!serviceId || !selectedServiceWorkspaceId.value) {
            return;
          }
          if (!selectedServiceWorkspaceIsAdmin.value) {
            serviceEditError.value = 'Not authorized for workspace';
            return;
          }

          commitEditEnvironmentInput();
          serviceEditError.value = '';

          const environments = resolveEnvironmentTags(serviceEditForm.value);
          if (!environments.length) {
            serviceEditError.value = 'Add at least one environment.';
            return;
          }

          const serviceLabel = serviceEditForm.value.serviceLabel.trim();
          if (!serviceLabel) {
            serviceEditError.value = 'Service name is required.';
            return;
          }

          const minutes = Number(serviceEditForm.value.defaultMinutes);
          if (!Number.isFinite(minutes) || minutes <= 0) {
            serviceEditError.value = 'Default minutes must be positive.';
            return;
          }

          serviceEditSubmitting.value = true;
          try {
            await WorkspaceService.updateService(
              selectedServiceWorkspaceId.value,
              serviceId,
              {
                environmentIds: environments,
                label: serviceLabel,
                ownerId: serviceEditForm.value.ownerId || null,
                defaultMinutes: minutes,
              },
            );
            showToast('Service updated.');
            resetServiceEditForm();
            await loadServiceManagementWorkspaceData(selectedServiceWorkspaceId.value);
          } catch (err) {
            serviceEditError.value = (err as Error).message;
          } finally {
            serviceEditSubmitting.value = false;
          }
        };

        const deleteService = async (serviceId: string) => {
          if (!selectedServiceWorkspaceId.value) {
            return;
          }
          if (!selectedServiceWorkspaceIsAdmin.value) {
            showToast('Not authorized for workspace');
            return;
          }
          try {
            await WorkspaceService.deleteService(
              selectedServiceWorkspaceId.value,
              serviceId,
            );
            if (editingServiceId.value === serviceId) {
              resetServiceEditForm();
            }
            showToast('Service deleted.');
            await loadServiceManagementWorkspaceData(selectedServiceWorkspaceId.value);
          } catch (err) {
            showToast((err as Error).message);
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

        const setView = (view: 'overview' | 'availability' | 'admin') => {
          currentView.value = view;
        };

        const setAdminSection = (
          section: 'workspace' | 'services' | 'users',
        ) => {
          adminSection.value = section;
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
            if (selectedServiceWorkspaceId.value !== null) {
              loadServiceManagementWorkspaceData(
                selectedServiceWorkspaceId.value,
              ).catch((err) => {
                showToast((err as Error).message);
              });
            }
          }
        });

        watch(selectedServiceWorkspaceId, (workspaceId) => {
          if (workspaceId === null) {
            localStorage.removeItem(serviceManagementWorkspaceStorageKey);
            return;
          }
          localStorage.setItem(
            serviceManagementWorkspaceStorageKey,
            String(workspaceId),
          );
          resetServiceForms();
          loadServiceManagementWorkspaceData(workspaceId).catch((err) => {
            showToast((err as Error).message);
          });
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
          selectedServiceWorkspaceId,
          selectedServiceWorkspace,
          selectedServiceCatalog,
          selectedServiceCatalogByName,
          selectedServiceWorkspaceIsAdmin,
          adminWorkspaces,
          claimedByUser,
          totalServicesCount,
          claimedServicesCount,
          availableServicesCount,
          workspaceName,
          isCreateWorkspaceModalOpen,
          workspaceError,
          workspaceSubmitting,
          openCreateWorkspaceModal,
          closeCreateWorkspaceModal,
          cancelCreateWorkspace,
          isInviteModalOpen,
          inviteWorkspaceId,
          inviteEmail,
          inviteError,
          inviteSubmitting,
          selectedInviteWorkspace,
          openInviteModal,
          closeInviteModal,
          cancelInvite,
          submitInvite,
          ownerModalWorkspaceId,
          ownerName,
          ownerError,
          ownerSubmitting,
          selectedOwnerWorkspace,
          openOwnerModal,
          closeOwnerModal,
          createOwner,
          environmentModalWorkspaceId,
          environmentName,
          environmentError,
          environmentSubmitting,
          selectedEnvironmentWorkspace,
          openEnvironmentModal,
          closeEnvironmentModal,
          createEnvironment,
          workspaceRowsModal,
          openWorkspaceRowsModal,
          closeWorkspaceRowsModal,
          workspaceRowLabel,
          createWorkspace,
          workspaceEnvironments,
          workspaceOwners,
          workspaceServiceCatalog,
          serviceCreateForm,
          serviceCreateError,
          serviceCreateSubmitting,
          serviceEditForm,
          serviceEditError,
          serviceEditSubmitting,
          editingServiceId,
          createService,
          openEditService,
          cancelEditService,
          editService,
          deleteService,
          onCreateEnvironmentKeydown,
          onEditEnvironmentKeydown,
          onCreateEnvironmentBlur,
          onEditEnvironmentBlur,
          handleCreateEnvironmentInput,
          handleEditEnvironmentInput,
          removeCreateEnvironmentTag,
          removeEditEnvironmentTag,
        };
      },
    }).mount('#app');
  }
}
