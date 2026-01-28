import { getState } from '../domain/servicesStore.js';
import { extendService } from '../domain/reservationService.js';
import { showToast } from './render.js';

export function initExpiryEvents() {
  const events = new EventSource('/events');
  events.addEventListener('expiring', (event) => {
    const data = JSON.parse(event.data);
    const message = `${data.environment} / ${data.service_name} expires in ${data.minutes_left} minute(s). Extend?`;
    if (confirm(message)) {
      extendService(data.service_key).catch((err) => showToast(err.message));
    }
  });
}

export function initAutoRefresh(loadServicesAndRender) {
  const schedule = () => {
    const { autoRefreshMinutes } = getState();
    const intervalMinutes = Math.max(autoRefreshMinutes || 1, 1);
    setTimeout(async () => {
      await loadServicesAndRender();
      schedule();
    }, intervalMinutes * 60000);
  };

  schedule();
}
