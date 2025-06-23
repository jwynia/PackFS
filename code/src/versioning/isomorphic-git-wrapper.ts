import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';

export interface GitConfig {
  userInfo?: {
    name: string;
    email: string;
  };
  defaultBranch?: string;
}

export interface GitStatus {
  isRepo: boolean;
  currentBranch?: string;
  hasChanges?: boolean;
  untrackedFiles?: string[];
  modifiedFiles?: string[];
}

/**
 * Cross-platform git wrapper using isomorphic-git
 * Works without requiring git to be installed
 */
export class IsomorphicGitWrapper {
  private author: { name: string; email: string };
  
  constructor(
    private workingDirectory: string,
    private config: GitConfig = {}
  ) {
    this.author = {
      name: config.userInfo?.name || 'PackFS',
      email: config.userInfo?.email || 'packfs@example.com'
    };
  }

  /**
   * Check if the working directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await git.findRoot({
        fs,
        filepath: this.workingDirectory
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize a new git repository
   */
  async init(): Promise<void> {
    await git.init({
      fs,
      dir: this.workingDirectory,
      defaultBranch: this.config.defaultBranch || 'main'
    });
  }

  /**
   * Ensure the working directory is a git repository
   */
  async ensureRepo(): Promise<void> {
    const isRepo = await this.isGitRepo();
    if (!isRepo) {
      await this.init();
      
      // Create initial commit if directory has files
      const files = await fs.promises.readdir(this.workingDirectory);
      const hasFiles = files.some(file => !file.startsWith('.git'));
      
      if (hasFiles) {
        // Add all files
        for (const filepath of files) {
          if (!filepath.startsWith('.git')) {
            await this.add([filepath]);
          }
        }
        await this.commit('Initial commit');
      }
    }
  }

  /**
   * Add files to staging area
   */
  async add(files: string[]): Promise<void> {
    for (const file of files) {
      const filepath = path.relative(this.workingDirectory, 
        path.resolve(this.workingDirectory, file));
      
      try {
        await git.add({
          fs,
          dir: this.workingDirectory,
          filepath
        });
      } catch (error) {
        // File might not exist or be outside repo
        console.warn(`Could not add file: ${filepath}`, error);
      }
    }
  }

  /**
   * Create a commit with the staged changes
   */
  async commit(message: string): Promise<string> {
    try {
      // Check if there are staged changes first
      const matrix = await git.statusMatrix({
        fs,
        dir: this.workingDirectory
      });
      
      let hasStaged = false;
      for (const [, head, workdir, stage] of matrix) {
        if (stage !== head || stage !== workdir) {
          hasStaged = true;
          break;
        }
      }
      
      if (!hasStaged) {
        return '';
      }
      
      const sha = await git.commit({
        fs,
        dir: this.workingDirectory,
        message,
        author: this.author
      });
      return sha;
    } catch (error: any) {
      if (error.code === 'NoStagedChangesError') {
        return '';
      }
      throw error;
    }
  }

  /**
   * Add files and create a commit in one operation
   */
  async addAndCommit(files: string[], message: string): Promise<string> {
    await this.add(files);
    return await this.commit(message);
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await git.currentBranch({
        fs,
        dir: this.workingDirectory
      });
      return branch || 'main';
    } catch {
      return 'main';
    }
  }

  /**
   * Create and checkout a new branch
   */
  async createBranch(name: string, baseBranch?: string): Promise<void> {
    // If base branch specified, first ensure we're on it
    if (baseBranch) {
      await this.checkout(baseBranch);
    }

    // Create the new branch
    await git.branch({
      fs,
      dir: this.workingDirectory,
      ref: name,
      checkout: true
    });
  }

  /**
   * Checkout an existing branch
   */
  async checkout(branch: string): Promise<void> {
    await git.checkout({
      fs,
      dir: this.workingDirectory,
      ref: branch
    });
  }

  /**
   * Get git status information
   */
  async getStatus(): Promise<GitStatus> {
    const isRepo = await this.isGitRepo();
    if (!isRepo) {
      return { isRepo: false };
    }

    const currentBranch = await this.getCurrentBranch();
    
    // Get status matrix with file content comparison
    const matrix = await git.statusMatrix({
      fs,
      dir: this.workingDirectory,
      filepaths: undefined, // Check all files
      cache: undefined // Don't use cache to ensure fresh status
    });
    
    const untrackedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    let hasChanges = false;
    
    for (const row of matrix) {
      const [filepath, head, workdir, stage] = row;
      
      // File status interpretation:
      // [filepath, HEAD, WORKDIR, STAGE]
      // HEAD: 0 = not in repo, 1 = in repo
      // WORKDIR: 0 = deleted, 1 = file is same as HEAD, 2 = file is different from HEAD
      // STAGE: 0 = not in staging area, 1 = same as HEAD, 2 = different from HEAD, 3 = added
      
      if (head === 0 && workdir === 2) {
        // Untracked file
        untrackedFiles.push(filepath);
        hasChanges = true;
      } else if (head === 1 && workdir === 0) {
        // Deleted file
        modifiedFiles.push(filepath);
        hasChanges = true;
      } else if (head === 1 && workdir === 2) {
        // Modified file (different from HEAD)
        modifiedFiles.push(filepath);
        hasChanges = true;
      } else if (workdir !== stage) {
        // File has unstaged changes
        if (head === 1) {
          modifiedFiles.push(filepath);
        }
        hasChanges = true;
      }
    }

    return {
      isRepo: true,
      currentBranch,
      hasChanges,
      untrackedFiles,
      modifiedFiles
    };
  }

  /**
   * Merge a branch into the current branch
   */
  async merge(branch: string, message?: string): Promise<void> {
    const currentBranch = await this.getCurrentBranch();
    
    // Perform the merge
    const result = await git.merge({
      fs,
      dir: this.workingDirectory,
      ours: currentBranch,
      theirs: branch,
      author: this.author,
      message: message || `Merge branch '${branch}' into ${currentBranch}`
    });
    
    // If it was a fast-forward or merge commit, checkout the result to update working directory
    if (result.oid) {
      await git.checkout({
        fs,
        dir: this.workingDirectory,
        ref: result.oid
      });
    }
  }

  /**
   * Get commit history
   */
  async getHistory(limit: number = 10): Promise<Array<{
    hash: string;
    message: string;
    date: string;
    author: string;
  }>> {
    const commits = await git.log({
      fs,
      dir: this.workingDirectory,
      depth: limit
    });
    
    return commits.map(commit => ({
      hash: commit.oid,
      message: commit.commit.message.trim(), // Remove trailing newlines
      date: new Date(commit.commit.author.timestamp * 1000).toISOString(),
      author: commit.commit.author.name
    }));
  }
}