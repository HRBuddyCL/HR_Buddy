import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  AttachmentDownloadPresign,
  AttachmentStorageProvider,
  AttachmentUploadPresign,
} from './attachment-storage.interface';

@Injectable()
export class B2AttachmentStorageProvider implements AttachmentStorageProvider {
  constructor(private readonly config: ConfigService) {}

  async createUploadPresign(params: {
    storageKey: string;
    mimeType: string;
    expiresAt: Date;
  }): Promise<AttachmentUploadPresign> {
    const { bucketName } = this.readRequiredConfig();
    const expiresIn = this.computeExpiresInSeconds(params.expiresAt);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: params.storageKey,
      ContentType: params.mimeType,
    });

    const url = await getSignedUrl(this.createClient(), command, {
      expiresIn,
    });

    return {
      url,
      method: 'PUT',
      headers: {
        'content-type': params.mimeType,
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async createDownloadPresign(params: {
    storageKey: string;
    fileName: string;
    expiresAt: Date;
  }): Promise<AttachmentDownloadPresign> {
    const { bucketName } = this.readRequiredConfig();
    const expiresIn = this.computeExpiresInSeconds(params.expiresAt);

    const fileName = this.sanitizeFileName(params.fileName);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: params.storageKey,
      ResponseContentDisposition: `attachment; filename=\"${fileName}\"`,
    });

    const url = await getSignedUrl(this.createClient(), command, {
      expiresIn,
    });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  private createClient() {
    const { endpoint, region, accessKeyId, secretAccessKey } =
      this.readRequiredConfig();

    return new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private readRequiredConfig() {
    const bucketName =
      this.config.get<string>('attachments.storage.b2.bucketName')?.trim() ?? '';
    const endpoint =
      this.config.get<string>('attachments.storage.b2.s3Endpoint')?.trim() ?? '';
    const region =
      this.config.get<string>('attachments.storage.b2.region')?.trim() ||
      'us-west-004';
    const accessKeyId =
      this.config
        .get<string>('attachments.storage.b2.accessKeyId')
        ?.trim() ?? '';
    const secretAccessKey =
      this.config
        .get<string>('attachments.storage.b2.secretAccessKey')
        ?.trim() ?? '';

    if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'B2 storage provider is not fully configured (bucket/endpoint/access key/secret key)',
      );
    }

    return {
      bucketName,
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
    };
  }

  private computeExpiresInSeconds(target: Date) {
    const maxTtl =
      this.config.get<number>('attachments.storage.b2.maxPresignTtlSeconds') ??
      3600;

    const now = Date.now();
    const diffSeconds = Math.floor((target.getTime() - now) / 1000);

    return Math.min(Math.max(diffSeconds, 1), Math.max(maxTtl, 1));
  }

  private sanitizeFileName(fileName: string) {
    const sanitized = fileName.replace(/[\r\n\"]/g, '').trim();
    return sanitized || 'file';
  }
}
