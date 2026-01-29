import { AuthService } from '../services/AuthService.js';
import { ReservationService } from '../services/ReservationService.js';
import { EventsService } from '../services/EventsService.js';
import { User } from '../entities/User.js';
import { Service } from '../entities/Service.js';
import { ServicesResponseDto } from '../dtos/ServicesResponseDto.js';
import { TimeHelper } from '../helpers/TimeHelper.js';

export class AppController {
  private refreshTimer: number | null = null;
  private readonly eventsService = new EventsService();

  bootstrap(Vue: any): void {
    const { createApp, ref, computed, onMounted } = Vue as {
      createApp: (options: Record<string, unknown>) => { mount: (selector: string) => void };
      ref: <T>(value: T) => { value: T };
      computed: <T>(fn: () => T) => { value: T };
      onMounted: (fn: () => void | Promise<void>) => void;
    };

    createApp({
      setup: () => {
        const user = ref<User | null>(null);
        const services = ref<Service[]>([]);
        const expiryWarningMinutes = ref(5);
        const autoRefreshMinutes = ref(2);
        const toastMessage = ref('');
        const toastVisible = ref(false);

        const inUseServices = computed(() =>
          services.value
            .filter((svc: Service) => svc.active)
            .sort((a: Service, b: Service) => (a.expiresAt || '').localeCompare(b.expiresAt || ''))
        );

        const groupedServices = computed(() => {
          const map = new Map<string, Service[]>();
          services.value.forEach((svc: Service) => {
            const serviceLabel = svc.label;
            if (!map.has(serviceLabel)) {
              map.set(serviceLabel, []);
            }
            map.get(serviceLabel)?.push(svc);
          });
          return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([serviceLabel, items]) => ({
              serviceLabel,
              services: items.sort((a, b) =>
                a.environment.localeCompare(b.environment),
              ),
            }));
        });

        const showToast = (message: string) => {
          toastMessage.value = message;
          toastVisible.value = true;
          window.setTimeout(() => {
            toastVisible.value = false;
          }, 4000);
        };

        const applyServiceResponse = (data: ServicesResponseDto) => {
          services.value = data.services;
          expiryWarningMinutes.value = data.expiryWarningMinutes;
          autoRefreshMinutes.value = data.autoRefreshMinutes;
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

        const claim = async (serviceKey: string) => {
          try {
            await ReservationService.claim(serviceKey);
            await loadServices();
          } catch (err) {
            showToast((err as Error).message);
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
        };

        const refresh = async () => {
          await loadServices();
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
          await loadUser();
          await loadServices();
          initEvents();
          scheduleAutoRefresh();
        });

        return {
          user,
          services,
          inUseServices,
          groupedServices,
          toastMessage,
          toastVisible,
          formatTime: TimeHelper.formatTime,
          claim,
          release,
          extend,
          refresh,
          logout
        };
      }
    }).mount('#app');
  }
}
