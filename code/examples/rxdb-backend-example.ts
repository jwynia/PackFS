/**
 * Example: Using RxDB Backend with PackFS
 *
 * This example demonstrates how to use the RxDB NoSQL backend
 * for storing files in a document database.
 */

import { RxDBBackend } from '../src/backends/rxdb';
import { FileSystemInterface } from '../src/core/filesystem';
import { SecurityEngine } from '../src/core/security';

async function main() {
  // Create RxDB backend with in-memory storage
  const backend = new RxDBBackend({
    name: 'myapp-files', // Database name
    inMemory: false, // Use in-memory storage (false for persistent)
    password: 'optional-encryption-password', // Optional encryption
  });

  // Initialize the backend
  await backend.initialize();

  // Create security engine
  const security = new SecurityEngine({
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
    allowedExtensions: ['txt', 'md', 'json', 'log'],
    blockedPaths: ['/etc', '/root'],
    validatePaths: true,
  });

  // Create filesystem interface
  const fs = new FileSystemInterface(backend, security);

  // Example 1: Write and read a text file
  console.log('Example 1: Basic file operations');
  await fs.write('/documents/hello.txt', 'Hello from RxDB!');
  const content = await fs.read('/documents/hello.txt');
  console.log('Read content:', content);

  // Example 2: Store JSON data
  console.log('\nExample 2: Storing JSON data');
  const userData = {
    name: 'John Doe',
    email: 'john@example.com',
    preferences: {
      theme: 'dark',
      language: 'en',
    },
  };
  await fs.write('/data/user.json', JSON.stringify(userData, null, 2));

  // Example 3: List directory contents
  console.log('\nExample 3: Directory listing');
  await fs.write('/logs/app.log', 'Application started...');
  await fs.write('/logs/error.log', 'No errors yet!');
  await fs.write('/logs/debug.log', 'Debug information...');

  const files = await fs.list('/logs');
  console.log('Files in /logs:', files);

  // Example 4: File metadata
  console.log('\nExample 4: File metadata');
  const stats = await fs.stat('/documents/hello.txt');
  console.log('File stats:', {
    path: stats.path,
    size: stats.size,
    lastModified: stats.mtime,
    permissions: stats.permissions.toString(8),
  });

  // Example 5: Advanced RxDB features
  console.log('\nExample 5: Direct RxDB access');
  const db = backend.getDatabase();
  if (db) {
    // You can use RxDB's reactive queries
    const subscription = db.files
      .find({
        selector: {
          path: { $regex: '^/logs/' },
        },
      })
      .$.subscribe((docs) => {
        console.log(
          'Reactive query - Log files:',
          docs.map((d) => d.path)
        );
      });

    // Clean up subscription
    subscription.unsubscribe();
  }

  // Example 6: Performance - batch operations
  console.log('\nExample 6: Batch operations');
  const startTime = Date.now();

  // Write many files
  for (let i = 0; i < 50; i++) {
    await fs.write(`/batch/file${i}.txt`, `Content of file ${i}`);
  }

  const duration = Date.now() - startTime;
  console.log(`Wrote 50 files in ${duration}ms`);

  // Clean up
  await backend.cleanup();
  console.log('\nBackend cleaned up successfully');
}

// Run the example
main().catch(console.error);
