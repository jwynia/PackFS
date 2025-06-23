# PackFS

Semantic filesystem operations for LLM agent frameworks with natural language understanding.

FYI: This project is, in addition to its actual regular scope, one where I'm testing the use of LLM agents to manage a product AND another independent agent to build something using this package. Their back and forth may cause more feature churn than you're up for. You've been warned.

## Overview

PackFS is a TypeScript/Node.js library that provides intelligent filesystem operations through semantic understanding and natural language processing. Built specifically for LLM agent frameworks, it replaces traditional POSIX-style operations with intent-based semantic operations that understand what agents want to accomplish.

Inspired by the research in ["LLM-based Semantic File System for Large Codebases"](https://arxiv.org/html/2410.11843v5) and the [Python LSFS implementation](https://github.com/chenyushuo/LSFS), PackFS brings semantic filesystem capabilities to the TypeScript/Node.js ecosystem with a focus on agent framework integration.

## Features

- 🧠 **Semantic Operations**: Natural language file operations - "create a config file", "find all documentation", "organize by topic"
- 🤖 **LLM Agent Integration**: Native Mastra integration with tool factory pattern, plus support for LangChain.js, LlamaIndex.TS, and KaibanJS
- 📝 **Intent-Based Interface**: Replace traditional read/write with semantic operations like `accessFile`, `updateContent`, `discoverFiles`
- 🔍 **Intelligent Indexing**: Automatic keyword extraction and semantic file indexing for fast discovery
- 🔄 **Backward Compatibility**: Adapter pattern allows gradual migration from traditional filesystem operations
- 💾 **Multiple Backends**: Memory and persistent disk backends with semantic indexing
- 🔒 **Security Controls**: Path validation, sandboxing, and permission systems
- 🏢 **Dynamic Working Directory**: Runtime-configurable paths for multi-project support (NEW)
- 🔀 **Git Versioning**: Optional automatic git commits for all file operations with task-based branching (NEW)

## Installation

```bash
npm install packfs-core
```

## Quick Start

### Primary API: Natural Language Operations

```typescript
import { createFileSystem } from 'packfs-core';

// Initialize filesystem with one line
const fs = createFileSystem('/workspace');

// Natural language file operations - the primary interface for LLMs
await fs.executeNaturalLanguage('Create a config.json file with default database settings');

await fs.executeNaturalLanguage('Find all documentation files and organize them in a docs folder');

// Semantic search
const results = await fs.findFiles('configuration files', {
  searchType: 'semantic',
  maxResults: 5,
});

// The result includes interpreted intent and confidence
const result = await fs.executeNaturalLanguage('Backup all JavaScript files modified today');
console.log(`Operation confidence: ${result.confidence}`);
console.log(`Interpreted as: ${JSON.stringify(result.interpretedIntent)}`);
```

### Semantic API: Intent-Based Operations

```typescript
// For more control, use the semantic backend directly
const backend = fs.getSemanticBackend();

// Intent-based file access
const configResult = await backend.accessFile({
  purpose: 'read',
  target: { path: 'config.json' },
  preferences: { includeMetadata: true },
});

// Semantic file discovery
const docs = await backend.discoverFiles({
  purpose: 'search_semantic',
  target: { semanticQuery: 'API documentation' },
  options: { maxResults: 10 },
});

// Intelligent file organization
await backend.organizeFiles({
  purpose: 'group_semantic',
  target: { directory: 'organized' },
  criteria: 'Group files by their semantic purpose',
});
```

### Legacy API: POSIX-Style (Backward Compatible)

```typescript
// Traditional operations are still available for gradual migration
const fs = createFileSystem('/workspace');

// These work but consider using natural language instead
await fs.writeFile('file.txt', 'content');
const content = await fs.readFile('file.txt');
await fs.mkdir('new-folder');
const files = await fs.readdir('.');
```

### Framework Integrations

#### Mastra (Native Integration)

PackFS provides native Mastra integration with two patterns:

**Option 1: Semantic Filesystem Tool (Recommended)**

```typescript
import { createMastraSemanticFilesystemTool } from 'packfs-core';

// Create a unified semantic filesystem tool
// IMPORTANT: workingDirectory is REQUIRED
const packfsTool = createMastraSemanticFilesystemTool({
  workingDirectory: '/path/to/your/project', // REQUIRED - must be an absolute path
  // OR provide a pre-configured filesystem:
  // filesystem: new DiskSemanticBackend('/path/to/project'),
  security: {
    maxFileSize: 5 * 1024 * 1024, // 5MB limit
    allowedExtensions: ['.md', '.txt', '.json', '.js', '.ts'],
    forbiddenPaths: ['node_modules', '.git', '.env'],
  },
});

// Use with Mastra agents
const agent = new Agent({
  name: 'file-assistant',
  tools: { packfsTool },
});
```

**Option 2: Tool Suite Pattern**

```typescript
import { createPackfsTools } from 'packfs-core/integrations/mastra';

// Create separate tools for different operations
const tools = createPackfsTools({
  rootPath: '/project', // REQUIRED - resolves to workingDirectory
  permissions: ['read', 'write', 'search'],
  security: {
    maxFileSize: 5 * 1024 * 1024,
    allowedExtensions: ['.md', '.txt', '.json', '.js', '.ts'],
    blockedPaths: ['node_modules', '.git'],
  },
});

// Use individual tools in your Mastra agent
const fileContent = await tools.fileReader.execute({
  context: {
    purpose: 'read',
    target: { path: '/project/README.md' },
  },
  runtimeContext, // Mastra's runtime context
});

const searchResults = await tools.fileSearcher.execute({
  context: {
    purpose: 'search_content',
    target: { path: '/project' },
    options: { pattern: 'API.*endpoint' },
  },
  runtimeContext,
});

// Create new files with validation
await tools.fileWriter.execute({
  context: {
    purpose: 'create',
    target: { path: '/project/config.json' },
    content: JSON.stringify({ database: { host: 'localhost' } }),
  },
  runtimeContext,
});
```

**Semantic Operations**: The tools support intent-based operations:

- **AccessIntent**: `read`, `metadata`, `exists`
- **DiscoverIntent**: `list`, `search_content`, `search_semantic`
- **UpdateIntent**: `create`, `update`, `append`, `delete`

**Advanced Configuration**:

```typescript
const tools = createPackfsTools({
  rootPath: '/workspace',
  permissions: ['read', 'write', 'search', 'list'],
  security: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.md', '.txt', '.json', '.js', '.ts', '.py'],
    blockedPaths: ['node_modules', '.git', '.env', 'secrets'],
    rateLimiting: {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
    },
  },
  semantic: {
    enableRelationships: true,
    chunkSize: 2000,
    overlapSize: 200,
    relevanceThreshold: 0.5,
  },
});

// Generated tools: fileReader, fileWriter, fileSearcher, fileLister
// Each tool includes automatic security validation and error handling
```

**Dynamic Working Directory** (NEW):

```typescript
// Access files from different projects without reinitializing
const mastraTool = createMastraSemanticFilesystemTool({
  workingDirectory: '/main/workspace',
  filesystem: backend
});

// Read from project A
const resultA = await mastraTool.execute({
  operation: 'access',
  purpose: 'read',
  target: { path: 'context.md' },
  workingDirectory: '/projects/project-a'  // Runtime override
});

// Read from project B
const resultB = await mastraTool.execute({
  operation: 'access',
  purpose: 'read',
  target: { path: 'context.md' },
  workingDirectory: '/projects/project-b'  // Different project
});

// Also works with natural language
const result = await mastraTool.execute({
  naturalLanguageQuery: 'find all documentation files',
  workingDirectory: '/projects/project-c'
});
```

#### LangChain.js

```typescript
import { createLangChainSemanticFilesystemTool } from 'packfs-core';

const tool = createLangChainSemanticFilesystemTool({
  filesystem: new MemorySemanticBackend(),
  workingDirectory: '/project',
  langchain: { verbose: true },
});

// LangChain DynamicTool compatible
const response = await tool.func('read the configuration file');
console.log(response); // File content as string
```

#### LlamaIndex.TS

```typescript
import { createLlamaIndexSemanticFilesystemTool } from 'packfs-core';

const tool = createLlamaIndexSemanticFilesystemTool({
  filesystem: new MemorySemanticBackend(),
  workingDirectory: '/project',
});

// LlamaIndex FunctionTool compatible
const result = await tool.call({
  action: 'search',
  searchTerm: 'API documentation',
});
```

#### KaibanJS (Multi-Agent Systems)

```typescript
import { createKaibanSemanticFilesystemTool } from 'packfs-core';

const tool = createKaibanSemanticFilesystemTool({
  filesystem: new MemorySemanticBackend(),
  workingDirectory: '/shared',
  kaiban: {
    agentId: 'file-manager',
    enableStatePersistence: true,
  },
});

// Multi-agent collaboration
const result = await tool.handler({
  action: 'write',
  path: '/shared/team-notes.md',
  content: 'Team meeting notes',
  collaboration: {
    shareWith: ['agent-001', 'agent-002'],
    notifyAgents: true,
  },
});
```

### Semantic File Discovery

```typescript
import { DiskSemanticBackend } from 'packfs-core';

// Persistent semantic indexing
const fs = new DiskSemanticBackend({
  rootPath: '/project',
  indexPath: '.packfs/semantic-index.json',
});

// Find files by semantic meaning
const configFiles = await fs.discoverFiles({
  purpose: 'search_semantic',
  target: { semanticQuery: 'configuration and settings' },
});

// Find files by content patterns
const apiDocs = await fs.discoverFiles({
  purpose: 'search_content',
  target: { pattern: 'API|endpoint|route' },
});

// Organize files by topic
const organized = await fs.organizeFiles({
  purpose: 'group_semantic',
  source: { path: '/project/docs' },
  destination: { path: '/project/organized' },
  options: { groupBy: 'topic' },
});
```

### Intelligent Error Recovery

PackFS reduces LLM token usage by providing smart suggestions when file operations fail:

```typescript
// When a file is not found
const result = await fs.accessFile({
  purpose: 'read',
  target: { path: 'context-network/foundation/index.md' },
});

if (!result.success) {
  console.log(result.message);
  // Output:
  // File not found: context-network/foundation/index.md
  //
  // Suggestions:
  // • Directory listing of 'context-network/foundation'
  //   Files: core.md, principles.md, objectives.md ... and 3 more
  // • Alternative paths that exist
  //   Try: context-network/index.md
  // • Found 'index.md' in other locations
  //   Found in: docs/index.md, src/index.md
}

// When search returns no results
const searchResult = await fs.discoverFiles({
  purpose: 'search_content',
  target: { semanticQuery: 'quantum blockchain AI' },
});

if (searchResult.files.length === 0 && searchResult.suggestions) {
  // Suggestions include:
  // - Alternative search terms
  // - Individual term searches: 'quantum', 'blockchain', 'AI'
}
```

This feature helps LLMs find what they're looking for without multiple retry attempts, significantly reducing API costs and improving response times.

### Git Versioning Support (NEW)

PackFS now includes optional git versioning that automatically tracks all file operations using a pure TypeScript implementation (no git binary required). This is perfect for AI agents that need to:
- Track changes across complex multi-file operations
- Group related changes into logical tasks
- Maintain a complete audit trail
- Rollback changes if needed

```typescript
import { createVersionedFileSystem } from 'packfs-core';

// Create a filesystem with automatic git versioning
const fs = createVersionedFileSystem('/workspace/project', {
  versioning: {
    enabled: true,
    autoCommit: true,  // Automatically commit every file operation
    userInfo: {
      name: 'AI Assistant',
      email: 'ai@example.com'
    },
    commitMessageTemplate: '[{{operation}}] {{path}} - {{taskId}}'
  }
});

// All operations are automatically versioned
await fs.executeNaturalLanguage('Create a new feature module');
// Commits: "[create] src/features/newFeature.ts - "

// Task-based development with branches
const backend = fs.getSemanticBackend();
await backend.startTask({
  id: 'feature-auth',
  description: 'Implement authentication system',
  branch: 'feature/authentication'  // Optional custom branch name
});

// All changes are tracked to the task branch
await fs.executeNaturalLanguage('Create auth middleware and user model');
await fs.executeNaturalLanguage('Add login and signup endpoints');

// Complete and merge the task
await backend.completeTask('feature-auth', {
  merge: true,
  createSummary: true
});
```

**Key Features**:
- **Automatic Versioning**: Every file operation creates a git commit
- **Task Management**: Group related changes on feature branches
- **Smart Commit Messages**: Configurable templates with context
- **Zero Configuration**: Works out of the box, initializes git repos as needed
- **Manual Control**: Disable auto-commit for manual version control

**Use Cases**:
- **AI Pair Programming**: Track all changes made by AI assistants
- **Multi-Agent Collaboration**: Each agent works on its own branch
- **Audit Trail**: Complete history of all file operations
- **Experimentation**: Try changes on branches, merge only what works

## API Reference

### Semantic Interface

- `SemanticFileSystemInterface` - Abstract base for semantic operations
- `MemorySemanticBackend` - In-memory semantic filesystem
- `DiskSemanticBackend` - Persistent semantic filesystem with indexing

### Semantic Operations

- `accessFile(intent)` - Read, preview, or verify file existence
- `updateContent(intent)` - Create, append, overwrite, or patch files
- `discoverFiles(intent)` - List, find, or search files semantically
- `organizeFiles(intent)` - Move, copy, or group files by semantic criteria
- `removeFiles(intent)` - Delete files or directories
- `interpretNaturalLanguage(query)` - Convert natural language to intents

### Traditional Interface (Backward Compatible)

- `FileSystemInterface` - Abstract base class for traditional operations
- `MemoryBackend` - In-memory storage
- `DiskBackend` - Local filesystem storage
- `SecurityEngine` - Security validation and access control

### Framework Integrations

#### Native Mastra Integration

- `createPackfsTools(config)` - Native tool factory for Mastra agents
- `MastraSecurityValidator` - Security validation with path restrictions and rate limiting
- Intent-based schemas: `AccessIntent`, `DiscoverIntent`, `UpdateIntent`

#### Legacy Framework Integrations

- `createLangChainSemanticFilesystemTool` - LangChain.js integration
- `createLlamaIndexSemanticFilesystemTool` - LlamaIndex.TS integration
- `createKaibanSemanticFilesystemTool` - KaibanJS multi-agent integration

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

## Semantic Design Philosophy

PackFS is built around semantic understanding rather than traditional filesystem operations:

- **Intent-Based Operations**: Instead of `fs.readFile()`, use semantic operations like `accessFile({ purpose: 'read' })`
- **Natural Language Support**: Agents can use plain English - "create a config file" instead of complex API calls
- **Contextual Understanding**: Operations understand the semantic meaning of file content and organization
- **Framework Native**: Built specifically for LLM agent frameworks with their patterns and needs

Inspired by the [LSFS research paper](https://arxiv.org/html/2410.11843v5), PackFS implements the concept of semantic filesystem operations that better match how LLM agents think about and work with files.

## Security Considerations

While semantic operations are the primary focus, PackFS maintains strong security:

- Path validation and normalization prevent traversal attacks
- Configurable sandbox restrictions
- File size limits and extension controls
- Permission-based access control

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our GitHub repository.
