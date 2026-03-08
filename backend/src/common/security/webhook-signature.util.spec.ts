import {
  createWebhookHeaders,
  signWebhookPayload,
} from './webhook-signature.util';

describe('webhook-signature util', () => {
  it('creates signed headers when signing secret is provided', () => {
    const headers = createWebhookHeaders({
      body: '{"a":1}',
      apiKey: 'api-key',
      signingSecret: 'signing-secret',
      requestId: 'req-1',
      nowUnixSeconds: 1_700_000_000,
    });

    expect(headers['content-type']).toBe('application/json');
    expect(headers.authorization).toBe('Bearer api-key');
    expect(headers['x-hrbuddy-request-id']).toBe('req-1');
    expect(headers['x-hrbuddy-webhook-timestamp']).toBe('1700000000');
    expect(headers['x-hrbuddy-webhook-signature']).toBe(
      `v1=${signWebhookPayload('signing-secret', '1700000000', '{"a":1}')}`,
    );
  });

  it('omits signature headers when signing secret is missing', () => {
    const headers = createWebhookHeaders({
      body: '{"a":1}',
      apiKey: 'api-key',
      signingSecret: '',
      requestId: 'req-1',
    });

    expect(headers.authorization).toBe('Bearer api-key');
    expect(headers['x-hrbuddy-webhook-timestamp']).toBeUndefined();
    expect(headers['x-hrbuddy-webhook-signature']).toBeUndefined();
  });
});
