import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

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

export class GitWrapper {
  constructor(
    private workingDirectory: string,
    private config: GitConfig = {}
  ) {}

  /**
   * Execute a git command in the working directory
   */
  private async exec(args: string[]): Promise<string> {
    try {
      // Properly escape arguments for shell execution
      const quotedArgs = args.map(arg => {
        // Don't quote flags that start with -
        if (arg.startsWith('-') && !arg.includes('=')) return arg;
        // For --pretty=format: arguments, quote the whole thing
        if (arg.startsWith('--pretty=')) {
          return `'${arg}'`;
        }
        // Quote arguments that contain spaces or special characters
        if (/[\s"'`$(){}[\]|&;<>%]/.test(arg)) {
          return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
      });
      
      const command = `git ${quotedArgs.join(' ')}`;
      const { stdout } = await execAsync(command, {
        cwd: this.workingDirectory,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      });
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Git command failed: ${error.message}`);
    }
  }

  /**
   * Check if the working directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await this.exec(['rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize a new git repository
   */
  async init(): Promise<void> {
    await this.exec(['init']);
    
    // Set default branch if specified
    if (this.config.defaultBranch && this.config.defaultBranch !== 'master') {
      await this.exec(['checkout', '-b', this.config.defaultBranch]);
    }

    // Configure user if provided
    if (this.config.userInfo) {
      await this.exec(['config', '--local', 'user.name', this.config.userInfo.name]);
      await this.exec(['config', '--local', 'user.email', this.config.userInfo.email]);
    }
  }

  /**
   * Ensure the working directory is a git repository
   */
  async ensureRepo(): Promise<void> {
    const isRepo = await this.isGitRepo();
    if (!isRepo) {
      await this.init();
      
      // Create initial commit if directory has files
      const hasFiles = fs.readdirSync(this.workingDirectory).some(
        file => !file.startsWith('.git')
      );
      
      if (hasFiles) {
        await this.exec(['add', '.']);
        await this.commit('Initial commit');
      }
    }
  }

  /**
   * Add files to staging area
   */
  async add(files: string[]): Promise<void> {
    if (files.length === 0) return;
    
    // Convert to relative paths
    const relativePaths = files.map(file => 
      path.relative(this.workingDirectory, path.resolve(this.workingDirectory, file))
    );
    
    await this.exec(['add', ...relativePaths]);
  }

  /**
   * Create a commit with the staged changes
   */
  async commit(message: string): Promise<string> {
    const result = await this.exec(['commit', '-m', message]);
    
    // Extract commit hash from output
    // Git output format: [branch-name hash] message
    const match = result.match(/\[(?:[\w\s-]+\s+)?([a-f0-9]+)\]/);
    if (match?.[1]) {
      return match[1];
    }
    
    // Try to get the latest commit hash if extraction fails
    try {
      return await this.exec(['rev-parse', 'HEAD']);
    } catch {
      return '';
    }
  }

  /**
   * Add files and create a commit in one operation
   */
  async addAndCommit(files: string[], message: string): Promise<string> {
    await this.add(files);
    
    // Check if there are changes to commit
    try {
      await this.exec(['diff', '--cached', '--exit-code']);
      // If exit code is 0, there are no changes
      return '';
    } catch {
      // Exit code non-zero means there are changes
      return await this.commit(message);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      return await this.exec(['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {
      // If no commits yet, try symbolic-ref
      try {
        const ref = await this.exec(['symbolic-ref', '--short', 'HEAD']);
        return ref;
      } catch {
        // Default to main if we can't determine
        return 'main';
      }
    }
  }

  /**
   * Create and checkout a new branch
   */
  async createBranch(name: string, baseBranch?: string): Promise<void> {
    if (baseBranch) {
      await this.exec(['checkout', baseBranch]);
    }
    await this.exec(['checkout', '-b', name]);
  }

  /**
   * Checkout an existing branch
   */
  async checkout(branch: string): Promise<void> {
    await this.exec(['checkout', branch]);
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
    
    // Get list of changed files
    const status = await this.exec(['status', '--porcelain']);
    const lines = status.split('\n').filter(line => line.trim());
    
    const untrackedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    
    lines.forEach(line => {
      const [status, ...pathParts] = line.trim().split(' ');
      const filePath = pathParts.join(' ');
      
      if (status === '??') {
        untrackedFiles.push(filePath);
      } else if (status === 'M' || status === 'MM' || status === 'AM') {
        modifiedFiles.push(filePath);
      }
    });

    return {
      isRepo: true,
      currentBranch,
      hasChanges: lines.length > 0,
      untrackedFiles,
      modifiedFiles
    };
  }

  /**
   * Merge a branch into the current branch
   */
  async merge(branch: string, message?: string): Promise<void> {
    const args = ['merge', branch];
    if (message) {
      args.push('-m', message);
    }
    await this.exec(args);
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
    const log = await this.exec([
      'log', 
      '--pretty=format:%H|%s|%ai|%an', 
      `-${limit}`
    ]);
    
    if (!log) return [];
    
    return log.split('\n').filter(line => line.trim()).map(line => {
      const [hash, message, date, author] = line.split('|');
      return { 
        hash: hash || '', 
        message: message || '', 
        date: date || '', 
        author: author || '' 
      };
    });
  }
}