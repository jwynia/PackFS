import { DiskSemanticBackend } from '../semantic/disk-semantic-backend.js';
import { GitWrapper } from './git-wrapper.js';
import { Logger } from '../core/logger.js';
import type {
  ContentUpdateIntent,
  ContentUpdateResult,
  OrganizationIntent,
  OrganizationResult,
  RemovalIntent,
  RemovalResult,
  SemanticConfig
} from '../semantic/types.js';
import type {
  VersioningConfig,
  TaskConfig,
  TaskResult,
  CompleteTaskOptions,
  TaskState,
  CommitResult,
  HistoryResult
} from './types.js';

export interface VersionedSemanticConfig extends Partial<SemanticConfig> {
  versioning?: VersioningConfig;
}

/**
 * Disk-based semantic backend with git versioning support
 */
export class VersionedDiskSemanticBackend extends DiskSemanticBackend {
  private git?: GitWrapper;
  private versioningConfig?: VersioningConfig;
  private activeTasks: Map<string, TaskState> = new Map();
  private currentTaskId?: string;
  private versionedLogger = Logger.getInstance().createChildLogger('VersionedDiskSemanticBackend');
  private versionedBasePath: string;

  constructor(basePath: string, config?: VersionedSemanticConfig) {
    // Pass only the semantic config parts, excluding versioning
    const semanticConfig = config ? {
      defaultMaxResults: config.defaultMaxResults,
      semanticThreshold: config.semanticThreshold,
      enableNaturalLanguage: config.enableNaturalLanguage,
      chunkingConfig: config.chunkingConfig
    } : undefined;
    
    super(basePath, semanticConfig as any);
    this.versionedBasePath = basePath;
    this.versioningConfig = config?.versioning;
  }

  override async initialize(): Promise<void> {
    await super.initialize();
    
    if (this.versioningConfig?.enabled) {
      this.versionedLogger.info('Initializing git versioning');
      
      this.git = new GitWrapper(this.versionedBasePath, {
        userInfo: this.versioningConfig.userInfo,
        defaultBranch: this.versioningConfig.defaultBranch
      });
      
      try {
        await this.git.ensureRepo();
        this.versionedLogger.info('Git repository initialized');
      } catch (error) {
        this.versionedLogger.error('Failed to initialize git repository', error);
        throw error;
      }
    }
  }

  /**
   * Generate commit message based on operation and template
   */
  private generateCommitMessage(operation: string, details: any): string {
    if (!this.versioningConfig?.commitMessageTemplate) {
      // Default messages
      const defaultMessages: Record<string, string> = {
        create: `Create ${details.path}`,
        update: `Update ${details.path}`,
        overwrite: `Overwrite ${details.path}`,
        append: `Append to ${details.path}`,
        delete: `Delete ${details.path}`,
        delete_file: `Delete ${details.path}`,
        delete_directory: `Delete directory ${details.path}`,
        move: `Move ${details.sourcePath} to ${details.targetPath}`,
        copy: `Copy ${details.sourcePath} to ${details.targetPath}`,
        organize: `Organize files in ${details.path}`,
        create_directory: `Create directory ${details.path || details.targetPath}`
      };
      
      const message = defaultMessages[operation] || `${operation} operation`;
      
      // Add task prefix if in a task
      if (this.currentTaskId) {
        return `[${this.currentTaskId}] ${message}`;
      }
      
      return message;
    }
    
    // Use template
    let message = this.versioningConfig.commitMessageTemplate;
    const context = {
      operation,
      path: details.path || details.sourcePath || '',
      taskId: this.currentTaskId || '',
      timestamp: new Date().toISOString(),
      ...details
    };
    
    // Replace template variables
    Object.entries(context).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });
    
    return message;
  }

  /**
   * Commit changes if versioning is enabled
   */
  private async commitIfEnabled(files: string[], operation: string, details: any): Promise<void> {
    if (!this.git || !this.versioningConfig?.enabled || this.versioningConfig.autoCommit === false) {
      return;
    }
    
    try {
      const message = this.generateCommitMessage(operation, details);
      const hash = await this.git.addAndCommit(files, message);
      
      if (hash) {
        this.versionedLogger.debug(`Committed changes: ${hash.substring(0, 7)} - ${message}`);
        
        // Track commit in active task
        if (this.currentTaskId) {
          const task = this.activeTasks.get(this.currentTaskId);
          if (task) {
            task.commits.push(hash);
          }
        }
      }
    } catch (error) {
      this.versionedLogger.error('Failed to commit changes', error);
      // Don't fail the operation if commit fails
    }
  }

  // Override write operations to add versioning

  override async updateContent(intent: ContentUpdateIntent): Promise<ContentUpdateResult> {
    const result = await super.updateContent(intent);
    
    if (result.success && this.git) {
      await this.commitIfEnabled(
        [intent.target.path!],
        intent.purpose || 'update',
        { path: intent.target.path }
      );
    }
    
    return result;
  }

  override async organizeFiles(intent: OrganizationIntent): Promise<OrganizationResult> {
    const result = await super.organizeFiles(intent);
    
    if (result.success && this.git) {
      const files: string[] = [];
      
      // Collect affected files
      if (intent.source?.path) files.push(intent.source.path);
      if (intent.destination?.path) files.push(intent.destination.path);
      if (result.filesAffected) {
        // Add any additional affected files from the result
        // This would need to be tracked in the base class
      }
      
      await this.commitIfEnabled(
        files,
        intent.purpose || 'organize',
        {
          sourcePath: intent.source?.path,
          targetPath: intent.destination?.path,
          operation: intent.purpose
        }
      );
    }
    
    return result;
  }

  override async removeFiles(intent: RemovalIntent): Promise<RemovalResult> {
    const result = await super.removeFiles(intent);
    
    if (result.success && this.git) {
      const files = intent.target.path ? [intent.target.path] : [];
      
      await this.commitIfEnabled(
        files,
        intent.purpose || 'delete',
        { path: intent.target.path }
      );
    }
    
    return result;
  }

  // Task management methods

  async startTask(config: TaskConfig): Promise<TaskResult> {
    if (!this.git) {
      return {
        success: false,
        taskId: config.id,
        error: 'Git versioning is not enabled'
      };
    }
    
    // Check for existing active task
    if (this.currentTaskId) {
      return {
        success: false,
        taskId: config.id,
        error: `Task ${this.currentTaskId} is already active. Complete it before starting a new task.`
      };
    }
    
    try {
      const branchName = config.branch || `task-${config.id}`;
      
      // Create and checkout new branch
      await this.git.createBranch(branchName, config.baseBranch);
      
      // Track task state
      const taskState: TaskState = {
        config,
        branch: branchName,
        startTime: new Date(),
        commits: []
      };
      
      this.activeTasks.set(config.id, taskState);
      this.currentTaskId = config.id;
      
      this.versionedLogger.info(`Started task ${config.id} on branch ${branchName}`);
      
      // Create initial commit for task
      if (config.description) {
        await this.commitIfEnabled(
          [],
          'task-start',
          { taskId: config.id, description: config.description }
        );
      }
      
      return {
        success: true,
        taskId: config.id,
        branch: branchName
      };
    } catch (error: any) {
      return {
        success: false,
        taskId: config.id,
        error: error.message
      };
    }
  }

  async completeTask(taskId: string, options?: CompleteTaskOptions): Promise<TaskResult> {
    if (!this.git) {
      return {
        success: false,
        taskId,
        error: 'Git versioning is not enabled'
      };
    }
    
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return {
        success: false,
        taskId,
        error: `Task ${taskId} not found`
      };
    }
    
    try {
      // Create summary commit if requested
      if (options?.createSummary) {
        await this.commitIfEnabled([], 'task-complete', {
          taskId,
          description: task.config.description
        });
      }
      
      // Switch back to base branch
      const baseBranch = task.config.baseBranch || 'main';
      await this.git.checkout(baseBranch);
      
      // Merge if requested
      let merged = false;
      if (task.config.autoMerge || options?.merge) {
        try {
          const mergeMessage = options?.mergeOptions?.message ||
            `Merge task ${taskId}: ${task.config.description || 'No description'}`;
          
          await this.git.merge(task.branch, mergeMessage);
          merged = true;
          
          this.versionedLogger.info(`Merged task ${taskId} into ${baseBranch}`);
        } catch (error: any) {
          this.versionedLogger.error(`Failed to merge task ${taskId}`, error);
          if (options?.mergeOptions?.strategy !== 'manual') {
            throw error;
          }
        }
      }
      
      // Clean up task state
      this.activeTasks.delete(taskId);
      if (this.currentTaskId === taskId) {
        this.currentTaskId = undefined;
      }
      
      return {
        success: true,
        taskId,
        branch: task.branch,
        commits: task.commits,
        merged
      };
    } catch (error: any) {
      return {
        success: false,
        taskId,
        error: error.message
      };
    }
  }

  async abortTask(taskId: string): Promise<TaskResult> {
    if (!this.git) {
      return {
        success: false,
        taskId,
        error: 'Git versioning is not enabled'
      };
    }
    
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return {
        success: false,
        taskId,
        error: `Task ${taskId} not found`
      };
    }
    
    try {
      // Switch back to base branch
      const baseBranch = task.config.baseBranch || 'main';
      await this.git.checkout(baseBranch);
      
      // Clean up task state
      this.activeTasks.delete(taskId);
      if (this.currentTaskId === taskId) {
        this.currentTaskId = undefined;
      }
      
      this.versionedLogger.info(`Aborted task ${taskId}`);
      
      return {
        success: true,
        taskId,
        branch: task.branch,
        commits: task.commits
      };
    } catch (error: any) {
      return {
        success: false,
        taskId,
        error: error.message
      };
    }
  }

  getCurrentTask(): TaskConfig | null {
    if (!this.currentTaskId) return null;
    
    const task = this.activeTasks.get(this.currentTaskId);
    return task ? task.config : null;
  }

  // Version control operations

  async commit(message: string, files?: string[]): Promise<CommitResult> {
    if (!this.git) {
      return {
        success: false,
        error: 'Git versioning is not enabled'
      };
    }
    
    try {
      const filesToCommit = files || ['.'];
      const hash = await this.git.addAndCommit(filesToCommit, message);
      
      if (hash && this.currentTaskId) {
        const task = this.activeTasks.get(this.currentTaskId);
        if (task) {
          task.commits.push(hash);
        }
      }
      
      return {
        success: true,
        hash,
        message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getHistory(limit?: number): Promise<HistoryResult> {
    if (!this.git) {
      return {
        success: false,
        error: 'Git versioning is not enabled'
      };
    }
    
    try {
      const commits = await this.git.getHistory(limit);
      return {
        success: true,
        commits
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}