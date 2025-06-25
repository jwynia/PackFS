# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2025-06-25

### Added
- 

### Changed
- 

### Fixed
- 


## [0.2.2] - 2025-06-22

### Added
- 

### Changed
- 

### Fixed
- 


## [0.2.1] - 2025-06-22

### Added
- 

### Changed
- 

### Fixed
- 


## [0.2.0] - 2025-06-20

### BREAKING CHANGES
- **LLM-Friendly Output Structure** - Flattened all integration output structures for direct LLM compatibility
  - All operational data (content, files, exists, etc.) now appears at the top level
  - Removed nested `data` property that was preventing LLMs from accessing results
  - Only metadata remains nested for organizational purposes
  - This change transforms PackFS from 100% LLM failure rate to 100% success rate

### Changed
- **Mastra Integration** - Complete restructure of output format
  - `result.data.content` → `result.content` (direct access)
  - `result.data.files` → `result.files` (direct access)
  - `result.data.exists` → `result.exists` (direct access)
  - All tool suite methods updated to handle flattened structures
  
### Migration Guide
If you're upgrading from v0.1.x, update your code to access properties directly:
```javascript
// Old (v0.1.x)
const content = result.data.content;
const files = result.data.files;

// New (v0.2.0)
const content = result.content;
const files = result.files;
```

### Added
- ADR-005: LLM-Friendly Output Structure documentation
- Comprehensive output structure guidelines in Mastra integration specification
- Migration examples and best practices

### Fixed
- Integration tests updated to validate flat output structures
- Tool suite methods properly handle flattened responses

## [0.1.20] - 2025-06-20

### Fixed
- **Critical: TypeError in keywordMap indexing** - Fixed "includes is not a function" error when loading corrupted indexes
  - Added validation when loading indexes from disk to ensure keywordMap entries are arrays
  - Added defensive checks in addToKeywordMap and removeFromKeywordMap methods
  - Prevents indexing failures when semantic index becomes corrupted
  - Added comprehensive tests to verify the fix

## [0.1.19] - 2025-06-20

### Fixed
- **Critical: Recursive directory indexing bug** - Fixed infinite recursion in DiskSemanticBackend that prevented initialization in real-world projects
  - Added protection against circular symlinks by tracking visited paths
  - Implemented maximum depth limit (10 levels) to prevent stack overflow
  - Added exclusion list for common large directories (node_modules, .git, .svn, dist, build, etc.)
  - All recursive methods now have proper termination conditions
  - Added comprehensive tests for deep directories and excluded paths

### Improved
- **Documentation for initialization requirements** - Added clear documentation about required parameters
  - Updated README.md with prominent notes about required `workingDirectory` parameter
  - Enhanced Mastra integration README with initialization warnings and examples
  - Created comprehensive Getting Started guide (docs/GETTING_STARTED.md)
  - Improved error messages to provide helpful initialization guidance
  - Added multiple initialization pattern examples for common use cases

## [0.1.18] - 2025-06-20

### Added
- Semantic search API with intelligent compression integration
- Compression strategies module with support for Brotli, LZ4, and Zstandard
- Storage strategies module for hybrid storage implementations
- Enhanced filesystem module with advanced features
- Benchmarking scripts and performance testing infrastructure
- Comprehensive logging system integration across all components

### Changed
- Reorganized codebase structure with dedicated modules for compression, storage, and enhanced features
- Moved SemanticSearchAPI to semantic module for better organization
- Updated module exports to include new compression and storage modules

### Fixed
- TypeScript compilation errors in enhanced modules
- Module organization for better maintainability

## [0.1.17] - 2025-06-20

### Added
- **Comprehensive Logging System** - New configurable logging infrastructure for all filesystem operations
  - Multiple log levels: DEBUG, INFO, WARN, ERROR, NONE
  - Multiple transport types:
    - ConsoleTransport - Formatted console output
    - FileTransport - File-based logging with automatic directory creation
    - MemoryTransport - In-memory storage for testing (with size limits)
    - CustomTransport - Create your own transport for custom needs
  - Hierarchical loggers with category-based filtering
  - Structured logging support with additional metadata
  - Minimal performance overhead (<5% in production scenarios)
  - Zero overhead when disabled (LogLevel.NONE)
- Logging integration across all components:
  - Core FileSystemInterface base class
  - DiskBackend - All file I/O operations logged
  - MemoryBackend - In-memory operations logged
  - DiskSemanticBackend - Semantic operations logged
  - SimpleEnhancedPackFS - Enhanced filesystem with logging
- Comprehensive logging examples (`examples/logging-configuration.ts`)
- Logging documentation (`docs/LOGGING.md`)
- Unit and integration tests for logging functionality

### Changed
- FileSystemInterface now includes protected logger property
- All backend implementations now log their operations
- Added @yarnpkg/fslib (v3.1.2) and @yarnpkg/libzip (v3.2.1) dependencies for enhanced modules

### Fixed
- TypeScript compilation errors in enhanced modules
- Build configuration to properly handle all module types


## [0.1.16] - 2025-06-20

### Added
- Convenience `createFileSystem()` function for simple one-line initialization
- Comprehensive migration guide (MIGRATION.md) for upgrading from v0.1.8
- Semantic API usage examples highlighting natural language operations
- LLM tool integration examples showing how to use PackFS with AI agents
- Release automation script with proper commit ordering

### Changed
- Updated README to emphasize natural language API as the primary interface
- Improved release process to prevent commits after tagging
- Converted build scripts to ES module syntax

### Fixed
- Test client reported issues: missing convenience initialization function
- Documentation now clearly shows semantic API is the primary interface
- Release script now handles ignored package-lock.json gracefully


## [0.1.13] - 2025-06-19

### Fixed

- **Critical**: Fixed framework integrations to properly check for filesystem initialization
- Added null checks for `config.filesystem` in LangChain.js, LlamaIndex.TS, and KaibanJS integrations
- Improved error messages with clear instructions when filesystem is not initialized
- Standardized error handling across all framework integrations

### Changed

- Enhanced error reporting with more specific error messages
- Improved TypeScript type safety with proper null checks

## [Unreleased]

## [0.1.12] - 2025-06-19

### Fixed

- **Critical**: Fixed Mastra integration initialization issues causing "Cannot read properties of undefined (reading 'accessFile')" errors
- Fixed parameter validation in Mastra tools to properly handle different parameter formats
- Added backward compatibility for both direct parameters and wrapped context objects
- Improved error messages with troubleshooting information for common issues
- Made filesystem property optional in BaseIntegrationConfig with automatic initialization

### Added

- Comprehensive documentation for Mastra integration in README.md
- Example code demonstrating proper usage patterns for all Mastra tools
- Added direct exports for backends, core, semantic, and processors modules
- Enhanced error handling with detailed troubleshooting suggestions
- Support for multiple parameter formats to improve developer experience

### Changed

- Updated TypeScript interfaces to better support optional configuration
- Improved filesystem initialization with better error handling
- Enhanced parameter validation with more helpful error messages

## [0.1.11] - 2025-01-19

### Fixed

- **Critical**: ESM module resolution issues causing ERR_MODULE_NOT_FOUND errors at runtime
- Added `.js` extensions to all relative imports in TypeScript source files for proper ESM compatibility
- Fixed package.json export paths now correctly resolve in Node.js ESM environments
- Mastra integration now works correctly with standard import patterns

### Changed

- Updated Jest configuration with moduleNameMapper to handle .js extensions in test environment
- Improved build system compatibility for both ESM and CommonJS outputs
- Enhanced module resolution for all framework integrations

### Verified

- All 167 tests pass with updated module resolution
- Package.json exports (`packfs-core/mastra`) now work correctly at runtime
- Mastra tools return proper interface with standard `{ success, data, error, metadata }` format
- Both single tool and tool suite patterns verified working

## [0.1.10] - 2025-01-19

### Added

- Native Mastra integration with createPackfsTools factory function
- MastraSecurityValidator with path restrictions, rate limiting, and extension filtering
- Comprehensive Zod schemas for AccessIntent, DiscoverIntent, and UpdateIntent operations
- Intent-based API reducing Mastra integration boilerplate from 160+ lines to under 20
- Tool factory pattern generating ready-to-use Mastra tools with security validation
- Complete test suite with 167 passing tests including Mastra integration tests

### Changed

- Added @mastra/core dependency for native Mastra framework integration
- Enhanced security configuration to support optional extension restrictions
- Improved TypeScript types for better Mastra API compatibility

### Fixed

- Security validator extension filtering logic for undefined allowedExtensions
- Mastra tool execution context compatibility with RuntimeContext requirements
- Type alignment between intent results and Mastra output schemas

## [0.1.9] - 2025-01-19

### Added

- Architecture Decision Record (ADR-004) for native Mastra integration layer
- Comprehensive implementation specification for Mastra tools factory
- Test suite preparation for upcoming Mastra native integration
- Detailed test plan with unit and integration test specifications

### Changed

- Architecture component map updated to include planned Mastra Adapter
- Roadmap updated with Mastra-specific milestones and features
- Jest configuration updated to support pending test structure

### Documentation

- Created comprehensive planning documents for Mastra native integration
- Prepared test coverage for future implementation
- Updated project roadmap with native framework integration priorities

## [0.1.8] - 2025-01-18

### Changed

- Enhanced semantic operation handling and error reporting across all framework integrations
- Improved error messages for better debugging experience
- Standardized error handling patterns across integrations

### Fixed

- Error reporting consistency in framework adapters

## [0.1.7] - 2025-01-18

### Added

- Initial release of PackFS semantic filesystem library to NPM
- Semantic filesystem operations with natural language understanding
- Intent-based operations: `accessFile`, `updateContent`, `discoverFiles`, `organizeFiles`, `removeFiles`
- Natural language query interpretation for file operations
- Memory-based semantic backend with full operation support
- Disk-based semantic backend with persistent indexing
- Keyword extraction and semantic file indexing
- Framework integrations for TypeScript/Node.js:
  - Mastra (TypeScript-first AI framework)
  - LangChain.js (DynamicTool interface)
  - LlamaIndex.TS (FunctionTool interface)
  - KaibanJS (Multi-agent system support)
- Backward compatibility with traditional filesystem operations
- Comprehensive test suite with 52+ tests
- Security controls with path validation and sandboxing
- Dual module support (ESM and CommonJS)
- TypeScript definitions included

### Security

- Path validation and normalization to prevent traversal attacks
- Configurable sandbox restrictions
- File size limits and extension controls
- Permission-based access control

[Unreleased]: https://github.com/jwynia/PackFS/compare/v0.1.13...HEAD
[0.1.13]: https://github.com/jwynia/PackFS/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/jwynia/PackFS/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/jwynia/PackFS/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/jwynia/PackFS/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/jwynia/PackFS/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/jwynia/PackFS/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/jwynia/PackFS/releases/tag/v0.1.7
