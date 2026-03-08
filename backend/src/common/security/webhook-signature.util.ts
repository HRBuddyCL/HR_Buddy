import { createHmac, randomUUID } from 'crypto';

export type CreateWebhookHeadersInput = {
  body: string;
  apiKey?: string | null;
  signingSecret?: string | null;
  requestId?: string;
  nowUnixSeconds?: number;
};

export function signWebhookPayload(
  signingSecret: string,
  timestamp: string,
  body: string,
) {
  return createHmac('sha256', signingSecret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

export function createWebhookHeaders(
  input: CreateWebhookHeadersInput,
): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-hrbuddy-request-id': input.requestId ?? randomUUID(),
  };

  if (input.apiKey) {
    headers.authorization = `Bearer ${input.apiKey}`;
  }

  const signingSecret = input.signingSecret?.trim();

  if (signingSecret) {
    const timestamp = String(
      input.nowUnixSeconds ?? Math.floor(Date.now() / 1000),
    );

    headers['x-hrbuddy-webhook-timestamp'] = timestamp;
    headers['x-hrbuddy-webhook-signature'] = `v1=${signWebhookPayload(
      signingSecret,
      timestamp,
      input.body,
    )}`;
  }

  return headers;
}
