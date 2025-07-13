# PackFS

Semantic filesystem operations for LLM agent frameworks with natural language understanding.

## Overview

PackFS is a TypeScript/Node.js library that provides intelligent filesystem operations through semantic understanding and natural language processing. Built specifically for LLM agent frameworks, it replaces traditional POSIX-style operations with intent-based semantic operations that understand what agents want to accomplish.

Inspired by the research in ["LLM-based Semantic File System for Large Codebases"](https://arxiv.org/html/2410.11843v5) and the [Python LSFS implementation](https://github.com/chenyushuo/LSFS), PackFS brings semantic filesystem capabilities to the TypeScript/Node.js ecosystem with a focus on agent framework integration.

## Features

- 🧠 **Semantic Operations**: Natural language file operations - "create a config file", "find all documentation", "organize by topic"
- 🤖 **Native Mastra Integration**: Tool factory pattern reduces integration boilerplate from 160+ lines to under 20
- 📝 **Intent-Based Interface**: Replace traditional read/write with semantic operations like `accessFile`, `updateContent`, `discoverFiles`
- 🔍 **Intelligent Indexing**: Automatic keyword extraction and semantic file indexing for fast discovery
- 🔄 **Backward Compatibility**: Adapter pattern allows gradual migration from traditional filesystem operations
- 💾 **Multiple Backends**: Memory and persistent disk backends with semantic indexing
- 🔒 **Security Controls**: Path validation, sandboxing, and permission systems

## 🚀 For LLM Agents: Quick Start Guide

**New to PackFS? Multiple projects have reported agents going down wrong usage paths.**

👉 **[LLM Agent Usage Guide](./LLM_AGENT_GUIDE.md)** - Copy-paste examples, common patterns, and pitfall solutions specifically designed for AI agents.

## Installation

```bash
npm install packfs-core
```

## Quick Start

### Native Mastra Integration

PackFS provides native Mastra integration with a tool factory pattern that reduces boilerplate from 160+ lines to under 20:

```typescript
import { createPackfsTools } from 'packfs-core/integrations/mastra';

// Create tools with minimal configuration
const tools = createPackfsTools({
  rootPath: '/project',
  permissions: ['read', 'write', 'search'],
  security: {
    maxFileSize: 5 * 1024 * 1024, // 5MB limit
    allowedExtensions: ['.md', '.txt', '.json', '.js', '.ts'],
    blockedPaths: ['node_modules', '.git']
  }
});

// Use individual tools in your Mastra agent
const fileContent = await tools.fileReader.execute({
  context: {
    purpose: 'read',
    target: { path: '/project/README.md' }
  },
  runtimeContext // Mastra's runtime context
});

const searchResults = await tools.fileSearcher.execute({
  context: {
    purpose: 'search_content',
    target: { path: '/project' },
    options: { pattern: 'API.*endpoint' }
  },
  runtimeContext
});

// Create new files with validation
await tools.fileWriter.execute({
  context: {
    purpose: 'create',
    target: { path: '/project/config.json' },
    content: JSON.stringify({ database: { host: 'localhost' } })
  },
  runtimeContext
});
```

**Semantic Operations**: The tools support intent-based operations:
- **AccessIntent**: `read`, `metadata`, `exists`
- **DiscoverIntent**: `list`, `search_content`, `search_semantic`  
- **UpdateIntent**: `create`, `update`, `append`, `delete`

### Semantic Operations

```typescript
import { MemorySemanticBackend } from 'packfs-core';

// Initialize semantic filesystem
const fs = new MemorySemanticBackend();

// Natural language file operations
const result = await fs.interpretNaturalLanguage({
  query: "create a config file with database settings",
  context: { workingDirectory: "/app" }
});

// Intent-based operations
const configResult = await fs.updateContent({
  purpose: 'create',
  target: { path: '/app/config.json' },
  content: JSON.stringify({ database: { host: 'localhost', port: 5432 } })
});

// Semantic file discovery
const docs = await fs.discoverFiles({
  purpose: 'search_semantic',
  target: { semanticQuery: 'documentation and readme files' }
});

console.log(`Found ${docs.files.length} documentation files`);
```

### Traditional Interface (Backward Compatible)

```typescript
import { DiskBackend, SecurityEngine } from 'packfs-core';

// Traditional POSIX-style operations still supported
const security = new SecurityEngine({
  maxFileSize: 1024 * 1024,
  allowedExtensions: ['txt', 'md', 'json'],
  allowedPaths: ['/safe/**']
});

const backend = new DiskBackend({ security });
const content = await backend.read('/safe/file.txt');
```

## Advanced Configuration

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
      windowMs: 60000 // 1 minute
    }
  },
  semantic: {
    enableRelationships: true,
    chunkSize: 2000,
    overlapSize: 200,
    relevanceThreshold: 0.5
  }
});

// Generated tools: fileReader, fileWriter, fileSearcher, fileLister
// Each tool includes automatic security validation and error handling
```

## Architecture

PackFS implements a three-layer architecture optimized for LLM agent interactions:

### Core Layer
- **FileSystem Interface**: Abstract filesystem operations with pluggable backends
- **Content Processors**: Semantic chunking and text processing utilities
- **Security Engine**: Path validation, sandboxing, and permission management

### Integration Layer
- **Native Mastra Integration**: Tool factory with intent-based operations
- **Framework Adapters**: Support for LangChain.js, LlamaIndex.TS, and KaibanJS
- **Semantic Processing**: Natural language understanding and file organization

### Backend Layer
- **Storage Backends**: Memory and disk backends with unified interface
- **Semantic Indexing**: Persistent semantic file indexing and discovery
- **Virtual Filesystems**: Safe testing and agent isolation environments

## API Reference

### Native Mastra Integration
- `createPackfsTools(config)` - Native tool factory for Mastra agents
- `MastraSecurityValidator` - Security validation with path restrictions and rate limiting
- Intent-based schemas: `AccessIntent`, `DiscoverIntent`, `UpdateIntent`

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

## Development

```bash
# Navigate to code directory
cd code

# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Run linting and type checking
npm run typecheck
```

## Design Philosophy

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
- Rate limiting for agent protection

## 🔧 Troubleshooting

### Common Issues for LLM Agents

**Import errors**: Use framework-specific paths
```typescript
// ✅ Correct
import { createMastraSemanticToolSuite } from 'packfs-core/mastra';
// ❌ Wrong  
import { createMastraSemanticToolSuite } from 'packfs-core';
```

**"Cannot access .data" errors**: v0.2.3 uses flat structure
```typescript
// ✅ v0.2.3
console.log(result.content);
// ❌ v0.1.x 
console.log(result.data.content);
```

**Path not found errors**: Use absolute paths for `workingDirectory`
```typescript
// ✅ Correct
workingDirectory: '/home/user/project'  // or process.cwd()
// ❌ Wrong
workingDirectory: './project'
```

See [LLM_AGENT_GUIDE.md](./LLM_AGENT_GUIDE.md) for complete troubleshooting guide.

## Context Network Documentation

This project leverages a context network approach for documentation and knowledge management. Comprehensive documentation is available in the context network:

- **Architecture Decisions**: See `context-network/decisions/`
- **Component Documentation**: See `context-network/elements/`
- **Integration Guides**: See `context-network/processes/`
- **Implementation Details**: See `context-network/architecture/`

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our GitHub repository.

The project follows a context network approach - before contributing, please review the documentation in `./context-network/` to understand the design principles and architectural decisions.