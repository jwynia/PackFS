# CamaDB Backend for PackFS

The CamaDB backend provides MongoDB-like embedded database storage for PackFS with advanced query capabilities.

## Features

- **MongoDB-style queries**: Use familiar MongoDB query syntax
- **Multi-environment support**: Works in Node.js, browsers, and Electron
- **Document-based storage**: Files stored as rich documents with metadata
- **Advanced search**: Query files by metadata, tags, or content properties
- **No external dependencies**: Pure TypeScript implementation

## Installation

The CamaDB backend is included with PackFS. Make sure you have the required dependencies:

```bash
npm install reflect-metadata
```

## Basic Usage

```typescript
import { CamaDBBackend } from 'packfs-core/backends';

// Create and initialize backend
const backend = new CamaDBBackend({
  dbPath: './.packfs-db',
  adapter: 'fs',          // or 'indexeddb', 'localstorage', 'inmemory'
  logLevel: 'info'
});

await backend.initialize();

// Use standard PackFS operations
await backend.write('/hello.txt', Buffer.from('Hello World'));
const content = await backend.read('/hello.txt');
```

## Configuration Options

```typescript
interface CamaDBBackendOptions {
  dbPath?: string;              // Database storage path (default: './.packfs-cama')
  adapter?: 'fs' | 'indexeddb' | 'localstorage' | 'inmemory';
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  maxFileSize?: number;         // Maximum file size in bytes
  enableVersioning?: boolean;   // Enable file versioning
  compressionThreshold?: number; // Compress files larger than this
}
```

## Adapter Selection

Choose the appropriate adapter based on your environment:

- **`fs`**: Node.js filesystem (persistent)
- **`indexeddb`**: Browser storage for larger datasets
- **`localstorage`**: Browser storage for smaller datasets
- **`inmemory`**: Temporary storage (testing/caching)

## Advanced Features

### 1. File Tagging

```typescript
// Add tags to files
await backend.tagFile('/docs/README.md', ['documentation', 'important']);

// Find files by tags
const importantFiles = await backend.findByTags(['important']);
```

### 2. MongoDB-Style Queries

```typescript
// Find all TypeScript files
const tsFiles = await backend.findFiles({ 
  path: { $regex: /\.ts$/ } 
});

// Find recently modified files
const recentFiles = await backend.findFiles({
  'metadata.mtime': { $gte: new Date(Date.now() - 86400000) } // Last 24 hours
});

// Complex queries
const results = await backend.findFiles({
  $and: [
    { 'metadata.size': { $gt: 1024 } },        // Larger than 1KB
    { tags: { $in: ['important', 'todo'] } },  // Has specific tags
    { path: { $regex: /^\/src\// } }           // In src directory
  ]
});
```

### 3. File Metadata

Each file stored includes rich metadata:

```typescript
{
  path: string;
  size: number;
  mtime: Date;         // Modified time
  ctime: Date;         // Created time
  isDirectory: boolean;
  permissions: number;
  mimeType?: string;
  encoding?: string;
  version: number;
  tags?: string[];
  checksum?: string;
}
```

## Performance Considerations

1. **Indexing**: CamaDB automatically indexes on `path` (unique), `parent`, `metadata.mtime`, and `tags`
2. **Memory Usage**: The `inmemory` adapter keeps all data in RAM
3. **Query Performance**: Complex queries may be slower on large datasets
4. **File Size**: Large files impact memory usage and query performance

## Limitations

1. **No streaming**: Files are loaded entirely into memory
2. **Delete operations**: Files are marked as deleted, not physically removed
3. **Transactions**: No multi-operation transaction support
4. **Binary data**: Stored as Buffer objects, which may impact performance

## Migration from Other Backends

To migrate from another backend to CamaDB:

```typescript
import { DiskBackend, CamaDBBackend } from 'packfs-core/backends';

const oldBackend = new DiskBackend({ basePath: './data' });
const newBackend = new CamaDBBackend({ dbPath: './camadb' });

await oldBackend.initialize();
await newBackend.initialize();

// Migrate files
const files = await oldBackend.list('/');
for (const file of files) {
  const content = await oldBackend.read(`/${file}`);
  await newBackend.write(`/${file}`, content);
}
```

## Troubleshooting

### Error: "Cannot read properties of undefined (reading 'columns')"

This occurs with the `fs` adapter in certain environments. Try:
1. Use the `inmemory` adapter for testing
2. Ensure the database path is writable
3. Check that `reflect-metadata` is imported

### Performance Issues

1. Reduce the number of files stored
2. Use more specific queries
3. Consider using the `inmemory` adapter
4. Implement pagination for large result sets

## Future Enhancements

- Streaming support for large files
- Real delete operations
- Transaction support
- Better TypeScript types for queries
- Performance optimizations