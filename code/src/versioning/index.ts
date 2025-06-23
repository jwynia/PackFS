/**
 * Git versioning support for PackFS
 */

export { GitWrapper } from './git-wrapper.js';
export type { GitConfig, GitStatus } from './git-wrapper.js';

export { VersionedDiskSemanticBackend } from './versioned-disk-semantic-backend.js';
export type { VersionedSemanticConfig } from './versioned-disk-semantic-backend.js';

export type {
  VersioningConfig,
  TaskConfig,
  TaskResult,
  CompleteTaskOptions,
  TaskState,
  CommitResult,
  HistoryResult
} from './types.js';