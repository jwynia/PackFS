# Git Versioning Design Proposal for PackFS

## Overview

This proposal outlines the design for adding optional git-based versioning to PackFS, enabling automatic version control for all file operations with task-based branching support.

## Core Concepts

### 1. Versioning Configuration

Add versioning options to the filesystem initialization:

```typescript
interface VersioningConfig {
  enabled: boolean;
  autoCommit?: boolean;              // Auto-commit after each operation (default: true)
  commitMessageTemplate?: string;     // Template for commit messages
  defaultBranch?: string;            // Default branch name (default: 'main')
  userInfo?: {
    name: string;
    email: string;
  };
  gitPath?: string;                  // Path to git executable if not in PATH
}

interface FileSystemOptions {
  // ... existing options
  versioning?: VersioningConfig;
}
```

### 2. Task Scoping

Introduce task-based branching for grouping related changes:

```typescript
interface TaskConfig {
  id: string;                        // Unique task identifier
  description?: string;              // Human-readable task description
  branch?: string;                   // Custom branch name (default: task-{id})
  baseBranch?: string;              // Branch to create from (default: main)
  autoMerge?: boolean;              // Auto-merge on completion (default: false)
}

// Extended semantic backend interface
interface VersionedSemanticBackend extends SemanticFileSystemInterface {
  // Task management
  startTask(config: TaskConfig): Promise<TaskResult>;
  completeTask(taskId: string, options?: CompleteTaskOptions): Promise<TaskResult>;
  abortTask(taskId: string): Promise<TaskResult>;
  getCurrentTask(): TaskConfig | null;
  
  // Version control operations
  commit(message: string, files?: string[]): Promise<CommitResult>;
  getHistory(path?: string, limit?: number): Promise<HistoryResult>;
  revert(commitId: string): Promise<RevertResult>;
  diff(path?: string): Promise<DiffResult>;
}
```

### 3. Integration Points

#### Initialization
```typescript
// Check for existing git repo or initialize new one
async initialize(): Promise<void> {
  if (this.config.versioning?.enabled) {
    const gitExists = await this.checkGitRepo();
    if (!gitExists) {
      await this.initGitRepo();
    }
    await this.configureGit();
  }
  // ... existing initialization
}
```

#### File Operations
All write operations would trigger commits when versioning is enabled:

```typescript
async updateContent(intent: ContentUpdateIntent): Promise<ContentUpdateResult> {
  const result = await super.updateContent(intent);
  
  if (this.config.versioning?.enabled && result.success) {
    const commitMessage = this.generateCommitMessage('update', intent);
    await this.commit(commitMessage, [intent.path]);
  }
  
  return result;
}
```

### 4. Implementation Architecture

```
PackFS Versioning Architecture
├── Core Versioning Module
│   ├── GitVersioningBackend    (Git operations wrapper)
│   ├── TaskManager             (Branch and task management)
│   └── CommitBuilder           (Commit message generation)
├── Backend Integration
│   ├── VersionedDiskBackend    (Extends DiskBackend)
│   └── VersionedSemanticBackend (Extends DiskSemanticBackend)
└── Framework Integration
    └── Enhanced tool descriptions with task parameters
```

## Detailed Design

### GitVersioningBackend

```typescript
export class GitVersioningBackend {
  private gitPath: string;
  private workingDirectory: string;
  private config: VersioningConfig;
  
  async exec(command: string[]): Promise<string> {
    // Execute git command
  }
  
  async init(): Promise<void> {
    await this.exec(['init']);
    if (this.config.defaultBranch && this.config.defaultBranch !== 'master') {
      await this.exec(['checkout', '-b', this.config.defaultBranch]);
    }
  }
  
  async add(files: string[]): Promise<void> {
    await this.exec(['add', ...files]);
  }
  
  async commit(message: string): Promise<string> {
    const result = await this.exec(['commit', '-m', message]);
    // Parse and return commit hash
    return this.parseCommitHash(result);
  }
  
  async createBranch(name: string, baseBranch?: string): Promise<void> {
    if (baseBranch) {
      await this.exec(['checkout', baseBranch]);
    }
    await this.exec(['checkout', '-b', name]);
  }
  
  async merge(branch: string, options?: MergeOptions): Promise<MergeResult> {
    // Handle merge with conflict resolution
  }
}
```

### TaskManager

```typescript
export class TaskManager {
  private activeTasks: Map<string, TaskState>;
  private git: GitVersioningBackend;
  
  async startTask(config: TaskConfig): Promise<TaskResult> {
    // Validate no active task or handle multiple tasks
    if (this.hasActiveTask() && !this.config.allowMultipleTasks) {
      throw new Error('Complete current task before starting a new one');
    }
    
    const branchName = config.branch || `task-${config.id}`;
    await this.git.createBranch(branchName, config.baseBranch);
    
    this.activeTasks.set(config.id, {
      config,
      branch: branchName,
      startTime: new Date(),
      commits: []
    });
    
    return {
      success: true,
      taskId: config.id,
      branch: branchName
    };
  }
  
  async completeTask(taskId: string, options?: CompleteTaskOptions): Promise<TaskResult> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Optional: Create summary commit
    if (options?.createSummary) {
      await this.createTaskSummary(task);
    }
    
    // Switch back to base branch
    await this.git.checkout(task.config.baseBranch || 'main');
    
    // Handle merge if requested
    if (task.config.autoMerge || options?.merge) {
      await this.git.merge(task.branch, options?.mergeOptions);
    }
    
    this.activeTasks.delete(taskId);
    
    return {
      success: true,
      taskId,
      commits: task.commits,
      branch: task.branch,
      merged: task.config.autoMerge || options?.merge
    };
  }
}
```

### Commit Message Generation

```typescript
export class CommitBuilder {
  private template: string;
  private taskManager: TaskManager;
  
  generateCommitMessage(operation: string, intent: any): string {
    const task = this.taskManager.getCurrentTask();
    const context = {
      operation,
      path: intent.path || intent.target?.path,
      taskId: task?.id,
      taskDescription: task?.description,
      timestamp: new Date().toISOString()
    };
    
    // Default templates by operation
    const defaultTemplates = {
      create: 'Create {{path}}',
      update: 'Update {{path}}',
      delete: 'Delete {{path}}',
      move: 'Move {{sourcePath}} to {{destPath}}',
      organize: 'Organize files in {{path}}'
    };
    
    const template = this.template || defaultTemplates[operation] || 'Update files';
    return this.interpolate(template, context);
  }
}
```

## Usage Examples

### Basic Versioning

```typescript
// Initialize with versioning
const fs = createFileSystem('/my/project', {
  versioning: {
    enabled: true,
    userInfo: {
      name: 'Agent Smith',
      email: 'agent@packfs.ai'
    }
  }
});

// All operations are automatically versioned
await fs.updateContent({
  path: 'config.json',
  content: JSON.stringify(config),
  purpose: 'update'
});
// Automatically creates commit: "Update config.json"
```

### Task-Based Development

```typescript
// Start a new feature task
const task = await fs.startTask({
  id: 'add-auth-system',
  description: 'Implement user authentication',
  branch: 'feature/auth'
});

// All subsequent operations are on the task branch
await fs.updateContent({
  path: 'src/auth/login.ts',
  content: loginCode,
  purpose: 'create'
});

await fs.updateContent({
  path: 'src/auth/register.ts',
  content: registerCode,
  purpose: 'create'
});

// Complete the task
await fs.completeTask('add-auth-system', {
  merge: true,
  createSummary: true,
  summaryMessage: 'Implement user authentication system with login and registration'
});
```

### Agent Integration

```typescript
// Mastra tool with task support
const tool = createMastraTools({
  workingDirectory: '/project',
  versioning: {
    enabled: true,
    commitMessageTemplate: '[{{taskId}}] {{operation}} {{path}} via AI agent'
  }
});

// Agent can work within tasks
await tool.execute({
  operation: 'task',
  action: 'start',
  config: {
    id: 'refactor-components',
    description: 'Refactor React components for better performance'
  }
});

// ... agent makes changes ...

await tool.execute({
  operation: 'task',
  action: 'complete',
  taskId: 'refactor-components',
  options: { merge: false } // Keep on branch for review
});
```

## Implementation Phases

### Phase 1: Core Versioning (MVP)
- Git initialization and detection
- Auto-commit on write operations
- Basic commit message generation
- Simple history viewing

### Phase 2: Task Management
- Branch-based task scoping
- Task lifecycle (start/complete/abort)
- Multiple active tasks support
- Task metadata tracking

### Phase 3: Advanced Features
- Conflict resolution strategies
- Diff visualization
- Revert capabilities
- Commit message customization
- Integration with GitHub/GitLab APIs

### Phase 4: Agent Enhancements
- Task recommendation based on changes
- Automatic PR creation
- Change summaries with AI
- Semantic commit messages

## Considerations

### Performance
- Git operations can be slow on large repos
- Consider batching commits for bulk operations
- Implement async queue for git operations

### Security
- Validate branch names to prevent injection
- Sanitize commit messages
- Handle git credentials securely
- Respect .gitignore patterns

### Error Handling
- Git command failures
- Merge conflicts
- Disk space issues
- Concurrent task management

### Configuration
- Global vs per-operation versioning control
- Integration with existing git configs
- Support for git hooks
- Submodule handling

## API Additions Summary

```typescript
// New initialization option
createFileSystem(path, {
  versioning: { enabled: true }
});

// New operations via semantic API
await fs.performOperation({
  intent: 'start new task for authentication feature'
});

await fs.performOperation({
  intent: 'complete current task and merge changes'
});

// Direct API
await fs.startTask({ id: 'task-123' });
await fs.completeTask('task-123');
await fs.getHistory();
```

This design provides a solid foundation for version control integration while maintaining PackFS's simplicity and semantic nature.