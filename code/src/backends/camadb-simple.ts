/**
 * Simplified CamaDB backend implementation
 * This is a minimal implementation to work around CamaDB issues
 */

import 'reflect-metadata';
import * as path from 'path';
import { BackendInterface } from './types';
import { FileMetadata } from '../core/types';
import { Logger, CategoryLogger } from '../core/logger';
import * as fs from 'fs/promises';

/**
 * Simplified in-memory storage with persistence
 */
export class SimpleCamaDBBackend implements BackendInterface {
  private storage: Map<string, { data: Buffer; metadata: FileMetadata }> = new Map();
  private logger: CategoryLogger;
  private initialized = false;
  private dbPath: string;

  constructor(options: { dbPath?: string } = {}) {
    const globalLogger = Logger.getInstance();
    this.logger = globalLogger.createChildLogger('SimpleCamaDBBackend');
    this.dbPath = options.dbPath || './.packfs-simple';
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create db directory
      await fs.mkdir(this.dbPath, { recursive: true });
      
      // Load existing data if any
      try {
        const dataFile = path.join(this.dbPath, 'data.json');
        const content = await fs.readFile(dataFile, 'utf-8');
        const data = JSON.parse(content);
        
        // Restore data with Buffer conversion
        for (const [key, value] of Object.entries(data)) {
          const item = value as any;
          this.storage.set(key, {
            data: Buffer.from(item.data.data),
            metadata: {
              ...item.metadata,
              mtime: new Date(item.metadata.mtime)
            }
          });
        }
      } catch (error) {
        // No existing data
      }

      // Create root directory
      if (!this.storage.has('/')) {
        const now = new Date();
        this.storage.set('/', {
          data: Buffer.alloc(0),
          metadata: {
            path: '/',
            size: 0,
            mtime: now,
            isDirectory: true,
            permissions: 0o755
          }
        });
      }

      this.initialized = true;
      this.logger.info('SimpleCamaDB backend initialized');
    } catch (error) {
      this.logger.error('Failed to initialize', error);
      throw error;
    }
  }

  async read(filePath: string): Promise<Buffer> {
    this.ensureInitialized();
    
    const normalizedPath = this.normalizePath(filePath);
    const entry = this.storage.get(normalizedPath);
    
    if (!entry) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    if (entry.metadata.isDirectory) {
      throw new Error(`Path is a directory: ${filePath}`);
    }
    
    return entry.data;
  }

  async write(filePath: string, data: Buffer): Promise<void> {
    this.ensureInitialized();
    
    const normalizedPath = this.normalizePath(filePath);
    const parentPath = this.getParentPath(normalizedPath);
    
    // Ensure parent exists
    await this.ensureDirectory(parentPath);
    
    const now = new Date();
    this.storage.set(normalizedPath, {
      data,
      metadata: {
        path: normalizedPath,
        size: data.length,
        mtime: now,
        isDirectory: false,
        permissions: 0o644,
        mimeType: this.detectMimeType(normalizedPath)
      }
    });
    
    await this.persist();
  }

  async exists(filePath: string): Promise<boolean> {
    this.ensureInitialized();
    const normalizedPath = this.normalizePath(filePath);
    return this.storage.has(normalizedPath);
  }

  async stat(filePath: string): Promise<FileMetadata> {
    this.ensureInitialized();
    
    const normalizedPath = this.normalizePath(filePath);
    const entry = this.storage.get(normalizedPath);
    
    if (!entry) {
      throw new Error(`Path not found: ${filePath}`);
    }
    
    return entry.metadata;
  }

  async list(dirPath: string): Promise<string[]> {
    this.ensureInitialized();
    
    const normalizedPath = this.normalizePath(dirPath);
    const entry = this.storage.get(normalizedPath);
    
    if (!entry) {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    
    if (!entry.metadata.isDirectory) {
      throw new Error(`Not a directory: ${dirPath}`);
    }
    
    const children: string[] = [];
    for (const [key] of this.storage.entries()) {
      if (key !== normalizedPath && this.getParentPath(key) === normalizedPath) {
        children.push(path.basename(key));
      }
    }
    
    return children;
  }

  async delete(filePath: string): Promise<void> {
    this.ensureInitialized();
    
    const normalizedPath = this.normalizePath(filePath);
    
    if (normalizedPath === '/') {
      throw new Error('Cannot delete root directory');
    }
    
    const entry = this.storage.get(normalizedPath);
    if (!entry) {
      throw new Error(`Path not found: ${filePath}`);
    }
    
    if (entry.metadata.isDirectory) {
      // Check if empty
      const children = await this.list(normalizedPath);
      if (children.length > 0) {
        throw new Error(`Directory not empty: ${filePath}`);
      }
    }
    
    this.storage.delete(normalizedPath);
    await this.persist();
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    
    await this.persist();
    this.storage.clear();
    this.initialized = false;
    this.logger.info('SimpleCamaDB backend cleaned up');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Backend not initialized. Call initialize() first.');
    }
  }

  private normalizePath(filePath: string): string {
    let normalized = path.posix.normalize(filePath);
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  private getParentPath(filePath: string): string {
    const parent = path.posix.dirname(filePath);
    return parent === '.' ? '/' : this.normalizePath(parent);
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    const normalizedPath = this.normalizePath(dirPath);
    
    if (normalizedPath === '/') {
      return;
    }
    
    if (!this.storage.has(normalizedPath)) {
      const parentPath = this.getParentPath(normalizedPath);
      await this.ensureDirectory(parentPath);
      
      const now = new Date();
      this.storage.set(normalizedPath, {
        data: Buffer.alloc(0),
        metadata: {
          path: normalizedPath,
          size: 0,
          mtime: now,
          isDirectory: true,
          permissions: 0o755
        }
      });
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
      '.css': 'text/css'
    };
    return mimeTypes[ext];
  }

  private async persist(): Promise<void> {
    try {
      const dataFile = path.join(this.dbPath, 'data.json');
      const data: Record<string, any> = {};
      
      for (const [key, value] of this.storage.entries()) {
        data[key] = {
          data: value.data,
          metadata: value.metadata
        };
      }
      
      await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to persist data', error);
    }
  }
}