# PackFS Backends

PackFS supports multiple storage backends to suit different use cases and environments.

## Available Backends

### 1. Memory Backend
- **Class**: `MemoryBackend`
- **Use Case**: Testing, temporary storage, caching
- **Persistence**: None (in-memory only)
- **Performance**: Fastest
- **Limitations**: No persistence, limited by available RAM

### 2. Disk Backend
- **Class**: `DiskBackend`
- **Use Case**: Local filesystem storage
- **Persistence**: Full persistence to disk
- **Performance**: Good, limited by disk I/O
- **Features**: Sandboxing, path validation

## Choosing a Backend

| Backend | Best For | Avoid When |
|---------|----------|------------|
| Memory | Unit tests, caching | Need persistence |
| Disk | Production file storage | Need in-memory only |

## Implementation Guide

All backends implement the `BackendInterface`:

```typescript
interface BackendInterface {
  initialize(): Promise<void>;
  read(path: string): Promise<Buffer>;
  write(path: string, data: Buffer): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileMetadata>;
  list(path: string): Promise<string[]>;
  delete(path: string): Promise<void>;
  cleanup(): Promise<void>;
}
```

## Creating a Custom Backend

To create a custom backend:

1. Implement the `BackendInterface`
2. Handle path normalization
3. Implement proper error handling
4. Add logging using `CategoryLogger`
5. Export from `backends/index.ts`

Example skeleton:

```typescript
import { BackendInterface } from './types';
import { FileMetadata } from '../core/types';
import { Logger, CategoryLogger } from '../core/logger';

export class CustomBackend implements BackendInterface {
  private logger: CategoryLogger;
  
  constructor(options: CustomBackendOptions) {
    const globalLogger = Logger.getInstance();
    this.logger = globalLogger.createChildLogger('CustomBackend');
  }
  
  // Implement all required methods...
}
```