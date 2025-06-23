# Git Versioning Implementation Plan

## Quick Summary

Add optional git versioning to PackFS that:
1. Auto-initializes git repos when enabled
2. Commits all file changes automatically  
3. Supports task-based branching for grouped changes
4. Integrates seamlessly with existing semantic API

## Minimal Implementation (Phase 1)

### 1. Add Versioning Config
```typescript
interface FileSystemOptions {
  // ... existing options
  versioning?: {
    enabled: boolean;
    autoCommit?: boolean;  // default: true
  };
}
```

### 2. Extend DiskSemanticBackend
```typescript
class VersionedDiskSemanticBackend extends DiskSemanticBackend {
  private git?: GitWrapper;
  
  async initialize() {
    await super.initialize();
    if (this.options.versioning?.enabled) {
      this.git = new GitWrapper(this.basePath);
      await this.git.ensureRepo();
    }
  }
  
  async updateContent(intent: ContentUpdateIntent): Promise<ContentUpdateResult> {
    const result = await super.updateContent(intent);
    
    if (this.git && result.success) {
      await this.git.addAndCommit(
        [intent.path],
        `Update ${intent.path}`
      );
    }
    
    return result;
  }
}
```

### 3. Simple Git Wrapper
```typescript
class GitWrapper {
  constructor(private workDir: string) {}
  
  async ensureRepo(): Promise<void> {
    const hasGit = await this.isGitRepo();
    if (!hasGit) {
      await this.exec(['init']);
    }
  }
  
  async addAndCommit(files: string[], message: string): Promise<void> {
    await this.exec(['add', ...files]);
    await this.exec(['commit', '-m', message]);
  }
  
  private async exec(args: string[]): Promise<string> {
    // Use child_process to run git commands
    return execAsync(`git ${args.join(' ')}`, { cwd: this.workDir });
  }
}
```

## Task-Based Branching (Phase 2)

### 1. Task API
```typescript
// Start a task (creates branch)
const task = await fs.startTask({
  id: 'add-feature-x',
  description: 'Add feature X'
});

// Work happens on task branch automatically
await fs.updateContent({ path: 'feature.js', content: '...' });

// Complete task (switches back to main)
await fs.completeTask('add-feature-x', { 
  merge: true  // Optional: auto-merge
});
```

### 2. Natural Language Support
```typescript
// Via semantic API
await fs.performOperation({
  intent: 'start a new task for adding user authentication'
});

await fs.performOperation({
  intent: 'finish the current task and merge the changes'
});
```

## Integration Example

```typescript
// Create versioned filesystem
const fs = createFileSystem('/my/project', {
  versioning: {
    enabled: true,
    autoCommit: true
  }
});

// Start a task
await fs.startTask({
  id: 'update-configs',
  description: 'Update configuration files'
});

// All operations are tracked
await fs.updateContent({
  path: 'config/app.json',
  content: JSON.stringify(newConfig),
  purpose: 'update'
});
// Commits: "Update config/app.json"

await fs.organizeFiles({
  sourcePath: 'config/old',
  targetPath: 'config/archive',
  operation: 'move'
});
// Commits: "Move config/old to config/archive"

// Complete the task
await fs.completeTask('update-configs');
// Back on main branch, changes on task branch
```

## Implementation Steps

### Week 1: Core Git Integration
- [ ] Create GitWrapper class with basic operations
- [ ] Extend DiskSemanticBackend with versioning
- [ ] Add auto-commit to all write operations
- [ ] Test git initialization and basic commits

### Week 2: Task Management  
- [ ] Implement TaskManager for branch operations
- [ ] Add startTask/completeTask to semantic API
- [ ] Handle task state and active task tracking
- [ ] Test task lifecycle and branching

### Week 3: Enhanced Features
- [ ] Commit message templates and customization
- [ ] Natural language task management
- [ ] History and diff operations
- [ ] Merge conflict handling

### Week 4: Framework Integration
- [ ] Update Mastra tools with task operations
- [ ] Add versioning params to tool descriptions  
- [ ] Create examples for agent workflows
- [ ] Documentation and testing

## Technical Decisions

### Why child_process over git libraries?
- Minimal dependencies
- Direct git CLI compatibility
- Easier debugging
- No version conflicts

### Branch Naming Convention
- Tasks: `task-{id}` or custom
- Features: `feature/{description}`
- Fixes: `fix/{description}`

### Commit Message Format
- Default: `{operation} {path}`
- With task: `[{taskId}] {operation} {path}`
- Customizable via templates

## Open Questions

1. **Conflict Resolution**: How to handle merge conflicts?
   - Option A: Fail and require manual resolution
   - Option B: Auto-resolve with strategies (theirs/ours)
   - Option C: Callback for custom resolution

2. **Multi-Agent Coordination**: Multiple agents on same repo?
   - Option A: One task at a time
   - Option B: Parallel tasks on different branches
   - Option C: Queue system for task management

3. **Performance**: Large repos or many files?
   - Option A: Batch commits with debouncing
   - Option B: Background git operations
   - Option C: Selective versioning by path

## MVP Scope

For initial release, focus on:
1. ✅ Auto-initialization of git repos
2. ✅ Auto-commit on all write operations  
3. ✅ Basic task/branch management
4. ✅ Simple commit messages
5. ❌ Defer: Conflict resolution (manual only)
6. ❌ Defer: History viewing (use git directly)
7. ❌ Defer: Advanced merge strategies

This provides version control benefits immediately while keeping implementation simple.