import { Injectable } from '@nestjs/common';
import { AttachmentObjectMetadata } from './attachment-storage.interface';

type StoredAttachmentObject = {
  content: Buffer;
  contentType: string | null;
  contentLength: number;
  uploadedAt: Date;
};

@Injectable()
export class LocalMockAttachmentStorageService {
  private readonly objects = new Map<string, StoredAttachmentObject>();
  private totalBytes = 0;

  private readonly maxObjects = 300;
  private readonly maxTotalBytes = 200 * 1024 * 1024;

  putObject(params: {
    storageKey: string;
    content: Buffer;
    contentType: string | null;
  }) {
    const normalizedKey = this.normalizeStorageKey(params.storageKey);
    const existing = this.objects.get(normalizedKey);

    if (existing) {
      this.totalBytes -= existing.contentLength;
      this.objects.delete(normalizedKey);
    }

    const nextObject: StoredAttachmentObject = {
      content: params.content,
      contentType: params.contentType,
      contentLength: params.content.length,
      uploadedAt: new Date(),
    };

    this.objects.set(normalizedKey, nextObject);
    this.totalBytes += nextObject.contentLength;

    this.evictOverflow();
  }

  getObject(params: { storageKey: string }) {
    const normalizedKey = this.normalizeStorageKey(params.storageKey);
    return this.objects.get(normalizedKey) ?? null;
  }

  getObjectMetadata(params: {
    storageKey: string;
  }): AttachmentObjectMetadata | null {
    const object = this.getObject({
      storageKey: params.storageKey,
    });

    if (!object) {
      return null;
    }

    return {
      contentType: object.contentType,
      contentLength: object.contentLength,
    };
  }

  private evictOverflow() {
    while (
      this.objects.size > this.maxObjects ||
      this.totalBytes > this.maxTotalBytes
    ) {
      const oldestEntry = this.objects.entries().next();

      if (oldestEntry.done) {
        return;
      }

      const [oldestKey, oldestObject] = oldestEntry.value;
      this.totalBytes -= oldestObject.contentLength;
      this.objects.delete(oldestKey);
    }
  }

  private normalizeStorageKey(storageKey: string) {
    return storageKey.trim();
  }
}
