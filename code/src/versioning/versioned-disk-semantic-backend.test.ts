import { VersionedDiskSemanticBackend, VersionedSemanticConfig } from './versioned-disk-semantic-backend.js';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('VersionedDiskSemanticBackend', () => {
  let testDir: string;
  let backend: VersionedDiskSemanticBackend;
  
  beforeEach(() => {
    testDir = path.join('/tmp', `versioned-backend-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    if (backend) {
      await backend.cleanup();
    }
    if (fs.existsSync(testDir)) {
      await execAsync(`rm -rf ${testDir}`);
    }
  });
  
  describe('Initialization', () => {
    it('should initialize without versioning', async () => {
      backend = new VersionedDiskSemanticBackend(testDir);
      await backend.initialize();
      
      // Should not have .git directory
      expect(fs.existsSync(path.join(testDir, '.git'))).toBe(false);
    });
    
    it('should initialize with versioning enabled', async () => {
      const config: Partial<VersionedSemanticConfig> = {
        versioning: {
          enabled: true,
          userInfo: {
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      };
      
      backend = new VersionedDiskSemanticBackend(testDir, config);
      await backend.initialize();
      
      // Should have .git directory
      expect(fs.existsSync(path.join(testDir, '.git'))).toBe(true);
    });
    
    it('should handle existing git repository', async () => {
      // Initialize git repo manually
      await execAsync('git init', { cwd: testDir });
      
      const config: Partial<VersionedSemanticConfig> = {
        versioning: { enabled: true }
      };
      
      backend = new VersionedDiskSemanticBackend(testDir, config);
      await backend.initialize();
      
      // Should not throw and should work with existing repo
      expect(fs.existsSync(path.join(testDir, '.git'))).toBe(true);
    });
  });
  
  describe('Auto-commit Operations', () => {
    beforeEach(async () => {
      const config: Partial<VersionedSemanticConfig> = {
        versioning: {
          enabled: true,
          autoCommit: true,
          userInfo: {
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      };
      
      backend = new VersionedDiskSemanticBackend(testDir, config);
      await backend.initialize();
    });
    
    it('should auto-commit on file creation', async () => {
      const result = await backend.updateContent({
        target: { path: 'test.txt' },
        content: 'test content',
        purpose: 'create'
      });
      
      expect(result.success).toBe(true);
      
      // Check git log
      const { stdout } = await execAsync('git log --oneline', { cwd: testDir });
      expect(stdout).toContain('Create test.txt');
    });
    
    it('should auto-commit on file update', async () => {
      // Create file first
      await backend.updateContent({
        target: { path: 'test.txt' },
        content: 'initial content',
        purpose: 'create'
      });
      
      // Update file
      await backend.updateContent({
        target: { path: 'test.txt' },
        content: 'updated content',
        purpose: 'overwrite'
      });
      
      // Check git log
      const { stdout } = await execAsync('git log --oneline', { cwd: testDir });
      expect(stdout).toContain('Overwrite test.txt');
    });
    
    it('should respect autoCommit false setting', async () => {
      // Create backend with autoCommit disabled
      const config: Partial<VersionedSemanticConfig> = {
        versioning: {
          enabled: true,
          autoCommit: false,
          userInfo: {
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      };
      
      const noAutoCommitBackend = new VersionedDiskSemanticBackend(testDir, config);
      await noAutoCommitBackend.initialize();
      
      await noAutoCommitBackend.updateContent({
        target: { path: 'test.txt' },
        content: 'test content',
        purpose: 'create'
      });
      
      // Check git status - should have uncommitted changes
      const { stdout } = await execAsync('git status --porcelain', { cwd: testDir });
      expect(stdout).toContain('?? test.txt');
      
      await noAutoCommitBackend.cleanup();
    });
    
    it('should auto-commit file moves', async () => {
      // Create a file
      await backend.updateContent({
        target: { path: 'source.txt' },
        content: 'content',
        purpose: 'create'
      });
      
      // Move the file
      await backend.organizeFiles({
        purpose: 'move',
        source: { path: 'source.txt' },
        destination: { path: 'target.txt' }
      });
      
      // Check git log
      const { stdout } = await execAsync('git log --oneline', { cwd: testDir });
      expect(stdout).toContain('Move source.txt to target.txt');
    });
    
    it('should auto-commit file deletions', async () => {
      // Create a file
      await backend.updateContent({
        target: { path: 'delete-me.txt' },
        content: 'content',
        purpose: 'create'
      });
      
      // Delete the file
      await backend.removeFiles({
        target: { path: 'delete-me.txt' },
        purpose: 'delete_file'
      });
      
      // Check git log
      const { stdout } = await execAsync('git log --oneline', { cwd: testDir });
      expect(stdout).toContain('Delete delete-me.txt');
    });
  });
  
  describe('Commit Message Templates', () => {
    it('should use custom commit message template', async () => {
      const config: Partial<VersionedSemanticConfig> = {
        versioning: {
          enabled: true,
          commitMessageTemplate: '[{{operation}}] {{path}} at {{timestamp}}',
          userInfo: {
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      };
      
      backend = new VersionedDiskSemanticBackend(testDir, config);
      await backend.initialize();
      
      await backend.updateContent({
        target: { path: 'test.txt' },
        content: 'content',
        purpose: 'create'
      });
      
      // Check git log
      const { stdout } = await execAsync('git log --oneline', { cwd: testDir });
      expect(stdout).toMatch(/\[create\] test\.txt at \d{4}-\d{2}-\d{2}/);
    });
    
    it('should include task ID in commit messages', async () => {
      const config: Partial<VersionedSemanticConfig> = {
        versioning: {
          enabled: true,
          userInfo: {
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      };
      
      backend = new VersionedDiskSemanticBackend(testDir, config);
      await backend.initialize();
      
      // Start a task
      await backend.startTask({
        id: 'task-123',
        description: 'Test task'
      });
      
      // Create file within task
      await backend.updateContent({
        target: { path: 'task-file.txt' },
        content: 'content',
        purpose: 'create'
      });
      
      // Check git log
      const { stdout } = await execAsync('git log --oneline', { cwd: testDir });
      expect(stdout).toContain('[task-123] Create task-file.txt');
    });
  });
  
  describe('Task Management', () => {
    beforeEach(async () => {
      const config: Partial<VersionedSemanticConfig> = {
        versioning: {
          enabled: true,
          userInfo: {
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      };
      
      backend = new VersionedDiskSemanticBackend(testDir, config);
      await backend.initialize();
      
      // Create initial file on main branch
      await backend.updateContent({
        target: { path: 'README.md' },
        content: '# Test Project',
        purpose: 'create'
      });
    });
    
    it('should start a new task and create branch', async () => {
      const result = await backend.startTask({
        id: 'feature-x',
        description: 'Add feature X'
      });
      
      expect(result.success).toBe(true);
      expect(result.branch).toBe('task-feature-x');
      
      // Check current branch
      const { stdout } = await execAsync('git branch --show-current', { cwd: testDir });
      expect(stdout.trim()).toBe('task-feature-x');
    });
    
    it('should track commits to active task', async () => {
      await backend.startTask({
        id: 'test-task',
        description: 'Test task'
      });
      
      // Make some changes
      await backend.updateContent({
        target: { path: 'file1.txt' },
        content: 'content 1',
        purpose: 'create'
      });
      
      await backend.updateContent({
        target: { path: 'file2.txt' },
        content: 'content 2',
        purpose: 'create'
      });
      
      // Complete task
      const result = await backend.completeTask('test-task');
      
      expect(result.success).toBe(true);
      expect(result.commits).toHaveLength(2);
    });
    
    it('should prevent multiple active tasks', async () => {
      await backend.startTask({
        id: 'task-1',
        description: 'First task'
      });
      
      const result = await backend.startTask({
        id: 'task-2',
        description: 'Second task'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('task-1 is already active');
    });
    
    it('should complete task and switch to base branch', async () => {
      await backend.startTask({
        id: 'feature-task',
        description: 'Feature task'
      });
      
      // Make changes
      await backend.updateContent({
        target: { path: 'feature.txt' },
        content: 'feature',
        purpose: 'create'
      });
      
      // Complete task
      await backend.completeTask('feature-task');
      
      // Should be back on main branch
      const { stdout } = await execAsync('git branch --show-current', { cwd: testDir });
      expect(stdout.trim()).toBe('main');
      
      // Feature file should not be visible on main (not merged)
      expect(fs.existsSync(path.join(testDir, 'feature.txt'))).toBe(false);
    });
    
    it('should merge task when requested', async () => {
      await backend.startTask({
        id: 'merge-task',
        description: 'Task to merge'
      });
      
      // Make changes
      await backend.updateContent({
        target: { path: 'merged-feature.txt' },
        content: 'merged feature',
        purpose: 'create'
      });
      
      // Complete with merge
      const result = await backend.completeTask('merge-task', {
        merge: true
      });
      
      expect(result.success).toBe(true);
      expect(result.merged).toBe(true);
      
      // Feature file should be visible on main
      expect(fs.existsSync(path.join(testDir, 'merged-feature.txt'))).toBe(true);
    });
    
    it('should abort task and discard changes', async () => {
      await backend.startTask({
        id: 'abort-task',
        description: 'Task to abort'
      });
      
      // Make changes
      await backend.updateContent({
        target: { path: 'abort-file.txt' },
        content: 'will be discarded',
        purpose: 'create'
      });
      
      // Abort task
      const result = await backend.abortTask('abort-task');
      
      expect(result.success).toBe(true);
      
      // Should be back on main
      const { stdout } = await execAsync('git branch --show-current', { cwd: testDir });
      expect(stdout.trim()).toBe('main');
      
      // File should not exist on main
      expect(fs.existsSync(path.join(testDir, 'abort-file.txt'))).toBe(false);
    });
    
    it('should get current task info', async () => {
      const taskConfig = {
        id: 'current-task',
        description: 'Currently active task'
      };
      
      await backend.startTask(taskConfig);
      
      const current = backend.getCurrentTask();
      expect(current).toEqual(taskConfig);
      
      await backend.completeTask('current-task');
      
      const afterComplete = backend.getCurrentTask();
      expect(afterComplete).toBeNull();
    });
  });
  
  describe('Version Control Operations', () => {
    beforeEach(async () => {
      const config: Partial<VersionedSemanticConfig> = {
        versioning: {
          enabled: true,
          autoCommit: false, // Manual commits for these tests
          userInfo: {
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      };
      
      backend = new VersionedDiskSemanticBackend(testDir, config);
      await backend.initialize();
    });
    
    it('should manually commit changes', async () => {
      // Create uncommitted changes
      await backend.updateContent({
        target: { path: 'manual.txt' },
        content: 'manual content',
        purpose: 'create'
      });
      
      // Manually commit
      const result = await backend.commit('Manual commit', ['manual.txt']);
      
      expect(result.success).toBe(true);
      expect(result.hash).toBeTruthy();
      
      // Verify commit
      const { stdout } = await execAsync('git log --oneline', { cwd: testDir });
      expect(stdout).toContain('Manual commit');
    });
    
    it('should get commit history', async () => {
      // Create some commits
      for (let i = 1; i <= 3; i++) {
        await backend.updateContent({
          target: { path: `file${i}.txt` },
          content: `content ${i}`,
          purpose: 'create'
        });
        await backend.commit(`Commit ${i}`, [`file${i}.txt`]);
      }
      
      const result = await backend.getHistory(2);
      
      expect(result.success).toBe(true);
      expect(result.commits).toHaveLength(2);
      expect(result.commits![0]?.message).toBe('Commit 3');
      expect(result.commits![1]?.message).toBe('Commit 2');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle operations when versioning is disabled', async () => {
      const config: Partial<VersionedSemanticConfig> = {
        versioning: { enabled: false }
      };
      
      backend = new VersionedDiskSemanticBackend(testDir, config);
      await backend.initialize();
      
      const taskResult = await backend.startTask({
        id: 'test',
        description: 'Test'
      });
      
      expect(taskResult.success).toBe(false);
      expect(taskResult.error).toContain('not enabled');
      
      const commitResult = await backend.commit('Test commit');
      
      expect(commitResult.success).toBe(false);
      expect(commitResult.error).toContain('not enabled');
    });
    
    it('should handle non-existent task operations', async () => {
      const config: Partial<VersionedSemanticConfig> = {
        versioning: { enabled: true }
      };
      
      backend = new VersionedDiskSemanticBackend(testDir, config);
      await backend.initialize();
      
      const completeResult = await backend.completeTask('non-existent');
      expect(completeResult.success).toBe(false);
      expect(completeResult.error).toContain('not found');
      
      const abortResult = await backend.abortTask('non-existent');
      expect(abortResult.success).toBe(false);
      expect(abortResult.error).toContain('not found');
    });
  });
});