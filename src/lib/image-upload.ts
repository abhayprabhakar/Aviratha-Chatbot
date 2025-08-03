import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

export interface UploadedImage {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  publicUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

export class ImageUploadService {
  private readonly publicDir = join(process.cwd(), 'public', 'plant-images');
  private readonly tempDir = join(process.cwd(), 'uploads', 'temp');
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await mkdir(this.publicDir, { recursive: true });
      await mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create directories:', error);
    }
  }

  async uploadPlantImage(file: File, sessionId: string): Promise<UploadedImage> {
    // Validate file
    this.validateFile(file);

    // Generate secure filename
    const imageId = crypto.randomUUID();
    const fileExt = this.getFileExtension(file.name);
    const fileName = `${imageId}_${Date.now()}${fileExt}`;
    const sessionPrefix = crypto.createHash('md5').update(sessionId).digest('hex').substring(0, 8);
    const secureFileName = `${sessionPrefix}_${fileName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public directory for serving
    const publicPath = join(this.publicDir, secureFileName);
    await writeFile(publicPath, buffer);

    // Return upload info
    return {
      id: imageId,
      originalName: file.name,
      fileName: secureFileName,
      filePath: publicPath,
      publicUrl: `/plant-images/${secureFileName}`,
      fileSize: file.size,
      mimeType: file.type,
      uploadedAt: new Date()
    };
  }

  private validateFile(file: File) {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new Error(`File size too large. Maximum allowed: ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // Check file type
    if (!this.allowedTypes.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed: ${this.allowedTypes.join(', ')}`);
    }

    // Check filename for security
    if (this.containsSuspiciousChars(file.name)) {
      throw new Error('Invalid filename characters detected');
    }
  }

  private containsSuspiciousChars(filename: string): boolean {
    const suspiciousPatterns = [
      /\.\./,           // Directory traversal
      /[<>:"|?*]/,      // Windows forbidden chars
      /[\x00-\x1f]/,    // Control characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i  // Windows reserved names
    ];

    return suspiciousPatterns.some(pattern => pattern.test(filename));
  }

  private getFileExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    if (!ext || !validExtensions.includes(ext)) {
      return '.jpg'; // Default to jpg
    }
    
    return `.${ext}`;
  }

  async deleteImage(fileName: string): Promise<boolean> {
    try {
      const filePath = join(this.publicDir, fileName);
      await unlink(filePath);
      return true;
    } catch (error) {
      console.error('Failed to delete image:', error);
      return false;
    }
  }

  // Clean up old images (call this periodically)
  async cleanupOldImages(maxAgeHours: number = 24): Promise<void> {
    try {
      const { readdir, stat } = await import('fs/promises');
      const files = await readdir(this.publicDir);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = join(this.publicDir, file);
        const stats = await stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await this.deleteImage(file);
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

export const imageUploadService = new ImageUploadService();