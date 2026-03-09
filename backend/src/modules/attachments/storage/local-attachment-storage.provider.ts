import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AttachmentDownloadPresign,
  AttachmentObjectMetadata,
  AttachmentStorageProvider,
  AttachmentUploadPresign,
} from './attachment-storage.interface';

@Injectable()
export class LocalAttachmentStorageProvider implements AttachmentStorageProvider {
  private readonly issuedUploads = new Map<string, AttachmentObjectMetadata>();

  constructor(private readonly config: ConfigService) {}

  async createUploadPresign(params: {
    storageKey: string;
    mimeType: string;
    fileSize: number;
    expiresAt: Date;
  }): Promise<AttachmentUploadPresign> {
    const base = this.baseUrl();

    this.issuedUploads.set(params.storageKey, {
      contentType: params.mimeType,
      contentLength: params.fileSize,
    });

    return {
      url: `${base}/upload/${encodeURIComponent(params.storageKey)}?expiresAt=${encodeURIComponent(params.expiresAt.toISOString())}`,
      method: 'PUT',
      headers: {
        'content-type': params.mimeType,
        'content-length': String(params.fileSize),
      },
      expiresAt: params.expiresAt,
    };
  }

  async createDownloadPresign(params: {
    storageKey: string;
    fileName: string;
    expiresAt: Date;
  }): Promise<AttachmentDownloadPresign> {
    const base = this.baseUrl();

    return {
      url: `${base}/download/${encodeURIComponent(params.storageKey)}?fileName=${encodeURIComponent(params.fileName)}&expiresAt=${encodeURIComponent(params.expiresAt.toISOString())}`,
      expiresAt: params.expiresAt,
    };
  }

  async getObjectMetadata(params: {
    storageKey: string;
  }): Promise<AttachmentObjectMetadata | null> {
    return this.issuedUploads.get(params.storageKey) ?? null;
  }

  private baseUrl() {
    const raw =
      this.config.get<string>('attachments.storage.baseUrl') ??
      'http://localhost:3001/storage/mock';

    return raw.replace(/\/$/, '');
  }
}
