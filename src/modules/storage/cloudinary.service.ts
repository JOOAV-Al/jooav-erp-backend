import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import { Readable } from 'stream';

export interface CloudinaryUploadOptions {
  folder?: string;
  publicId?: string;
  transformation?: any[];
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  tags?: string[];
}

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  resourceType: string;
  bytes: number;
  width?: number;
  height?: number;
  createdAt: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('cloudinary.cloudName'),
      api_key: this.configService.get('cloudinary.apiKey'),
      api_secret: this.configService.get('cloudinary.apiSecret'),
    });
  }

  /**
   * Upload file buffer to Cloudinary
   */
  async uploadFile(
    buffer: Buffer,
    options: CloudinaryUploadOptions = {},
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: options.folder || this.configService.get('cloudinary.folder'),
        public_id: options.publicId,
        transformation: options.transformation,
        resource_type: options.resourceType || 'auto',
        tags: options.tags,
        use_filename: true,
        unique_filename: !options.publicId,
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) {
            this.logger.error('Cloudinary upload failed:', error);
            reject(error);
          } else {
            this.logger.log(`File uploaded successfully: ${result.public_id}`);
            resolve({
              publicId: result.public_id,
              url: result.url,
              secureUrl: result.secure_url,
              format: result.format,
              resourceType: result.resource_type,
              bytes: result.bytes,
              width: result.width,
              height: result.height,
              createdAt: result.created_at,
            });
          }
        },
      );

      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);
      stream.pipe(uploadStream);
    });
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: Array<{ buffer: Buffer; originalname: string }>,
    options: CloudinaryUploadOptions = {},
  ): Promise<CloudinaryUploadResult[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file.buffer, {
        ...options,
        publicId: options.publicId
          ? `${options.publicId}_${Date.now()}`
          : undefined,
      }),
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      this.logger.log(`File deleted successfully: ${publicId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${publicId}`, error);
      throw error;
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(publicIds: string[]): Promise<any> {
    try {
      const result = await cloudinary.api.delete_resources(publicIds);
      this.logger.log(`Multiple files deleted: ${publicIds.join(', ')}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to delete multiple files', error);
      throw error;
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  extractPublicIdFromUrl(url: string): string {
    try {
      // Extract public ID from Cloudinary URL
      // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.jpg
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex((part) => part === 'upload');
      if (uploadIndex === -1) return '';

      // Get everything after version number (or 'upload' if no version)
      let publicIdPart = urlParts.slice(uploadIndex + 1);

      // Remove version if present (starts with 'v' followed by numbers)
      if (
        publicIdPart[0] &&
        publicIdPart[0].startsWith('v') &&
        /^v\d+$/.test(publicIdPart[0])
      ) {
        publicIdPart = publicIdPart.slice(1);
      }

      // Join the remaining parts and remove file extension
      const publicIdWithExtension = publicIdPart.join('/');
      const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
      return lastDotIndex > 0
        ? publicIdWithExtension.substring(0, lastDotIndex)
        : publicIdWithExtension;
    } catch (error) {
      this.logger.error(`Failed to extract public ID from URL: ${url}`, error);
      return '';
    }
  }

  /**
   * Delete files by URLs
   */
  async deleteFilesByUrls(urls: string[]): Promise<any> {
    try {
      const publicIds = urls
        .map((url) => this.extractPublicIdFromUrl(url))
        .filter((id) => id);
      if (publicIds.length === 0) {
        this.logger.warn('No valid public IDs found from URLs');
        return { deleted: {} };
      }
      return this.deleteMultipleFiles(publicIds);
    } catch (error) {
      this.logger.error('Failed to delete files by URLs', error);
      throw error;
    }
  }

  /**
   * Generate optimized image URL with transformations
   */
  generateOptimizedUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
      format?: string;
    } = {},
  ): string {
    return cloudinary.url(publicId, {
      transformation: [
        {
          width: options.width,
          height: options.height,
          crop: options.crop || 'fill',
          quality: options.quality || 'auto',
          fetch_format: options.format || 'auto',
        },
      ],
    });
  }

  /**
   * Get file details
   */
  async getFileDetails(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get file details: ${publicId}`, error);
      throw error;
    }
  }
}
