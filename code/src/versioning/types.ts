/**
 * Configuration for git versioning functionality
 */
export interface VersioningConfig {
  /**
   * Enable git versioning for this filesystem
   */
  enabled: boolean;
  
  /**
   * Automatically commit after each write operation
   * @default true
   */
  autoCommit?: boolean;
  
  /**
   * Template for generating commit messages
   * Available variables: {{operation}}, {{path}}, {{taskId}}, {{timestamp}}
   * @default "{{operation}} {{path}}"
   */
  commitMessageTemplate?: string;
  
  /**
   * Default branch name for new repositories
   * @default "main"
   */
  defaultBranch?: string;
  
  /**
   * Git user information for commits
   */
  userInfo?: {
    name: string;
    email: string;
  };
  
  /**
   * Path to git executable if not in PATH
   */
  gitPath?: string;
}

/**
 * Configuration for task-based branching
 */
export interface TaskConfig {
  /**
   * Unique identifier for the task
   */
  id: string;
  
  /**
   * Human-readable description of the task
   */
  description?: string;
  
  /**
   * Custom branch name (default: "task-{id}")
   */
  branch?: string;
  
  /**
   * Branch to create from (default: current branch)
   */
  baseBranch?: string;
  
  /**
   * Automatically merge when task is completed
   * @default false
   */
  autoMerge?: boolean;
}

/**
 * Options for completing a task
 */
export interface CompleteTaskOptions {
  /**
   * Merge the task branch into base branch
   */
  merge?: boolean;
  
  /**
   * Create a summary commit before completing
   */
  createSummary?: boolean;
  
  /**
   * Custom summary message
   */
  summaryMessage?: string;
  
  /**
   * Options for merge operation
   */
  mergeOptions?: {
    /**
     * Strategy for handling conflicts
     */
    strategy?: 'ours' | 'theirs' | 'manual';
    
    /**
     * Custom merge commit message
     */
    message?: string;
  };
}

/**
 * Result of task operations
 */
export interface TaskResult {
  success: boolean;
  taskId: string;
  branch?: string;
  commits?: string[];
  merged?: boolean;
  error?: string;
}

/**
 * Result of commit operations
 */
export interface CommitResult {
  success: boolean;
  hash?: string;
  message?: string;
  error?: string;
}

/**
 * Result of history operations
 */
export interface HistoryResult {
  success: boolean;
  commits?: Array<{
    hash: string;
    message: string;
    date: string;
    author: string;
  }>;
  error?: string;
}

/**
 * Internal task state tracking
 */
export interface TaskState {
  config: TaskConfig;
  branch: string;
  startTime: Date;
  commits: string[];
}