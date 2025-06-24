# Backend Key Locations

## Purpose
This document maps key locations in the PackFS codebase related to backend implementations, providing quick reference for developers working on new backends or maintaining existing ones.

## Classification
- **Domain:** Architecture
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established
- **Lifecycle Stage:** Active
- **Audience:** Developers

## Content

### Backend Interface Definition

**What**: Core backend interface that all storage backends must implement
**Where**: `/workspace/code/src/backends/types.ts:5-14`
**Summary**: Defines the contract with methods: initialize, read, write, exists, stat, list, delete, cleanup
**Significance**: This is the primary contract that the CamaDB backend must implement
**See also**: [[architecture/component_map.md#backend-layer-boundary]]

### Existing Backend Implementations

#### Memory Backend
**What**: In-memory storage implementation using Map data structure
**Where**: `/workspace/code/src/backends/memory.ts:1-120`
**Summary**: Stores files as Buffer objects in a Map, includes comprehensive logging
**Significance**: Good reference for implementing logging and basic operations
**Key insights**:
- Uses CategoryLogger for consistent logging
- Stores both file data and metadata in memory
- Implements directory creation recursively

#### Disk Backend  
**What**: File system-based storage with sandboxing
**Where**: `/workspace/code/src/backends/disk.ts:1-150`
**Summary**: Uses Node.js fs promises API with configurable base path
**Significance**: Reference for error handling and path normalization
**Key insights**:
- Comprehensive error handling patterns
- Path validation and sandboxing
- Directory creation with recursive option

### Backend Factory Pattern

**What**: Backend instantiation and registration
**Where**: `/workspace/code/src/backends/index.ts:10-25`
**Summary**: Exports all backend implementations and types
**Significance**: New backends must be added here for framework access

### Security Integration Points

#### Path Validation
**What**: Security checks for all file operations
**Where**: `/workspace/code/src/core/path-validator.ts:15-45`
**Summary**: Validates paths to prevent traversal attacks
**Significance**: All backends must use this for path normalization

#### Security Engine
**What**: Central security validation
**Where**: `/workspace/code/src/core/security.ts:20-80`
**Summary**: Validates operations, extensions, and file sizes
**Significance**: Backends should integrate with security checks

### Test Infrastructure

#### Backend Test Suite
**What**: Common tests for all backends
**Where**: `/workspace/code/tests/backends/` directory
**Summary**: Shared test cases that all backends must pass
**Key files**:
- `memory.test.ts` - Memory backend specific tests
- `disk.test.ts` - Disk backend specific tests
- Test utilities for backend testing

### Type Definitions

#### FileMetadata Type
**What**: Standard metadata structure for files
**Where**: `/workspace/code/src/types/index.ts:15-22`
**Summary**: Defines size, mtime, isDirectory, permissions, mimeType
**Significance**: Return type for stat() method

#### Backend Options
**What**: Configuration interfaces for backends
**Where**: `/workspace/code/src/backends/types.ts:16-30`
**Summary**: Base options and backend-specific configurations
**Significance**: Pattern for CamaDBBackendOptions

### Integration Points

#### FileSystem Class
**What**: Main entry point using backends
**Where**: `/workspace/code/src/core/filesystem.ts:1-200`
**Summary**: Wraps backend with security and processing
**Significance**: Shows how backends are consumed

#### Logger System
**What**: Structured logging using winston
**Where**: `/workspace/code/src/utils/logger.ts:1-50`
**Summary**: CategoryLogger for component-specific logging
**Significance**: Use for consistent logging in CamaDB backend

### Build Configuration

#### TypeScript Configuration
**What**: Build settings for backends
**Where**: `/workspace/tsconfig.json` and `/workspace/tsconfig.*.json`
**Summary**: Dual module support (ESM/CommonJS)
**Significance**: Ensure CamaDB backend compiles correctly

#### Package Exports
**What**: NPM package entry points
**Where**: `/workspace/package.json:exports`
**Summary**: Defines how backends are exported
**Significance**: May need updates for CamaDB backend

### Common Patterns Discovered

1. **Error Handling Pattern**
   ```typescript
   try {
     // operation
   } catch (error) {
     this.logger.error(`Operation failed: ${error.message}`);
     throw new Error(`Backend operation failed: ${error.message}`);
   }
   ```

2. **Path Normalization Pattern**
   ```typescript
   const normalizedPath = path.normalize(inputPath);
   const fullPath = path.join(this.basePath, normalizedPath);
   ```

3. **Async Initialization Pattern**
   ```typescript
   async initialize(): Promise<void> {
     // Setup code
     this.logger.info('Backend initialized');
   }
   ```

4. **Directory Creation Pattern**
   ```typescript
   await fs.mkdir(dirPath, { recursive: true });
   ```

## Relationships
- **Parent Nodes:** [architecture/component_map.md]
- **Child Nodes:** None
- **Related Nodes:** 
  - [architecture/camadb_backend_design.md] - uses - Implementation reference
  - [architecture/implementation_details.md] - extends - Implementation patterns
  - [connections/interfaces.md] - documents - Interface locations

## Navigation Guidance
- **Access Context:** Quick reference when implementing new backends
- **Common Next Steps:** Examine specific files, implement backend methods
- **Related Tasks:** Backend development, debugging, maintenance
- **Update Patterns:** Update when backend architecture changes

## Metadata
- **Created:** 2025-06-24
- **Last Updated:** 2025-06-24
- **Updated By:** Claude Code
- **Status:** Active

## Change History
- 2025-06-24: Initial documentation of backend key locations for CamaDB implementation