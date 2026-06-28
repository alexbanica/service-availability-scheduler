import { AuthTokenStorage } from './AuthTokenStorage.js';

export class EventsService {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private abortController: AbortController | null = null;
  private partial = '';

  start(
    onExpiring: (data: {
      service_key: string;
      environment: string;
      service_name: string;
      minutes_left: number;
    }) => void,
  ): void {
    this.stop();
    this.abortController = new AbortController();
    const request = this.openRequest(this.abortController.signal, onExpiring);
    request.catch(() => {
      return;
    });

    void request;
  }

  stop(): void {
    if (this.reader) {
      void this.reader.cancel();
    }
    this.reader = null;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = null;
  }

  private async openRequest(
    signal: AbortSignal,
    onExpiring: (data: {
      service_key: string;
      environment: string;
      service_name: string;
      minutes_left: number;
    }) => void,
  ): Promise<void> {
    const token = AuthTokenStorage.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch('/api/events', {
      signal,
      headers,
    });

    if (response.status === 401) {
      AuthTokenStorage.clearToken();
      window.location.href = '/login';
      return;
    }

    if (!response.ok || !response.body) {
      throw new Error('Events request failed');
    }

    const reader = response.body.getReader();
    this.reader = reader;
    const decoder = new TextDecoder();

    let eventName = 'message';
    let eventData = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      this.partial += chunk;

      let separatorIndex: number;
      while ((separatorIndex = this.partial.indexOf('\n\n')) !== -1) {
        const eventBlock = this.partial.slice(0, separatorIndex).trim();
        this.partial = this.partial.slice(separatorIndex + 2);

        const lines = eventBlock.split('\n');
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice('event:'.length).trim();
            continue;
          }
          if (line.startsWith('data:')) {
            eventData = line.slice('data:'.length).trim();
          }
        }

        if (eventName === 'expiring' && eventData) {
          try {
            onExpiring(JSON.parse(eventData) as {
              service_key: string;
              environment: string;
              service_name: string;
              minutes_left: number;
            });
          } catch {
            continue;
          }
        }
        eventData = '';
      }
    }
  }
}
