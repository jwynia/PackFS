import { IsomorphicGitWrapper } from './isomorphic-git-wrapper.js';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('IsomorphicGitWrapper', () => {
  let testDir: string;
  let gitWrapper: IsomorphicGitWrapper;
  
  beforeEach(() => {
    // Create a unique test directory
    testDir = path.join('/tmp', `isomorphic-git-wrapper-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(testDir, { recursive: true });
    
    gitWrapper = new IsomorphicGitWrapper(testDir, {
      userInfo: {
        name: 'Test User',
        email: 'test@example.com'
      },
      defaultBranch: 'main'
    });
  });
  
  afterEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      await execAsync(`rm -rf ${testDir}`);
    }
  });
  
  describe('Repository Initialization', () => {
    it('should detect when directory is not a git repo', async () => {
      const isRepo = await gitWrapper.isGitRepo();
      expect(isRepo).toBe(false);
    });
    
    it('should initialize a new git repository', async () => {
      await gitWrapper.init();
      
      const isRepo = await gitWrapper.isGitRepo();
      expect(isRepo).toBe(true);
      
      // Check that .git directory exists
      expect(fs.existsSync(path.join(testDir, '.git'))).toBe(true);
    });
    
    it('should use specified default branch', async () => {
      await gitWrapper.init();
      
      const branch = await gitWrapper.getCurrentBranch();
      expect(branch).toBe('main');
    });
    
    it('should handle ensureRepo for new directory', async () => {
      // Add a file to the directory
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'test content');
      
      await gitWrapper.ensureRepo();
      
      const isRepo = await gitWrapper.isGitRepo();
      expect(isRepo).toBe(true);
      
      // Check that initial commit was made
      const history = await gitWrapper.getHistory(1);
      expect(history[0]?.message).toContain('Initial commit');
    });
    
    it('should handle ensureRepo for existing repo', async () => {
      // Initialize repo first
      await gitWrapper.init();
      
      // Add a file to commit
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');
      await gitWrapper.addAndCommit(['README.md'], 'First commit');
      
      // Call ensureRepo again
      await gitWrapper.ensureRepo();
      
      // Should not create another initial commit
      const history = await gitWrapper.getHistory(10);
      expect(history).toHaveLength(1);
      expect(history[0]?.message).toBe('First commit');
    });
  });
  
  describe('File Operations', () => {
    beforeEach(async () => {
      await gitWrapper.init();
    });
    
    it('should add files to staging area', async () => {
      // Create test files
      fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content2');
      
      await gitWrapper.add(['file1.txt', 'file2.txt']);
      
      // Check status
      const status = await gitWrapper.getStatus();
      expect(status.hasChanges).toBe(true);
    });
    
    it('should commit staged changes', async () => {
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'test content');
      
      await gitWrapper.add(['test.txt']);
      const hash = await gitWrapper.commit('Test commit');
      
      expect(hash).toMatch(/^[a-f0-9]+$/);
      
      // Verify commit exists
      const history = await gitWrapper.getHistory(1);
      expect(history[0]?.message).toBe('Test commit');
    });
    
    it('should add and commit in one operation', async () => {
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'test content');
      
      const hash = await gitWrapper.addAndCommit(['test.txt'], 'Add test file');
      
      expect(hash).toMatch(/^[a-f0-9]+$/);
      
      // Verify file is committed
      const history = await gitWrapper.getHistory(1);
      expect(history[0]?.message).toBe('Add test file');
    });
    
    it('should return empty string when no changes to commit', async () => {
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'test content');
      await gitWrapper.addAndCommit(['test.txt'], 'Add test file');
      
      // Try to commit again without changes
      const hash = await gitWrapper.commit('No changes');
      
      expect(hash).toBe('');
    });
  });
  
  describe('Branch Operations', () => {
    beforeEach(async () => {
      await gitWrapper.init();
      // Create initial commit
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');
      await gitWrapper.addAndCommit(['README.md'], 'Initial commit');
    });
    
    it('should get current branch name', async () => {
      const branch = await gitWrapper.getCurrentBranch();
      expect(branch).toBe('main');
    });
    
    it('should create and checkout new branch', async () => {
      await gitWrapper.createBranch('feature-test');
      
      const branch = await gitWrapper.getCurrentBranch();
      expect(branch).toBe('feature-test');
    });
    
    it('should create branch from specific base', async () => {
      // Create another branch
      await gitWrapper.createBranch('develop');
      fs.writeFileSync(path.join(testDir, 'develop.txt'), 'develop');
      await gitWrapper.addAndCommit(['develop.txt'], 'Develop commit');
      
      // Create feature branch from main
      await gitWrapper.createBranch('feature-from-main', 'main');
      
      // Should be on feature branch
      const branch = await gitWrapper.getCurrentBranch();
      expect(branch).toBe('feature-from-main');
      
      // Should not have develop.txt
      expect(fs.existsSync(path.join(testDir, 'develop.txt'))).toBe(false);
    });
    
    it('should checkout existing branch', async () => {
      await gitWrapper.createBranch('feature');
      await gitWrapper.checkout('main');
      
      const branch = await gitWrapper.getCurrentBranch();
      expect(branch).toBe('main');
    });
  });
  
  describe('Status Operations', () => {
    beforeEach(async () => {
      await gitWrapper.init();
    });
    
    it('should get status for non-repo directory', async () => {
      const nonRepoWrapper = new IsomorphicGitWrapper('/tmp/non-existent-' + Date.now());
      const status = await nonRepoWrapper.getStatus();
      
      expect(status.isRepo).toBe(false);
    });
    
    it('should get clean repo status', async () => {
      const status = await gitWrapper.getStatus();
      
      expect(status.isRepo).toBe(true);
      expect(status.currentBranch).toBe('main');
      expect(status.hasChanges).toBe(false);
      expect(status.untrackedFiles).toEqual([]);
      expect(status.modifiedFiles).toEqual([]);
    });
    
    it('should detect untracked files', async () => {
      fs.writeFileSync(path.join(testDir, 'new.txt'), 'new file');
      
      const status = await gitWrapper.getStatus();
      
      expect(status.hasChanges).toBe(true);
      expect(status.untrackedFiles).toContain('new.txt');
      expect(status.modifiedFiles).toEqual([]);
    });
    
    it('should detect modified files', async () => {
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'original content');
      await gitWrapper.addAndCommit(['test.txt'], 'Add test file');
      
      // Wait a moment to ensure filesystem has updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'modified content that is different');
      
      // Wait again to ensure the change is registered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = await gitWrapper.getStatus();
      
      expect(status.hasChanges).toBe(true);
      expect(status.untrackedFiles).toEqual([]);
      expect(status.modifiedFiles).toContain('test.txt');
    });
  });
  
  describe('History Operations', () => {
    beforeEach(async () => {
      await gitWrapper.init();
      
      // Create some commits
      for (let i = 1; i <= 5; i++) {
        fs.writeFileSync(path.join(testDir, `file${i}.txt`), `content ${i}`);
        await gitWrapper.addAndCommit([`file${i}.txt`], `Commit ${i}`);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });
    
    it('should get commit history', async () => {
      const history = await gitWrapper.getHistory();
      
      expect(history).toHaveLength(5);
      expect(history[0]?.message).toBe('Commit 5');
      expect(history[4]?.message).toBe('Commit 1');
      
      // Check that all fields are present
      history.forEach(commit => {
        expect(commit.hash).toMatch(/^[a-f0-9]+$/);
        expect(commit.message).toBeTruthy();
        expect(commit.date).toBeTruthy();
        expect(commit.author).toBe('Test User');
      });
    });
    
    it('should limit history results', async () => {
      const history = await gitWrapper.getHistory(3);
      
      expect(history).toHaveLength(3);
      expect(history[0]?.message).toBe('Commit 5');
      expect(history[2]?.message).toBe('Commit 3');
    });
  });
  
  describe('Merge Operations', () => {
    beforeEach(async () => {
      await gitWrapper.init();
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Main');
      await gitWrapper.addAndCommit(['README.md'], 'Initial commit');
    });
    
    it('should merge branches', async () => {
      // Create feature branch
      await gitWrapper.createBranch('feature');
      fs.writeFileSync(path.join(testDir, 'feature.txt'), 'feature content');
      await gitWrapper.addAndCommit(['feature.txt'], 'Add feature');
      
      // Go back to main
      await gitWrapper.checkout('main');
      
      // Merge feature
      await gitWrapper.merge('feature', 'Merge feature branch');
      
      // Check that feature file exists on main
      expect(fs.existsSync(path.join(testDir, 'feature.txt'))).toBe(true);
      
      // Check that merge happened
      const content = fs.readFileSync(path.join(testDir, 'feature.txt'), 'utf8');
      expect(content).toBe('feature content');
    });
  });
});