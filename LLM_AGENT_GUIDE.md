# PackFS LLM Agent Usage Guide

**Quick Reference for AI Agents using PackFS v0.2.3**

This guide provides clear, copy-paste examples for LLM agents to successfully use PackFS without backtracking.

## 🚀 Quickstart (Copy-Paste Ready)

### Step 1: Installation
```bash
npm install packfs-core
```

### Step 2: Choose Your Framework

#### **Mastra** (Recommended - Most Agent-Friendly)
```typescript
import { createMastraSemanticToolSuite } from 'packfs-core/mastra';

const { fileReader, fileWriter, fileSearcher, fileOrganizer } = 
  createMastraSemanticToolSuite({
    workingDirectory: '/your/project/path'
  });

// Natural language usage
const result = await fileReader.execute({
  query: "read the README file"
});
console.log(result.content); // Direct access to content
```

#### **LangChain**
```typescript
import { createLangChainSemanticFilesystemTool } from 'packfs-core/langchain';

const tool = createLangChainSemanticFilesystemTool({
  workingDirectory: '/your/project/path'
});

const result = await tool.func("read the README file");
// Returns formatted string output
```

#### **LlamaIndex**
```typescript
import { createLlamaIndexSemanticFilesystemTool } from 'packfs-core/llamaindex';

const tool = createLlamaIndexSemanticFilesystemTool({
  workingDirectory: '/your/project/path'
});

const result = await tool.call({ query: "read the README file" });
console.log(result.content); // Direct access to content
```

#### **Generic/Custom Framework**
```typescript
import { createFileSystem } from 'packfs-core';

const fs = createFileSystem('/your/project/path');
const result = await fs.executeNaturalLanguage("read the README file");
console.log(result.content);
```

## 🎯 Common Agent Patterns

### Pattern 1: Read Configuration Files
```typescript
// Natural language (works with any framework)
const config = await fileReader.execute({
  query: "read the configuration file"
});

// Structured (more precise)
const config = await fileReader.execute({
  operation: 'access',
  purpose: 'read',
  target: { path: 'config.json' }
});
```

### Pattern 2: Search for Specific Files
```typescript
// Find by pattern
const tests = await fileSearcher.execute({
  query: "find all test files"
});

// Find by content
const apiFiles = await fileSearcher.execute({
  query: "find files that contain API endpoints"
});

// Semantic search
const authFiles = await fileSearcher.execute({
  operation: 'discover',
  purpose: 'search_semantic',
  target: { semanticQuery: 'authentication and security' }
});
```

### Pattern 3: Create/Update Files
```typescript
// Create new file
const result = await fileWriter.execute({
  path: 'docs/api.md',
  content: '# API Documentation\n\n## Endpoints\n...',
  mode: 'create'
});

// Append to existing file
const result = await fileWriter.execute({
  path: 'CHANGELOG.md',
  content: '\n## v1.0.1\n- Bug fixes\n',
  mode: 'append'
});
```

### Pattern 4: Organize Project Structure
```typescript
// Create directories
await fileOrganizer.execute({
  operation: 'create_directory',
  destination: 'src/components'
});

// Move files
await fileOrganizer.execute({
  operation: 'move',
  source: 'old-file.js',
  destination: 'src/utils/old-file.js'
});

// Copy files
await fileOrganizer.execute({
  operation: 'copy',
  source: 'template.js',
  destination: 'src/components/NewComponent.js'
});
```

## ✅ Success Patterns (v0.2.3)

### **DO**: Access data directly (v0.2.3 flat structure)
```typescript
const result = await fileReader.execute({ query: "read config.json" });
console.log(result.content);    // ✅ Direct access
console.log(result.exists);     // ✅ Direct access
console.log(result.files);      // ✅ Direct access (for search results)
```

### **DON'T**: Use nested .data access (v0.1.x structure)
```typescript
const result = await fileReader.execute({ query: "read config.json" });
console.log(result.data.content); // ❌ This won't work in v0.2.3
```

### **DO**: Use consistent import paths
```typescript
// Framework-specific imports (recommended)
import { createMastraSemanticToolSuite } from 'packfs-core/mastra';
import { createLangChainSemanticFilesystemTool } from 'packfs-core/langchain';

// Generic imports (for custom frameworks)
import { createFileSystem } from 'packfs-core';
```

### **DO**: Handle errors properly
```typescript
const result = await fileReader.execute({ query: "read config.json" });

if (!result.success) {
  console.error('Error:', result.error);
  
  // Check for suggestions
  if (result.suggestions) {
    console.log('Did you mean:', result.suggestions);
  }
  
  return;
}

// Use the result
console.log('File content:', result.content);
```

## 🚨 Common Pitfalls & Solutions

### Pitfall 1: Import Path Confusion
**Problem**: Using wrong import paths leads to module not found errors.

**Solution**: Use framework-specific import paths:
```typescript
// ✅ Correct - Framework specific
import { createMastraSemanticToolSuite } from 'packfs-core/mastra';

// ❌ Incorrect - Generic import won't have framework tools
import { createMastraSemanticToolSuite } from 'packfs-core';
```

### Pitfall 2: Working Directory Issues
**Problem**: Operations fail with "path not found" errors.

**Solution**: Always specify absolute paths for workingDirectory:
```typescript
// ✅ Correct - Absolute path
const tools = createMastraSemanticToolSuite({
  workingDirectory: '/home/user/project'  // or process.cwd()
});

// ❌ Incorrect - Relative path
const tools = createMastraSemanticToolSuite({
  workingDirectory: './project'
});
```

### Pitfall 3: Parameter Format Confusion
**Problem**: Tools reject parameters due to wrong format.

**Solution**: PackFS accepts multiple parameter formats - use the simplest:
```typescript
// ✅ Simple format (recommended for agents)
await fileReader.execute({
  query: "read the README file"
});

// ✅ Direct parameters (also works)
await fileReader.execute({
  path: 'README.md',
  purpose: 'read'
});

// ✅ Structured format (for complex operations)
await fileReader.execute({
  operation: 'access',
  purpose: 'read',
  target: { path: 'README.md' }
});
```

### Pitfall 4: Accessing Nested Data (v0.1.x vs v0.2.3)
**Problem**: Trying to access `result.data.content` returns undefined.

**Solution**: v0.2.3 uses flat structure - access properties directly:
```typescript
const result = await fileReader.execute({ query: "read config.json" });

// ✅ v0.2.3 - Direct access
console.log(result.content);
console.log(result.exists);

// ❌ v0.1.x - Don't use .data
console.log(result.data.content); // undefined in v0.2.3
```

### Pitfall 5: File Not Found Errors
**Problem**: Operations fail when files don't exist.

**Solution**: Check existence first or use error handling:
```typescript
// Method 1: Check existence
const exists = await fileReader.execute({
  operation: 'access',
  purpose: 'exists',
  target: { path: 'config.json' }
});

if (exists.exists) {
  const content = await fileReader.execute({
    path: 'config.json',
    purpose: 'read'
  });
}

// Method 2: Use error handling
const result = await fileReader.execute({
  path: 'config.json',
  purpose: 'read'
});

if (!result.success) {
  console.log('File not found, creating default...');
  await fileWriter.execute({
    path: 'config.json',
    content: '{}',
    mode: 'create'
  });
}
```

## 📊 Response Structure Reference

### File Read Response
```typescript
{
  success: boolean;
  content: string;        // File content (direct access)
  exists: boolean;        // File existence check
  metadata: {            // Additional info (nested)
    size: number;
    modified: string;
    executionTime: number;
  }
}
```

### File Search Response
```typescript
{
  success: boolean;
  files: Array<{         // Search results (direct access)
    path: string;
    relevanceScore?: number;
    snippet?: string;
  }>;
  totalFound: number;    // Count (direct access)
  searchTime: number;    // Performance (direct access)
  metadata: {...}        // Additional info (nested)
}
```

### File Write Response
```typescript
{
  success: boolean;
  created: boolean;      // Whether file was created (direct access)
  path: string;         // File path (direct access)
  bytesWritten: number; // Bytes written (direct access)
  metadata: {...}       // Additional info (nested)
}
```

## 🔧 Security & Configuration

### Basic Security Setup
```typescript
const tools = createMastraSemanticToolSuite({
  workingDirectory: '/project',
  security: {
    allowedPaths: ['/project/**'],
    allowedExtensions: ['txt', 'md', 'json', 'js', 'ts'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    blockedPaths: ['node_modules', '.git', '.env']
  }
});
```

### Performance Optimization
```typescript
const tools = createMastraSemanticToolSuite({
  workingDirectory: '/project',
  performance: {
    enableCaching: true,
    maxResults: 50,
    timeoutMs: 5000
  }
});
```

## 🎯 Framework-Specific Tips

### Mastra Agents
- Use natural language queries for flexibility
- Access results directly: `result.content`, `result.files`
- Enable tracing for debugging: `mastra: { enableTracing: true }`

### LangChain Agents
- Tools return formatted strings by default
- Use structured inputs for precise control
- Chain multiple operations using the tool outputs

### LlamaIndex Agents
- Use both function and ToolSpec formats
- Integrate with query engines for semantic operations
- Leverage semantic search for RAG applications

## ✅ Quick Validation Checklist

Before using PackFS in your agent:
- [ ] Used correct import path for your framework
- [ ] Specified absolute `workingDirectory` path
- [ ] Accessing response properties directly (not via `.data`)
- [ ] Handling `success: false` responses
- [ ] Using appropriate security settings for your use case

## 📚 More Examples

See the `/code/docs/examples/` directory for framework-specific examples with input/output patterns.

---

**This guide is for PackFS v0.2.3. For older versions, see the migration guide.**