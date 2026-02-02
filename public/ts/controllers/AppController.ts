import { AuthService } from '../services/AuthService.js';
import { ReservationService } from '../services/ReservationService.js';
import { EventsService } from '../services/EventsService.js';
import { User } from '../entities/User.js';
import { Service } from '../entities/Service.js';
import { ServicesResponseDto } from '../dtos/ServicesResponseDto.js';
import { TimeHelper } from '../helpers/TimeHelper.js';
import { ThemeHelper, Theme } from '../helpers/ThemeHelper.js';

export class AppController {
  private refreshTimer: number | null = null;
  private readonly eventsService = new EventsService();
  private readonly ownerFilterStorageKey = 'ownerFilter';

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
        const serviceNameFilter = ref('');
        const expandedOverrides = ref<Record<string, boolean>>({});
        const toastMessage = ref('');
        const toastVisible = ref(false);
        const isLoading = ref(true);
        const theme = ref(ThemeHelper.getInitialTheme() as Theme);
        const claimModalOpen = ref(false);
        const claimType = ref<'self' | 'team'>('self');
        const teamName = ref('');
        const teamNameError = ref('');
        const claimSubmitting = ref(false);
        const claimServiceKey = ref<string | null>(null);

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

        const filteredServices = computed(() => {
          if (ownerFilter.value === 'all') {
            return services.value;
          }
          return services.value.filter(
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
            if (!map.has(serviceLabel)) {
              map.set(serviceLabel, []);
            }
            map.get(serviceLabel)?.push(svc);
          });
          const { regex } = parsedServiceRegex.value;
          const groups = Array.from(map.entries()).map(
            ([serviceLabel, items]) => {
              const ownerLabel = normalizeOwner(items[0]?.owner ?? null);
              const matches = regex ? regex.test(serviceLabel) : true;
              return {
                serviceLabel,
                ownerLabel,
                matches,
                expanded: getExpandedState(serviceLabel, matches),
                services: items.sort((a, b) =>
                  a.environment.localeCompare(b.environment),
                ),
              };
            },
          );

          const sortByOwner = (
            a: (typeof groups)[number],
            b: (typeof groups)[number],
          ) => {
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

        const showToast = (message: string) => {
          toastMessage.value = message;
          toastVisible.value = true;
          window.setTimeout(() => {
            toastVisible.value = false;
          }, 4000);
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

          const labels = new Set(data.services.map((svc) => svc.label));
          const nextOverrides: Record<string, boolean> = {};
          Object.entries(expandedOverrides.value).forEach(
            ([label, expanded]) => {
              if (labels.has(label)) {
                nextOverrides[label] = expanded;
              }
            },
          );
          expandedOverrides.value = nextOverrides;
        };

        const loadUser = async () => {
          user.value = await AuthService.loadUser();
        };

        const loadServices = async () => {
          try {
            const data = await ReservationService.loadServices();
            applyServiceResponse(data);
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
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const extend = async (serviceKey: string) => {
          try {
            await ReservationService.extend(serviceKey);
            showToast('Service extended.');
            await loadServices();
          } catch (err) {
            showToast((err as Error).message);
          }
        };

        const logout = async () => {
          await AuthService.logout();
          localStorage.removeItem(this.ownerFilterStorageKey);
        };

        const toggleGroup = (label: string) => {
          const current = groupedServices.value.find(
            (group) => group.serviceLabel === label,
          );
          if (!current) {
            return;
          }
          expandedOverrides.value = {
            ...expandedOverrides.value,
            [label]: !current.expanded,
          };
        };

        const refresh = async () => {
          await loadServices();
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
            await loadServices();
            initEvents();
            scheduleAutoRefresh();
          } finally {
            isLoading.value = false;
          }
        });

        watch(ownerFilter, (value) => {
          localStorage.setItem(this.ownerFilterStorageKey, value);
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
          owners,
          serviceNameFilter,
          serviceNameFilterError,
          toggleGroup,
          toastMessage,
          toastVisible,
          isLoading,
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
        };
      },
    }).mount('#app');
  }
}
