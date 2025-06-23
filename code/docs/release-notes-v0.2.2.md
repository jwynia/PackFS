# PackFS v0.2.2 Release Notes

## 🎉 Major Features

### Git Versioning Support

PackFS now includes optional git versioning that automatically tracks all file operations. This powerful feature enables:

- **Automatic Commits**: Every file operation can automatically create a git commit
- **Task-Based Development**: Group related changes on feature branches
- **Smart Commit Messages**: Configurable templates with operation context
- **Zero Configuration**: Works out of the box, initializes git repos as needed

#### Quick Start

```typescript
import { createVersionedFileSystem } from 'packfs-core';

// Create a filesystem with automatic git versioning
const fs = createVersionedFileSystem('/workspace/project', {
  versioning: {
    enabled: true,
    autoCommit: true,
    userInfo: {
      name: 'AI Assistant',
      email: 'ai@example.com'
    }
  }
});

// All operations are automatically versioned
await fs.executeNaturalLanguage('Create a new config file');
```

#### Task Management

```typescript
const backend = fs.getSemanticBackend();

// Start a new task on a feature branch
await backend.startTask({
  id: 'feature-123',
  description: 'Add authentication system',
  branch: 'feature/auth'  // Optional custom branch name
});

// All changes are tracked to the task branch
await fs.executeNaturalLanguage('Create auth middleware');
await fs.executeNaturalLanguage('Add user model');

// Complete and merge the task
await backend.completeTask('feature-123', {
  merge: true,
  createSummary: true
});
```

### Enhanced Documentation

- **Multi-Project Usage Guide**: Comprehensive documentation for runtime working directory configuration
- **Mastra Tool Description**: Improved discoverability of the `workingDirectory` parameter
- **Release Workflow Documentation**: Clear guidance on package release procedures

## 🐛 Bug Fixes

- Fixed singleton pattern issues with dynamic working directory support
- Improved error handling for git operations
- Enhanced TypeScript type definitions for versioning interfaces

## 📚 Documentation

- Added `/docs/multi-project-usage.md` with examples and best practices
- Updated Mastra integration docs with prominent `workingDirectory` parameter
- Created `/docs/release-preparation-workflow.md` for maintainers
- Enhanced README with versioning examples and use cases

## 🔧 Technical Improvements

- Added `GitWrapper` class for robust git operations
- Implemented `VersionedDiskSemanticBackend` extending the semantic backend
- Comprehensive test suite for versioning features (42 tests)
- Improved shell command escaping for git operations

## 💡 Use Cases

The new versioning feature is perfect for:

- **AI Pair Programming**: Track all changes made by AI assistants
- **Multi-Agent Collaboration**: Each agent works on its own branch
- **Audit Trail**: Complete history of all file operations
- **Experimentation**: Try changes on branches, merge only what works

## 🚀 Migration Guide

Existing users can continue using PackFS as before. To enable versioning:

```typescript
// Before
const fs = createFileSystem('/workspace');

// After (with versioning)
const fs = createVersionedFileSystem('/workspace', {
  versioning: { enabled: true }
});
```

## 📦 NPM Package

```bash
npm install packfs-core@0.2.2
```

## 🙏 Acknowledgments

Thanks to all contributors and users who provided feedback, especially those who tested the dynamic working directory feature in v0.2.1.

---

**Full Changelog**: https://github.com/your-org/packfs/compare/v0.2.1...v0.2.2