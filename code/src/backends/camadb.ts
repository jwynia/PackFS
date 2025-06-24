/**
 * CamaDB backend implementation
 * Provides MongoDB-like embedded database storage for PackFS
 */

import 'reflect-metadata';
import { Cama } from 'camadb';
import * as path from 'path';
import { BackendInterface } from './types';
import { FileMetadata } from '../core/types';
import { Logger, CategoryLogger } from '../core/logger';

/**
 * Document structure for storing files in CamaDB
 */
export interface FileDocument {
  _id?: string;
  path: string;
  data: Buffer;
  isDirectory: boolean;
  parent: string;
  metadata: {
    size: number;
    mtime: Date;
    ctime: Date;
    permissions: number;
    mimeType?: string;
    encoding?: string;
  };
  version: number;
  tags?: string[];
  checksum?: string;
}

/**
 * Configuration options for CamaDB backend
 */
export interface CamaDBBackendOptions {
  dbPath?: string;
  adapter?: 'fs' | 'indexeddb' | 'localstorage' | 'inmemory';
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  indexes?: Array<{ columns: string[]; unique?: boolean }>;
  maxFileSize?: number;
  enableVersioning?: boolean;
  compressionThreshold?: number;
}

/**
 * CamaDB backend implementation
 */
export class CamaDBBackend implements BackendInterface {
  private db!: Cama;
  private filesCollection: any; // CamaDB doesn't export Collection type
  private logger: CategoryLogger;
  private initialized = false;

  constructor(private options: CamaDBBackendOptions = {}) {
    const globalLogger = Logger.getInstance();
    this.logger = globalLogger.createChildLogger('CamaDBBackend');
  }

  /**
   * Initialize the CamaDB backend
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug('Backend already initialized');
      return;
    }

    try {
      // Initialize CamaDB instance
      this.db = new Cama({
        path: this.options.dbPath || './.packfs-cama',
        persistenceAdapter: this.options.adapter as any || 'fs',
        logLevel: this.options.logLevel as any || 'error'
      });

      // Create files collection with schema
      this.filesCollection = await this.db.initCollection('files', {
        columns: [
          { type: 'string', title: 'path' },
          { type: 'buffer', title: 'data' },
          { type: 'boolean', title: 'isDirectory' },
          { type: 'string', title: 'parent' },
          { type: 'object', title: 'metadata' },
          { type: 'number', title: 'version' },
          { type: 'array', title: 'tags' },
          { type: 'string', title: 'checksum' }
        ],
        indexes: [
          'path',
          'parent',
          'metadata.mtime',
          'tags'
        ]
      });

      // Create root directory
      await this.ensureDirectory('/');

      this.initialized = true;
      this.logger.info('CamaDB backend initialized', {
        dbPath: this.options.dbPath,
        adapter: this.options.adapter
      });
    } catch (error) {
      this.logger.error('Failed to initialize CamaDB backend', error);
      throw new Error(`CamaDB initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read file contents
   */
  async read(filePath: string): Promise<Buffer> {
    this.ensureInitialized();

    const normalizedPath = this.normalizePath(filePath);
    this.logger.debug(`Reading file: ${normalizedPath}`);

    try {
      const result = await this.filesCollection.findMany({ path: normalizedPath, _deleted: { $ne: true } });
      const docs = result.result || [];
      
      if (docs.length === 0) {
        throw new Error(`File not found: ${filePath}`);
      }

      const doc = docs[0];
      if (doc.isDirectory) {
        throw new Error(`Path is a directory: ${filePath}`);
      }

      this.logger.debug(`Read file: ${normalizedPath} (${doc.metadata.size} bytes)`);
      return doc.data;
    } catch (error) {
      this.logger.error(`Failed to read file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Write file contents
   */
  async write(filePath: string, data: Buffer): Promise<void> {
    this.ensureInitialized();

    const normalizedPath = this.normalizePath(filePath);
    const parentPath = this.getParentPath(normalizedPath);
    
    this.logger.debug(`Writing file: ${normalizedPath} (${data.length} bytes)`);

    try {
      // Ensure parent directory exists
      await this.ensureDirectory(parentPath);

      const now = new Date();
      const fileDoc: FileDocument = {
        path: normalizedPath,
        data: data,
        isDirectory: false,
        parent: parentPath,
        metadata: {
          size: data.length,
          mtime: now,
          ctime: now,
          permissions: 0o644,
          mimeType: this.detectMimeType(normalizedPath),
          encoding: this.detectEncoding(data)
        },
        version: 1,
        checksum: this.calculateChecksum(data)
      };

      // Check if file exists
      const existingResult = await this.filesCollection.findMany({ path: normalizedPath, _deleted: { $ne: true } });
      const existing = existingResult.result?.[0];
      
      if (existing) {
        // Update existing file
        await this.filesCollection.updateOne(
          { path: normalizedPath },
          {
            $set: {
              data: data,
              'metadata.size': data.length,
              'metadata.mtime': now,
              checksum: fileDoc.checksum
            },
            $inc: { version: 1 }
          }
        );
        this.logger.debug(`Updated existing file: ${normalizedPath}`);
      } else {
        // Insert new file
        await this.filesCollection.insertOne(fileDoc);
        this.logger.debug(`Created new file: ${normalizedPath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to write file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    this.ensureInitialized();

    const normalizedPath = this.normalizePath(filePath);
    
    try {
      const result = await this.filesCollection.findMany({ path: normalizedPath, _deleted: { $ne: true } });
      return result.result && result.result.length > 0;
    } catch (error) {
      this.logger.error(`Failed to check existence: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async stat(filePath: string): Promise<FileMetadata> {
    this.ensureInitialized();

    const normalizedPath = this.normalizePath(filePath);
    
    try {
      const result = await this.filesCollection.findMany({ path: normalizedPath, _deleted: { $ne: true } });
      const doc = result.result?.[0];
      
      if (!doc) {
        throw new Error(`Path not found: ${filePath}`);
      }

      return {
        path: doc.path,
        size: doc.metadata.size,
        mtime: doc.metadata.mtime,
        isDirectory: doc.isDirectory,
        permissions: doc.metadata.permissions,
        mimeType: doc.metadata.mimeType
      };
    } catch (error) {
      this.logger.error(`Failed to stat file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * List directory contents
   */
  async list(dirPath: string): Promise<string[]> {
    this.ensureInitialized();

    const normalizedPath = this.normalizePath(dirPath);
    
    try {
      // Check if directory exists
      if (normalizedPath !== '/') {
        const dirResult = await this.filesCollection.findMany({ 
          path: normalizedPath,
          isDirectory: true,
          _deleted: { $ne: true }
        });
        const dirDoc = dirResult.result?.[0];
        
        if (!dirDoc) {
          throw new Error(`Directory not found: ${dirPath}`);
        }
      }

      // Find all direct children
      const childrenResult = await this.filesCollection.findMany({ 
        parent: normalizedPath,
        _deleted: { $ne: true }
      });
      const children = childrenResult.result || [];
      
      return children.map((doc: FileDocument) => path.basename(doc.path));
    } catch (error) {
      this.logger.error(`Failed to list directory: ${dirPath}`, error);
      throw error;
    }
  }

  /**
   * Delete file or directory
   */
  async delete(filePath: string): Promise<void> {
    this.ensureInitialized();

    const normalizedPath = this.normalizePath(filePath);
    
    if (normalizedPath === '/') {
      throw new Error('Cannot delete root directory');
    }

    try {
      const result = await this.filesCollection.findMany({ path: normalizedPath, _deleted: { $ne: true } });
      const doc = result.result?.[0];
      
      if (!doc) {
        throw new Error(`Path not found: ${filePath}`);
      }

      if (doc.isDirectory) {
        // Check if directory is empty
        const childrenResult = await this.filesCollection.findMany({ parent: normalizedPath, _deleted: { $ne: true } });
        const children = childrenResult.result || [];
        if (children.length > 0) {
          throw new Error(`Directory not empty: ${filePath}`);
        }
      }

      // Mark as deleted (CamaDB doesn't have delete operation)
      await this.filesCollection.updateMany({ path: normalizedPath }, { $set: { _deleted: true } });
      this.logger.debug(`Deleted: ${normalizedPath}`);
    } catch (error) {
      this.logger.error(`Failed to delete: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      // CamaDB doesn't have explicit cleanup, but we can clear our references
      this.filesCollection = null;
      (this as any).db = null;
      this.initialized = false;
      this.logger.info('CamaDB backend cleaned up');
    } catch (error) {
      this.logger.error('Failed to cleanup CamaDB backend', error);
      throw error;
    }
  }

  /**
   * Advanced query method (CamaDB-specific feature)
   */
  async findFiles(query: any): Promise<FileDocument[]> {
    this.ensureInitialized();
    
    try {
      // Add deleted filter to user query
      const filteredQuery = { ...query, _deleted: { $ne: true } };
      const result = await this.filesCollection.findMany(filteredQuery);
      return result.result || [];
    } catch (error) {
      this.logger.error('Failed to execute query', error);
      throw error;
    }
  }

  /**
   * Add tags to a file (CamaDB-specific feature)
   */
  async tagFile(filePath: string, tags: string[]): Promise<void> {
    this.ensureInitialized();

    const normalizedPath = this.normalizePath(filePath);
    
    try {
      await this.filesCollection.updateOne(
        { path: normalizedPath },
        { $addToSet: { tags: { $each: tags } } }
      );
      this.logger.debug(`Tagged file ${normalizedPath} with: ${tags.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to tag file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Find files by tags (CamaDB-specific feature)
   */
  async findByTags(tags: string[]): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      const result = await this.filesCollection.findMany({
        tags: { $in: tags },
        _deleted: { $ne: true }
      });
      const docs = result.result || [];
      return docs.map((doc: FileDocument) => doc.path);
    } catch (error) {
      this.logger.error('Failed to find files by tags', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CamaDB backend not initialized. Call initialize() first.');
    }
  }

  private normalizePath(filePath: string): string {
    // Normalize and ensure absolute path
    let normalized = path.normalize(filePath);
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    // Remove trailing slash except for root
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  private getParentPath(filePath: string): string {
    const parent = path.dirname(filePath);
    return parent === '.' ? '/' : this.normalizePath(parent);
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    const normalizedPath = this.normalizePath(dirPath);
    
    // Skip root directory
    if (normalizedPath === '/') {
      return;
    }

    // Check if directory exists
    const existingResult = await this.filesCollection.findMany({ 
      path: normalizedPath,
      isDirectory: true,
      _deleted: { $ne: true }
    });
    const existing = existingResult.result?.[0];
    
    if (!existing) {
      // Ensure parent exists first
      const parentPath = this.getParentPath(normalizedPath);
      await this.ensureDirectory(parentPath);

      // Create directory
      const now = new Date();
      const dirDoc: FileDocument = {
        path: normalizedPath,
        data: Buffer.alloc(0),
        isDirectory: true,
        parent: parentPath,
        metadata: {
          size: 0,
          mtime: now,
          ctime: now,
          permissions: 0o755
        },
        version: 1
      };

      await this.filesCollection.insertOne(dirDoc);
      this.logger.debug(`Created directory: ${normalizedPath}`);
    }
  }

  private detectMimeType(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif'
    };
    return mimeTypes[ext];
  }

  private detectEncoding(data: Buffer): string | undefined {
    // Simple UTF-8 detection
    try {
      data.toString('utf8');
      return 'utf8';
    } catch {
      return undefined;
    }
  }

  private calculateChecksum(data: Buffer): string {
    // Simple checksum using Buffer length and first/last bytes
    // In production, use crypto.createHash('sha256')
    const length = data.length;
    const first = length > 0 ? data[0] : 0;
    const last = length > 0 ? data[length - 1] : 0;
    return `${length}-${first}-${last}`;
  }
}