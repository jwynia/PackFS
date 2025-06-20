/**
 * PackFS - Secure filesystem access for LLM agent frameworks
 */

export * from './core/index.js';
export * from './backends/index.js';
export * from './processors/index.js';
export * from './semantic/index.js';
export * from './integrations/index.js';

// Convenience exports for common use cases
import { createEnhancedFileSystem as createEnhancedFileSystemBase } from './semantic/compatibility-adapter.js';
import { DiskSemanticBackend } from './semantic/disk-semantic-backend.js';
import type { FileSystemOptions } from './core/types.js';

/**
 * Convenience factory function to create an enhanced filesystem with disk backend
 * This simplifies the common use case of creating a filesystem for a directory
 */
export function createFileSystem(rootPath: string, _options?: FileSystemOptions) {
  // Create semantic backend directly with path
  const semanticBackend = new DiskSemanticBackend(rootPath);
  
  return createEnhancedFileSystemBase(semanticBackend);
}

// Re-export types for convenience
export type {
  FileSystemInterface,
  FileSystemOptions,
  FileMetadata,
  SecurityConfig
} from './core/index.js';

export type {
  ContentProcessor
} from './processors/index.js';

// Semantic interface types
export type {
  SemanticFileSystemInterface,
  FileAccessIntent,
  FileAccessResult,
  ContentUpdateIntent,
  ContentUpdateResult,
  OrganizationIntent,
  OrganizationResult,
  DiscoveryIntent,
  DiscoveryResult,
  RemovalIntent,
  RemovalResult,
  WorkflowIntent,
  WorkflowResult,
  NaturalLanguageIntent,
  NaturalLanguageResult,
  SemanticConfig
} from './semantic/index.js';