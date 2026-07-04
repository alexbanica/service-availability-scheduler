import type { EmailJob } from '../entities/EmailJob';
import type { OneSignalConfig } from './ConfigLoaderService';

type FetchLike = typeof fetch;

export type OneSignalDeliveryResult =
  | { ok: true; messageId: string }
  | { ok: false; summary: string };

export class OneSignalEmailDeliveryService {
  constructor(
    private readonly config: OneSignalConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  ) {}

  async send(job: EmailJob): Promise<OneSignalDeliveryResult> {
    const body: Record<string, unknown> = {
      app_id: this.config.appId,
      email_to: [job.recipientEmail],
      template_id: job.templateId,
      custom_data: job.payload,
      include_unsubscribed: true,
      idempotency_key: job.idempotencyKey,
    };
    if (this.config.emailFromName) {
      body.email_from_name = this.config.emailFromName;
    }
    if (this.config.emailFromAddress) {
      body.email_from_address = this.config.emailFromAddress;
    }
    if (this.config.emailReplyToAddress) {
      body.email_reply_to_address = this.config.emailReplyToAddress;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(
        'https://onesignal.com/api/v1/notifications',
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${this.config.restApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
    } catch (error) {
      return {
        ok: false,
        summary: `network error: ${(error as Error).message}`,
      };
    }

    let parsed: unknown = null;
    let responseText = '';
    try {
      responseText = await response.text();
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        summary: this.summarizeFailure(response.status, parsed, responseText),
      };
    }

    const messageId = this.extractMessageId(parsed);
    if (!messageId) {
      return {
        ok: false,
        summary: 'OneSignal success response missing message id',
      };
    }

    return { ok: true, messageId };
  }

  private extractMessageId(parsed: unknown): string | null {
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const id = (parsed as { id?: unknown }).id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  }

  private summarizeFailure(
    status: number,
    parsed: unknown,
    responseText: string,
  ): string {
    const fields: string[] = [`status ${status}`];
    if (parsed && typeof parsed === 'object') {
      const error = (parsed as { errors?: unknown; error?: unknown }).errors;
      const warning = (parsed as { warnings?: unknown }).warnings;
      if (error !== undefined) {
        fields.push(`errors=${JSON.stringify(error)}`);
      }
      if (warning !== undefined) {
        fields.push(`warnings=${JSON.stringify(warning)}`);
      }
    } else if (responseText) {
      fields.push(responseText.slice(0, 300));
    }
    return fields.join(' ');
  }
}
