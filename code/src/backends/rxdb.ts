/**
 * RxDB storage backend for NoSQL document-based storage
 */

import type { FileMetadata } from '../core/types.js';
import type { BackendInterface } from './types.js';
import { Logger, CategoryLogger } from '../core/logger.js';
import { createRxDatabase, RxDatabase, RxCollection, RxDocument } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';

// Document schema for file storage
export interface FileDocument {
  path: string;          // Primary key
  data: string;          // Base64 encoded file content
  size: number;
  mtime: number;         // Unix timestamp
  isDirectory: boolean;
  permissions: number;
  mimeType?: string;
}

// RxDB document type
export type FileDocumentType = RxDocument<FileDocument>;

// Collection type
export type FileCollection = RxCollection<FileDocument>;

// Database type with our collection
export interface RxDBDatabase extends RxDatabase<{
  files: FileCollection;
}> {}

// RxDB schema definition
const fileSchema = {
  version: 0,
  primaryKey: 'path',
  type: 'object',
  properties: {
    path: {
      type: 'string',
      maxLength: 1000
    },
    data: {
      type: 'string'
    },
    size: {
      type: 'number',
      minimum: 0
    },
    mtime: {
      type: 'number'
    },
    isDirectory: {
      type: 'boolean'
    },
    permissions: {
      type: 'number'
    },
    mimeType: {
      type: 'string'
    }
  },
  required: ['path', 'data', 'size', 'mtime', 'isDirectory', 'permissions']
};

export interface RxDBBackendOptions {
  name?: string;
  inMemory?: boolean;
  password?: string;
}

export class RxDBBackend implements BackendInterface {
  private db?: RxDBDatabase;
  private readonly logger: CategoryLogger;
  private readonly options: RxDBBackendOptions;

  constructor(options: RxDBBackendOptions = {}) {
    this.logger = Logger.getInstance().createChildLogger('RxDBBackend');
    this.options = {
      name: options.name || 'packfs',
      inMemory: options.inMemory ?? true,
      password: options.password
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing RxDB backend', { options: this.options });
    
    try {
      // Create database
      const db = await createRxDatabase<{
        files: FileCollection;
      }>({
        name: this.options.name!,
        storage: getRxStorageMemory(), // Use in-memory storage by default
        password: this.options.password,
        multiInstance: false,
        eventReduce: true
      });

      // Create collection
      await db.addCollections({
        files: {
          schema: fileSchema
        }
      });

      this.db = db as RxDBDatabase;

      this.logger.info('RxDB backend initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize RxDB backend', error);
      throw new Error(`Failed to initialize RxDB backend: ${error}`);
    }
  }

  async read(path: string): Promise<Buffer> {
    this.logger.debug(`Reading file: ${path}`);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const doc = await this.db.files.findOne({
        selector: { path }
      }).exec();

      if (!doc) {
        this.logger.error(`File not found: ${path}`);
        throw new Error(`File not found: ${path}`);
      }

      // Convert base64 back to Buffer
      const buffer = Buffer.from(doc.data, 'base64');
      this.logger.info(`Successfully read file: ${path}`, { size: buffer.length });
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to read file: ${path}`, error);
      throw error;
    }
  }

  async write(path: string, data: Buffer): Promise<void> {
    this.logger.debug(`Writing file: ${path}`, { size: data.length });
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const fileData: FileDocument = {
        path,
        data: data.toString('base64'), // Convert Buffer to base64 for storage
        size: data.length,
        mtime: Date.now(),
        isDirectory: false,
        permissions: 0o644
      };

      // Upsert the document
      await this.db.files.upsert(fileData);
      
      this.logger.info(`Successfully wrote file: ${path}`, { size: data.length });
    } catch (error) {
      this.logger.error(`Failed to write file: ${path}`, error);
      throw new Error(`Failed to write file ${path}: ${error}`);
    }
  }

  async exists(path: string): Promise<boolean> {
    this.logger.debug(`Checking existence: ${path}`);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const count = await this.db.files.count({
        selector: { path }
      }).exec();

      const exists = count > 0;
      this.logger.debug(`File ${exists ? 'exists' : 'does not exist'}: ${path}`);
      return exists;
    } catch (error) {
      this.logger.error(`Failed to check existence: ${path}`, error);
      throw error;
    }
  }

  async stat(path: string): Promise<FileMetadata> {
    this.logger.debug(`Getting file stats: ${path}`);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const doc = await this.db.files.findOne({
        selector: { path }
      }).exec();

      if (!doc) {
        this.logger.error(`File not found: ${path}`);
        throw new Error(`File not found: ${path}`);
      }

      const metadata: FileMetadata = {
        path: doc.path,
        size: doc.size,
        mtime: new Date(doc.mtime),
        isDirectory: doc.isDirectory,
        permissions: doc.permissions,
        mimeType: doc.mimeType
      };

      this.logger.debug(`Got file stats: ${path}`, metadata);
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to get stats: ${path}`, error);
      throw error;
    }
  }

  async list(path: string): Promise<string[]> {
    this.logger.debug(`Listing directory: ${path}`);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Normalize path
      const normalizedPath = path.endsWith('/') ? path : path + '/';
      
      // Find all documents with paths that start with the directory path
      const docs = await this.db.files.find({
        selector: {
          path: {
            $regex: `^${normalizedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^/]+$`
          }
        }
      }).exec();

      // Extract just the filenames
      const entries = docs.map(doc => {
        const fullPath = doc.path;
        const relativePath = fullPath.substring(normalizedPath.length);
        return relativePath;
      });

      this.logger.info(`Listed directory: ${path}`, { count: entries.length });
      return entries;
    } catch (error) {
      this.logger.error(`Failed to list directory: ${path}`, error);
      throw new Error(`Failed to list directory ${path}: ${error}`);
    }
  }

  async delete(path: string): Promise<void> {
    this.logger.debug(`Deleting: ${path}`);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const doc = await this.db.files.findOne({
        selector: { path }
      }).exec();

      if (!doc) {
        this.logger.error(`File not found: ${path}`);
        throw new Error(`File not found: ${path}`);
      }

      await doc.remove();
      this.logger.info(`Deleted file: ${path}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${path}`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up RxDB backend');
    
    if (this.db) {
      try {
        await this.db.destroy();
        this.db = undefined;
        this.logger.info('RxDB backend cleaned up successfully');
      } catch (error) {
        this.logger.error('Failed to cleanup RxDB backend', error);
        throw error;
      }
    }
  }

  /**
   * Get direct access to the RxDB database (for advanced queries)
   */
  getDatabase(): RxDBDatabase | undefined {
    return this.db;
  }

  /**
   * Create indexes for better query performance
   */
  async createIndexes(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.logger.info('Creating RxDB indexes');
    
    // Note: RxDB automatically creates indexes for schema properties marked as indexed
    // For more complex indexing, you would modify the schema definition
    
    this.logger.info('Indexes configured in schema');
  }
}