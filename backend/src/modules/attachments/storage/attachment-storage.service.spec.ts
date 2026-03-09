import { ConfigService } from '@nestjs/config';
import { AttachmentStorageService } from './attachment-storage.service';
import { B2AttachmentStorageProvider } from './b2-attachment-storage.provider';
import { LocalAttachmentStorageProvider } from './local-attachment-storage.provider';
import { WebhookAttachmentStorageProvider } from './webhook-attachment-storage.provider';

describe('AttachmentStorageService', () => {
  it('returns webhook provider when configured', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'attachments.storage.provider' ? 'webhook' : undefined,
      ),
    } as unknown as ConfigService;

    const localProvider = {} as LocalAttachmentStorageProvider;
    const webhookProvider = {} as WebhookAttachmentStorageProvider;
    const b2Provider = {} as B2AttachmentStorageProvider;

    const service = new AttachmentStorageService(
      config,
      localProvider,
      webhookProvider,
      b2Provider,
    );

    expect(service.getProvider()).toBe(webhookProvider);
  });

  it('returns b2 provider when configured', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'attachments.storage.provider' ? 'b2' : undefined,
      ),
    } as unknown as ConfigService;

    const localProvider = {} as LocalAttachmentStorageProvider;
    const webhookProvider = {} as WebhookAttachmentStorageProvider;
    const b2Provider = {} as B2AttachmentStorageProvider;

    const service = new AttachmentStorageService(
      config,
      localProvider,
      webhookProvider,
      b2Provider,
    );

    expect(service.getProvider()).toBe(b2Provider);
  });

  it('falls back to local provider', () => {
    const config = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const localProvider = {} as LocalAttachmentStorageProvider;
    const webhookProvider = {} as WebhookAttachmentStorageProvider;
    const b2Provider = {} as B2AttachmentStorageProvider;

    const service = new AttachmentStorageService(
      config,
      localProvider,
      webhookProvider,
      b2Provider,
    );

    expect(service.getProvider()).toBe(localProvider);
  });
});
