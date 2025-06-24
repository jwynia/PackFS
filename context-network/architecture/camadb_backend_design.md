# CamaDB Backend Design

## Purpose
This document describes the design and architecture for implementing a MongoDB-like backend for PackFS using CamaDB, a TypeScript-native embedded database with MongoDB-style queries.

## Classification
- **Domain:** Architecture
- **Stability:** Dynamic
- **Abstraction:** Detailed
- **Confidence:** Speculative
- **Lifecycle Stage:** Planning
- **Audience:** Developers, Architects

## Content

### Overview

CamaDB is a NoSQL embedded database written in pure TypeScript that provides MongoDB-style queries without external dependencies. It offers multiple persistence adapters (fs, IndexedDB, localStorage, in-memory) making it suitable for various JavaScript environments including Node.js, Electron, and browsers.

### Design Goals

1. **Seamless Integration**: Implement the existing `BackendInterface` without modifications
2. **Document-Based Storage**: Store files as documents with rich metadata
3. **Query Capabilities**: Enable advanced file searches using MongoDB-style queries
4. **Multi-Environment Support**: Work in Node.js, browsers, and Electron
5. **Performance**: Leverage CamaDB's indexing for fast path lookups
6. **Type Safety**: Maintain TypeScript type safety throughout

### Architecture

#### Component Structure

```typescript
// File: /workspace/code/src/backends/camadb.ts
export class CamaDBBackend implements BackendInterface {
  private db: Cama;
  private filesCollection: Collection<FileDocument>;
  private logger: CategoryLogger;
  
  constructor(private options: CamaDBBackendOptions) {
    this.logger = new CategoryLogger('CamaDBBackend', options.logLevel);
  }
  
  async initialize(): Promise<void> {
    // Initialize CamaDB and create collections
  }
  
  // Implement all BackendInterface methods
}
```

#### Document Schema

```typescript
interface FileDocument {
  _id: string;              // Auto-generated unique ID
  path: string;             // File path (indexed, unique)
  data: Buffer;             // File contents as Buffer
  isDirectory: boolean;     // Directory flag
  parent: string;           // Parent directory path (indexed)
  metadata: {
    size: number;           // File size in bytes
    mtime: Date;            // Modified time
    ctime: Date;            // Created time
    permissions: number;    // Unix-style permissions
    mimeType?: string;      // MIME type
    encoding?: string;      // Character encoding
  };
  version: number;          // Document version for optimistic locking
  tags?: string[];          // Optional tags for categorization
  checksum?: string;        // Optional file checksum
}
```

#### Configuration Options

```typescript
interface CamaDBBackendOptions {
  dbPath?: string;          // Database storage path (default: './.packfs-cama')
  adapter?: 'fs' | 'indexeddb' | 'localstorage' | 'inmemory';
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  indexes?: IndexDefinition[];
  maxFileSize?: number;     // Maximum file size in bytes
  enableVersioning?: boolean;
  compressionThreshold?: number; // Compress files larger than this
}
```

### Implementation Details

#### Collection Initialization

```typescript
async initialize(): Promise<void> {
  this.db = new Cama({
    path: this.options.dbPath || './.packfs-cama',
    persistenceAdapter: this.options.adapter || 'fs',
    logLevel: this.options.logLevel || 'error'
  });
  
  this.filesCollection = await this.db.initCollection<FileDocument>('files', {
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
      { columns: ['path'], unique: true },
      { columns: ['parent'] },
      { columns: ['metadata.mtime'] },
      { columns: ['tags'] },
      ...(this.options.indexes || [])
    ]
  });
  
  this.logger.info('CamaDB backend initialized');
}
```

#### Core Operations

##### Read Operation
```typescript
async read(path: string): Promise<Buffer> {
  const normalizedPath = this.normalizePath(path);
  
  const doc = await this.filesCollection.findOne({ path: normalizedPath });
  if (!doc) {
    throw new Error(`File not found: ${path}`);
  }
  
  if (doc.isDirectory) {
    throw new Error(`Path is a directory: ${path}`);
  }
  
  this.logger.debug(`Read file: ${path} (${doc.metadata.size} bytes)`);
  return doc.data;
}
```

##### Write Operation
```typescript
async write(path: string, data: Buffer): Promise<void> {
  const normalizedPath = this.normalizePath(path);
  const parentPath = this.getParentPath(normalizedPath);
  
  // Ensure parent directory exists
  await this.ensureDirectory(parentPath);
  
  const now = new Date();
  const fileDoc: FileDocument = {
    _id: undefined, // Let CamaDB generate
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
  
  // Upsert operation - update if exists, insert if not
  const existing = await this.filesCollection.findOne({ path: normalizedPath });
  if (existing) {
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
  } else {
    await this.filesCollection.insertOne(fileDoc);
  }
  
  this.logger.debug(`Wrote file: ${path} (${data.length} bytes)`);
}
```

##### Directory Listing
```typescript
async list(dirPath: string): Promise<string[]> {
  const normalizedPath = this.normalizePath(dirPath);
  
  // Check if directory exists
  const dirDoc = await this.filesCollection.findOne({ 
    path: normalizedPath,
    isDirectory: true 
  });
  
  if (!dirDoc && normalizedPath !== '/') {
    throw new Error(`Directory not found: ${dirPath}`);
  }
  
  // Find all direct children
  const children = await this.filesCollection.find({ 
    parent: normalizedPath 
  });
  
  return children.map(doc => path.basename(doc.path));
}
```

##### File Statistics
```typescript
async stat(path: string): Promise<FileMetadata> {
  const normalizedPath = this.normalizePath(path);
  
  const doc = await this.filesCollection.findOne({ path: normalizedPath });
  if (!doc) {
    throw new Error(`Path not found: ${path}`);
  }
  
  return {
    size: doc.metadata.size,
    mtime: doc.metadata.mtime,
    isDirectory: doc.isDirectory,
    permissions: doc.metadata.permissions,
    mimeType: doc.metadata.mimeType
  };
}
```

### Advanced Features

#### 1. Query-Based Operations

```typescript
// Extension method for advanced queries
async findFiles(query: any): Promise<FileDocument[]> {
  return await this.filesCollection.find(query);
}

// Example: Find all TypeScript files modified in last week
const recentTsFiles = await backend.findFiles({
  path: { $regex: /\.ts$/ },
  'metadata.mtime': { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
});
```

#### 2. Aggregation Support

```typescript
// Get storage statistics
async getStorageStats(): Promise<StorageStats> {
  const result = await this.filesCollection.aggregate([
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$metadata.size' },
        avgSize: { $avg: '$metadata.size' }
      }
    }
  ]);
  
  return result[0] || { totalFiles: 0, totalSize: 0, avgSize: 0 };
}
```

#### 3. Tag-Based Organization

```typescript
// Add tags to files
async tagFile(path: string, tags: string[]): Promise<void> {
  await this.filesCollection.updateOne(
    { path: this.normalizePath(path) },
    { $addToSet: { tags: { $each: tags } } }
  );
}

// Find files by tag
async findByTags(tags: string[]): Promise<string[]> {
  const docs = await this.filesCollection.find({
    tags: { $in: tags }
  });
  return docs.map(doc => doc.path);
}
```

#### 4. Version History (Optional)

```typescript
interface FileVersion extends FileDocument {
  originalPath: string;
  versionNumber: number;
  versionDate: Date;
}

// Store version history in separate collection
async createVersion(path: string): Promise<void> {
  const doc = await this.filesCollection.findOne({ path });
  if (!doc) return;
  
  const versionDoc: FileVersion = {
    ...doc,
    originalPath: doc.path,
    versionNumber: doc.version,
    versionDate: new Date()
  };
  
  await this.versionsCollection.insertOne(versionDoc);
}
```

### Error Handling

```typescript
class CamaDBError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'CamaDBError';
  }
}

// Wrap CamaDB errors with context
private async wrapOperation<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new CamaDBError(
      `CamaDB operation failed: ${context}`,
      'CAMADB_ERROR',
      error as Error
    );
  }
}
```

### Performance Considerations

1. **Indexing Strategy**:
   - Primary index on `path` for fast lookups
   - Secondary index on `parent` for directory listings
   - Optional indexes on `metadata.mtime` and `tags` for queries

2. **Data Compression**:
   - Compress large files before storage
   - Use threshold to determine when to compress

3. **Caching Layer**:
   - Implement LRU cache for frequently accessed files
   - Cache directory listings

4. **Batch Operations**:
   - Use `insertMany` for bulk imports
   - Batch updates for better performance

### Security Considerations

1. **Path Validation**: Inherit from existing PackFS security
2. **Data Encryption**: Optional encryption at rest
3. **Access Control**: Leverage document-level permissions
4. **Audit Trail**: Track all operations with timestamps

### Testing Strategy

1. **Unit Tests**:
   - Test each method independently
   - Mock CamaDB for isolated testing

2. **Integration Tests**:
   - Test with real CamaDB instance
   - Test all persistence adapters

3. **Performance Tests**:
   - Benchmark against existing backends
   - Test with large datasets

4. **Environment Tests**:
   - Test in Node.js
   - Test in browser with IndexedDB
   - Test in Electron

## Relationships
- **Parent Nodes:** [architecture/component_map.md]
- **Child Nodes:** None yet (implementation pending)
- **Related Nodes:** 
  - [architecture/component_map.md#disk-backend] - references - Existing backend example
  - [architecture/component_map.md#memory-backend] - references - In-memory backend pattern
  - [decisions/adr_001_typescript_npm_package_setup_for_mastra_compatibility.md] - guides - TypeScript setup

## Navigation Guidance
- **Access Context:** Reference this design when implementing the CamaDB backend
- **Common Next Steps:** Create implementation plan, review with team, begin implementation
- **Related Tasks:** Backend implementation, testing setup, performance benchmarking
- **Update Patterns:** Update as implementation reveals new requirements or optimizations

## Metadata
- **Created:** 2025-06-24
- **Last Updated:** 2025-06-24
- **Updated By:** Claude Code
- **Status:** Planning

## Change History
- 2025-06-24: Initial design document created based on CamaDB research and PackFS backend architecture