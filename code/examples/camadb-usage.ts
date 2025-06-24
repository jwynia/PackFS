/**
 * Example of using the CamaDB backend with PackFS
 */

import { CamaDBBackend } from '../src/backends/camadb';
import { SimpleCamaDBBackend } from '../src/backends/camadb-simple';

async function exampleUsage() {
  console.log('CamaDB Backend Example\n');

  // Note: Due to CamaDB's current issues with fs persistence,
  // we'll use the in-memory adapter for this example
  const backend = new CamaDBBackend({
    dbPath: './example-camadb',
    adapter: 'inmemory',
    logLevel: 'info'
  });

  try {
    // Initialize the backend
    console.log('1. Initializing CamaDB backend...');
    await backend.initialize();
    console.log('   ✓ Backend initialized\n');

    // Write a file
    console.log('2. Writing a file...');
    const content = Buffer.from('Hello from CamaDB backend!');
    await backend.write('/hello.txt', content);
    console.log('   ✓ File written\n');

    // Check if file exists
    console.log('3. Checking if file exists...');
    const exists = await backend.exists('/hello.txt');
    console.log(`   ✓ File exists: ${exists}\n`);

    // Read the file
    console.log('4. Reading the file...');
    const readContent = await backend.read('/hello.txt');
    console.log(`   ✓ Content: "${readContent.toString()}"\n`);

    // Get file metadata
    console.log('5. Getting file metadata...');
    const metadata = await backend.stat('/hello.txt');
    console.log('   ✓ Metadata:', {
      size: metadata.size,
      isDirectory: metadata.isDirectory,
      permissions: metadata.permissions.toString(8),
      mimeType: metadata.mimeType
    });
    console.log();

    // Create a directory structure
    console.log('6. Creating directory structure...');
    await backend.write('/docs/README.md', Buffer.from('# Documentation'));
    await backend.write('/src/index.ts', Buffer.from('console.log("Hello");'));
    console.log('   ✓ Directory structure created\n');

    // List root directory
    console.log('7. Listing root directory...');
    const rootContents = await backend.list('/');
    console.log('   ✓ Root contents:', rootContents);
    console.log();

    // Advanced CamaDB features
    console.log('8. Using CamaDB-specific features...\n');

    // Tag files
    console.log('   a. Tagging files...');
    await backend.tagFile('/hello.txt', ['important', 'example']);
    await backend.tagFile('/docs/README.md', ['documentation', 'important']);
    console.log('      ✓ Files tagged\n');

    // Find files by tags
    console.log('   b. Finding files by tags...');
    const importantFiles = await backend.findByTags(['important']);
    console.log('      ✓ Files tagged as "important":', importantFiles);
    console.log();

    // Query files
    console.log('   c. Querying files...');
    const txtFiles = await backend.findFiles({ path: { $regex: /\.txt$/ } });
    console.log('      ✓ Found', txtFiles.length, 'text files');
    txtFiles.forEach(file => {
      console.log(`        - ${file.path} (${file.metadata.size} bytes)`);
    });
    console.log();

    // Delete a file
    console.log('9. Deleting a file...');
    await backend.delete('/hello.txt');
    const stillExists = await backend.exists('/hello.txt');
    console.log(`   ✓ File deleted (exists: ${stillExists})\n`);

    // Cleanup
    console.log('10. Cleaning up...');
    await backend.cleanup();
    console.log('    ✓ Backend cleaned up\n');

    console.log('Example completed successfully!');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Alternative: Using the simplified backend
async function simplifiedExample() {
  console.log('\n\nSimplified CamaDB Backend Example\n');
  
  const backend = new SimpleCamaDBBackend({
    dbPath: './example-simple-camadb'
  });

  try {
    await backend.initialize();
    
    // Basic operations
    await backend.write('/test.txt', Buffer.from('Simple backend test'));
    const content = await backend.read('/test.txt');
    console.log('Content:', content.toString());
    
    await backend.cleanup();
    console.log('Simplified backend working correctly!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the examples
(async () => {
  await exampleUsage();
  await simplifiedExample();
})();