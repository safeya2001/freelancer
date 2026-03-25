import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
}

export interface IStorageProvider {
  upload(filename: string, buffer: Buffer, mimetype: string): Promise<UploadResult>;
  delete(filename: string): Promise<void>;
}

/**
 * Local disk storage provider.
 * Files are stored in the configured UPLOAD_DIR and served as static assets.
 */
@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR', './uploads');
    const appUrl = this.config.get<string>('APP_URL', `http://localhost:${this.config.get('PORT', 3001)}`);
    this.baseUrl = `${appUrl}/uploads`;

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(filename: string, buffer: Buffer, _mimetype: string): Promise<UploadResult> {
    const filePath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    return {
      url: `${this.baseUrl}/${filename}`,
      filename,
      size: buffer.length,
    };
  }

  async delete(filename: string): Promise<void> {
    const filePath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * S3-compatible storage provider stub.
 * Implement this to support AWS S3, MinIO, DigitalOcean Spaces, etc.
 *
 * Required env vars: S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY
 * Optional: S3_ENDPOINT (for MinIO / DO Spaces)
 */
@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(private config: ConfigService) {}

  async upload(filename: string, buffer: Buffer, mimetype: string): Promise<UploadResult> {
    // Example AWS SDK v3 implementation (install @aws-sdk/client-s3):
    // const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    // const client = new S3Client({ region: this.config.get('S3_REGION') });
    // const bucket = this.config.getOrThrow('S3_BUCKET');
    // await client.send(new PutObjectCommand({ Bucket: bucket, Key: filename, Body: buffer, ContentType: mimetype }));
    // return { url: `https://${bucket}.s3.amazonaws.com/${filename}`, filename, size: buffer.length };
    this.logger.warn('S3StorageProvider is not yet implemented');
    throw new Error('S3 storage not configured');
  }

  async delete(filename: string): Promise<void> {
    // const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
    // const client = new S3Client({ region: this.config.get('S3_REGION') });
    // await client.send(new DeleteObjectCommand({ Bucket: this.config.getOrThrow('S3_BUCKET'), Key: filename }));
    this.logger.warn('S3StorageProvider.delete is not yet implemented');
  }
}

/**
 * StorageService selects the active provider based on the STORAGE_DRIVER env var.
 * Default: 'local'. Set STORAGE_DRIVER=s3 for S3-compatible storage.
 */
@Injectable()
export class StorageService {
  private readonly provider: IStorageProvider;
  private readonly logger = new Logger(StorageService.name);

  constructor(private config: ConfigService) {
    const driver = this.config.get<string>('STORAGE_DRIVER', 'local');
    if (driver === 's3') {
      this.provider = new S3StorageProvider(config);
      this.logger.log('Storage driver: S3');
    } else {
      this.provider = new LocalStorageProvider(config);
      this.logger.log('Storage driver: local');
    }
  }

  async upload(filename: string, buffer: Buffer, mimetype: string): Promise<UploadResult> {
    return this.provider.upload(filename, buffer, mimetype);
  }

  async delete(filename: string): Promise<void> {
    return this.provider.delete(filename);
  }
}
