import { randomUUID } from "crypto";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

export class ObjectStorageService {
  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    return `https://storage.example.com/uploads/${objectId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<any> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    return { name: objectPath, exists: () => Promise.resolve([true]) };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://")) return rawPath;
    const url = new URL(rawPath);
    const pathParts = url.pathname.split('/');
    const entityId = pathParts[pathParts.length - 1];
    return `/objects/uploads/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: any): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(): Promise<boolean> {
    return true;
  }

  async downloadObject(file: any, res: any, cacheTtlSec: number = 3600) {
    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
    });
    res.status(200).end();
  }
}