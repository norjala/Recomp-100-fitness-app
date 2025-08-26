import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getConfig } from "./config";

export class ObjectNotFoundError extends Error {
  constructor(message = "Object not found") {
    super(message);
    this.name = "ObjectNotFoundError";
  }
}

export class ObjectStorageService {
  private uploadsDir: string;
  
  constructor() {
    // Store files in persistent directory for Railway deployment
    this.uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    this.ensureUploadsDir();
  }
  
  private async ensureUploadsDir(): Promise<void> {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }
  
  async storeFile(filename: string, buffer: Buffer): Promise<string> {
    const objectId = randomUUID();
    const extension = path.extname(filename);
    const storedFilename = `${objectId}${extension}`;
    const filepath = path.join(this.uploadsDir, storedFilename);
    
    await fs.writeFile(filepath, buffer);
    return `/objects/uploads/${storedFilename}`;
  }
  
  async getObjectEntityFile(objectPath: string): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
    if (!objectPath.startsWith("/objects/uploads/")) {
      throw new ObjectNotFoundError(`Invalid object path: ${objectPath}`);
    }
    
    const filename = path.basename(objectPath);
    const filepath = path.join(this.uploadsDir, filename);
    
    try {
      const buffer = await fs.readFile(filepath);
      const extension = path.extname(filename).toLowerCase();
      
      // Determine MIME type based on extension
      const mimeTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', 
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf'
      };
      
      const mimetype = mimeTypes[extension] || 'application/octet-stream';
      
      return { buffer, filename, mimetype };
    } catch (error) {
      throw new ObjectNotFoundError(`File not found: ${objectPath}`);
    }
  }
  
  async deleteFile(objectPath: string): Promise<void> {
    if (!objectPath.startsWith("/objects/uploads/")) {
      throw new ObjectNotFoundError(`Invalid object path: ${objectPath}`);
    }
    
    const filename = path.basename(objectPath);
    const filepath = path.join(this.uploadsDir, filename);
    
    try {
      await fs.unlink(filepath);
    } catch (error) {
      // File might not exist, which is ok for delete operation
      console.warn(`Could not delete file ${filepath}:`, error);
    }
  }
  
  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/objects/uploads/")) {
      return rawPath;
    }
    
    if (rawPath.startsWith("https://")) {
      const url = new URL(rawPath);
      const pathParts = url.pathname.split('/');
      const entityId = pathParts[pathParts.length - 1];
      return `/objects/uploads/${entityId}`;
    }
    
    return rawPath;
  }
  
  getUploadDirectory(): string {
    return this.uploadsDir;
  }
  
  validateFileType(mimetype: string): boolean {
    const config = getConfig();
    const allowedTypes = config.ALLOWED_FILE_TYPES.split(',').map(t => t.trim());
    return allowedTypes.includes(mimetype);
  }
  
  validateFileSize(size: number): boolean {
    const config = getConfig();
    return size <= config.MAX_FILE_SIZE;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: any): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(): Promise<boolean> {
    return true;
  }

  async downloadObject(objectPath: string, res: any, cacheTtlSec: number = 3600): Promise<void> {
    try {
      const { buffer, filename, mimetype } = await this.getObjectEntityFile(objectPath);
      
      res.set({
        "Content-Type": mimetype,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
        "Content-Length": buffer.length.toString()
      });
      
      res.status(200).send(buffer);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ message: "File not found" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  }
}

export const objectStorage = new ObjectStorageService();