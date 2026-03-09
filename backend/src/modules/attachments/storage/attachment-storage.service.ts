import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentStorageProvider } from './attachment-storage.interface';
import { B2AttachmentStorageProvider } from './b2-attachment-storage.provider';
import { LocalAttachmentStorageProvider } from './local-attachment-storage.provider';
import { WebhookAttachmentStorageProvider } from './webhook-attachment-storage.provider';

@Injectable()
export class AttachmentStorageService {
  constructor(
    private readonly config: ConfigService,
    private readonly localProvider: LocalAttachmentStorageProvider,
    private readonly webhookProvider: WebhookAttachmentStorageProvider,
    private readonly b2Provider: B2AttachmentStorageProvider,
  ) {}

  getProvider(): AttachmentStorageProvider {
    const provider =
      this.config.get<string>('attachments.storage.provider') ?? 'local';

    if (provider === 'webhook') {
      return this.webhookProvider;
    }

    if (provider === 'b2') {
      return this.b2Provider;
    }

    return this.localProvider;
  }
}
