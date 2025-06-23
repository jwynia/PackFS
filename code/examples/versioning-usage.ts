/**
 * Example usage of PackFS with git versioning
 */
import { createVersionedFileSystem } from 'packfs-core';

async function basicVersioningExample() {
  console.log('=== Basic Versioning Example ===\n');
  
  // Create a versioned filesystem
  const fs = await createVersionedFileSystem('/tmp/my-project', {
    versioning: {
      enabled: true,
      autoCommit: true,
      userInfo: {
        name: 'PackFS Agent',
        email: 'agent@packfs.ai'
      },
      defaultBranch: 'main'
    }
  });
  
  // Initialize the filesystem
  await fs.initialize();
  
  // All operations are automatically versioned
  console.log('Creating configuration file...');
  await fs.updateContent({
    path: 'config.json',
    content: JSON.stringify({ version: '1.0.0', name: 'My Project' }, null, 2),
    purpose: 'create'
  });
  // Automatically commits: "Create config.json"
  
  console.log('Creating source file...');
  await fs.updateContent({
    path: 'src/index.js',
    content: 'console.log("Hello, World!");',
    purpose: 'create'
  });
  // Automatically commits: "Create src/index.js"
  
  console.log('Updating configuration...');
  await fs.updateContent({
    path: 'config.json',
    content: JSON.stringify({ version: '1.0.1', name: 'My Project', updated: true }, null, 2),
    purpose: 'update'
  });
  // Automatically commits: "Update config.json"
  
  console.log('\nAll changes have been automatically committed to git!');
}

async function taskBasedDevelopment() {
  console.log('\n=== Task-Based Development Example ===\n');
  
  const fs = await createVersionedFileSystem('/tmp/task-project', {
    versioning: {
      enabled: true,
      userInfo: {
        name: 'Dev Agent',
        email: 'dev@packfs.ai'
      }
    }
  });
  
  await fs.initialize();
  
  // Create initial project structure
  await fs.updateContent({
    path: 'README.md',
    content: '# Task-Based Project\n\nDemonstrating git branching with tasks.',
    purpose: 'create'
  });
  
  // Start a new feature task
  console.log('Starting authentication feature task...');
  const taskResult = await fs.startTask({
    id: 'add-auth-system',
    description: 'Implement user authentication',
    branch: 'feature/auth'
  });
  
  if (taskResult.success) {
    console.log(`Working on branch: ${taskResult.branch}`);
    
    // All subsequent operations happen on the feature branch
    console.log('Creating authentication module...');
    await fs.updateContent({
      path: 'src/auth/login.js',
      content: `
export async function login(username, password) {
  // Validate credentials
  if (!username || !password) {
    throw new Error('Username and password required');
  }
  
  // TODO: Implement actual authentication
  return { success: true, token: 'mock-token' };
}
`,
      purpose: 'create'
    });
    
    await fs.updateContent({
      path: 'src/auth/register.js',
      content: `
export async function register(userData) {
  // Validate user data
  if (!userData.email || !userData.password) {
    throw new Error('Email and password required');
  }
  
  // TODO: Implement user registration
  return { success: true, userId: 'mock-id' };
}
`,
      purpose: 'create'
    });
    
    // Complete the task
    console.log('Completing authentication task...');
    const completeResult = await fs.completeTask('add-auth-system', {
      merge: true,
      createSummary: true,
      summaryMessage: 'Implement basic authentication system with login and registration'
    });
    
    if (completeResult.success) {
      console.log(`Task completed! Created ${completeResult.commits?.length} commits`);
      console.log(`Changes ${completeResult.merged ? 'merged' : 'ready for review'} on branch ${completeResult.branch}`);
    }
  }
}

async function aiAgentWorkflow() {
  console.log('\n=== AI Agent Workflow Example ===\n');
  
  const fs = await createVersionedFileSystem('/tmp/agent-project', {
    versioning: {
      enabled: true,
      commitMessageTemplate: '[AI Agent] {{operation}} {{path}}',
      userInfo: {
        name: 'AI Assistant',
        email: 'ai@packfs.ai'
      }
    }
  });
  
  await fs.initialize();
  
  // AI agent performing code refactoring
  console.log('AI Agent starting refactoring task...');
  await fs.startTask({
    id: 'refactor-components',
    description: 'Refactor React components for better performance'
  });
  
  // Agent analyzes and updates multiple files
  const componentsToRefactor = [
    { path: 'src/components/Header.jsx', optimization: 'memo' },
    { path: 'src/components/List.jsx', optimization: 'virtualization' },
    { path: 'src/components/Form.jsx', optimization: 'controlled-inputs' }
  ];
  
  for (const component of componentsToRefactor) {
    console.log(`Optimizing ${component.path} with ${component.optimization}...`);
    
    await fs.updateContent({
      path: component.path,
      content: `// Optimized with ${component.optimization}\nimport React from 'react';\n\n// Component implementation...`,
      purpose: 'update'
    });
  }
  
  // Complete with detailed summary
  await fs.completeTask('refactor-components', {
    merge: false, // Keep on branch for human review
    createSummary: true,
    summaryMessage: 'AI-driven performance optimizations:\n- Added React.memo to Header\n- Implemented virtualization in List\n- Converted Form to controlled components'
  });
  
  console.log('AI Agent completed refactoring task!');
}

async function manualVersionControl() {
  console.log('\n=== Manual Version Control Example ===\n');
  
  const fs = await createVersionedFileSystem('/tmp/manual-project', {
    versioning: {
      enabled: true,
      autoCommit: false, // Manual commit control
      userInfo: {
        name: 'Developer',
        email: 'dev@example.com'
      }
    }
  });
  
  await fs.initialize();
  
  // Make multiple changes without auto-commit
  console.log('Making multiple changes...');
  await fs.updateContent({
    path: 'package.json',
    content: JSON.stringify({ name: 'manual-project', version: '1.0.0' }, null, 2),
    purpose: 'create'
  });
  
  await fs.updateContent({
    path: '.gitignore',
    content: 'node_modules/\ndist/\n.env',
    purpose: 'create'
  });
  
  await fs.updateContent({
    path: 'src/index.js',
    content: 'export default function main() {\n  console.log("Manual project");\n}',
    purpose: 'create'
  });
  
  // Manually commit all changes
  console.log('Committing all changes...');
  const commitResult = await fs.commit(
    'Initial project setup with package.json, .gitignore, and main entry point',
    ['package.json', '.gitignore', 'src/index.js']
  );
  
  if (commitResult.success) {
    console.log(`Created commit: ${commitResult.hash?.substring(0, 7)}`);
  }
  
  // View history
  console.log('\nCommit history:');
  const history = await fs.getHistory(5);
  if (history.success && history.commits) {
    history.commits.forEach(commit => {
      console.log(`${commit.hash.substring(0, 7)} - ${commit.message} (${commit.author})`);
    });
  }
}

// Run examples
async function runExamples() {
  try {
    await basicVersioningExample();
    await taskBasedDevelopment();
    await aiAgentWorkflow();
    await manualVersionControl();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}