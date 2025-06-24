/**
 * Tests for CamaDB backend
 */

import { CamaDBBackend } from '../../src/backends/camadb';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('CamaDBBackend', () => {
  let backend: CamaDBBackend;
  const testDbPath = path.join(__dirname, '.test-camadb');

  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.rm(testDbPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }

    backend = new CamaDBBackend({
      dbPath: testDbPath,
      adapter: 'fs',
      logLevel: 'error'
    });
    await backend.initialize();
  });

  afterEach(async () => {
    await backend.cleanup();
    // Clean up test database
    try {
      await fs.rm(testDbPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Already initialized in beforeEach
      expect(backend).toBeDefined();
    });

    it('should handle multiple initialize calls', async () => {
      // Should not throw
      await backend.initialize();
      await backend.initialize();
    });
  });

  describe('write and read', () => {
    it('should write and read a file', async () => {
      const testPath = '/test.txt';
      const testData = Buffer.from('Hello, CamaDB!');

      await backend.write(testPath, testData);
      const result = await backend.read(testPath);

      expect(result).toEqual(testData);
    });

    it('should overwrite existing files', async () => {
      const testPath = '/test.txt';
      const data1 = Buffer.from('First version');
      const data2 = Buffer.from('Second version');

      await backend.write(testPath, data1);
      await backend.write(testPath, data2);
      const result = await backend.read(testPath);

      expect(result).toEqual(data2);
    });

    it('should create parent directories automatically', async () => {
      const testPath = '/dir1/dir2/test.txt';
      const testData = Buffer.from('Nested file');

      await backend.write(testPath, testData);
      const result = await backend.read(testPath);

      expect(result).toEqual(testData);
    });

    it('should throw error when reading non-existent file', async () => {
      await expect(backend.read('/non-existent.txt')).rejects.toThrow('File not found');
    });

    it('should throw error when reading a directory', async () => {
      await backend.write('/dir/file.txt', Buffer.from('test'));
      await expect(backend.read('/dir')).rejects.toThrow('Path is a directory');
    });
  });

  describe('exists', () => {
    it('should return true for existing files', async () => {
      await backend.write('/test.txt', Buffer.from('test'));
      const exists = await backend.exists('/test.txt');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      const exists = await backend.exists('/non-existent.txt');
      expect(exists).toBe(false);
    });

    it('should return true for directories', async () => {
      await backend.write('/dir/file.txt', Buffer.from('test'));
      const exists = await backend.exists('/dir');
      expect(exists).toBe(true);
    });

    it('should return true for root directory', async () => {
      const exists = await backend.exists('/');
      expect(exists).toBe(true);
    });
  });

  describe('stat', () => {
    it('should return file metadata', async () => {
      const testData = Buffer.from('Test content');
      await backend.write('/test.txt', testData);
      
      const stat = await backend.stat('/test.txt');
      
      expect(stat.size).toBe(testData.length);
      expect(stat.isDirectory).toBe(false);
      expect(stat.mtime).toBeInstanceOf(Date);
      expect(stat.permissions).toBe(0o644);
      expect(stat.mimeType).toBe('text/plain');
    });

    it('should return directory metadata', async () => {
      await backend.write('/dir/file.txt', Buffer.from('test'));
      
      const stat = await backend.stat('/dir');
      
      expect(stat.size).toBe(0);
      expect(stat.isDirectory).toBe(true);
      expect(stat.permissions).toBe(0o755);
    });

    it('should throw error for non-existent path', async () => {
      await expect(backend.stat('/non-existent')).rejects.toThrow('Path not found');
    });
  });

  describe('list', () => {
    it('should list directory contents', async () => {
      await backend.write('/file1.txt', Buffer.from('1'));
      await backend.write('/file2.txt', Buffer.from('2'));
      await backend.write('/dir/file3.txt', Buffer.from('3'));

      const contents = await backend.list('/');
      
      expect(contents).toContain('file1.txt');
      expect(contents).toContain('file2.txt');
      expect(contents).toContain('dir');
      expect(contents).not.toContain('file3.txt');
    });

    it('should list empty directory', async () => {
      await backend.write('/empty/temp.txt', Buffer.from('temp'));
      await backend.delete('/empty/temp.txt');

      const contents = await backend.list('/empty');
      expect(contents).toEqual([]);
    });

    it('should throw error for non-existent directory', async () => {
      await expect(backend.list('/non-existent')).rejects.toThrow('Directory not found');
    });

    it('should throw error when listing a file', async () => {
      await backend.write('/file.txt', Buffer.from('test'));
      await expect(backend.list('/file.txt')).rejects.toThrow('Directory not found');
    });
  });

  describe('delete', () => {
    it('should delete files', async () => {
      await backend.write('/test.txt', Buffer.from('test'));
      await backend.delete('/test.txt');
      
      const exists = await backend.exists('/test.txt');
      expect(exists).toBe(false);
    });

    it('should delete empty directories', async () => {
      await backend.write('/dir/temp.txt', Buffer.from('temp'));
      await backend.delete('/dir/temp.txt');
      await backend.delete('/dir');
      
      const exists = await backend.exists('/dir');
      expect(exists).toBe(false);
    });

    it('should throw error when deleting non-empty directory', async () => {
      await backend.write('/dir/file.txt', Buffer.from('test'));
      await expect(backend.delete('/dir')).rejects.toThrow('Directory not empty');
    });

    it('should throw error when deleting root directory', async () => {
      await expect(backend.delete('/')).rejects.toThrow('Cannot delete root directory');
    });

    it('should throw error when deleting non-existent path', async () => {
      await expect(backend.delete('/non-existent')).rejects.toThrow('Path not found');
    });
  });

  describe('CamaDB-specific features', () => {
    describe('findFiles', () => {
      it('should find files by query', async () => {
        await backend.write('/test1.txt', Buffer.from('content1'));
        await backend.write('/test2.json', Buffer.from('content2'));
        await backend.write('/dir/test3.txt', Buffer.from('content3'));

        const txtFiles = await backend.findFiles({ path: { $regex: /\.txt$/ } });
        
        expect(txtFiles).toHaveLength(2);
        expect(txtFiles.map(f => f.path)).toContain('/test1.txt');
        expect(txtFiles.map(f => f.path)).toContain('/dir/test3.txt');
      });

      it('should find recently modified files', async () => {
        const oldDate = new Date(Date.now() - 86400000); // 1 day ago
        
        await backend.write('/old.txt', Buffer.from('old'));
        // Manually update mtime for testing
        await backend['filesCollection'].updateOne(
          { path: '/old.txt' },
          { $set: { 'metadata.mtime': oldDate } }
        );
        
        await backend.write('/new.txt', Buffer.from('new'));

        const recentFiles = await backend.findFiles({
          'metadata.mtime': { $gte: new Date(Date.now() - 3600000) } // Last hour
        });
        
        expect(recentFiles).toHaveLength(1);
        expect(recentFiles.length).toBeGreaterThan(0);
        expect(recentFiles[0]?.path).toBe('/new.txt');
      });
    });

    describe('tagging', () => {
      it('should tag files', async () => {
        await backend.write('/doc.txt', Buffer.from('document'));
        await backend.tagFile('/doc.txt', ['important', 'work']);

        const doc = await backend.findFiles({ path: '/doc.txt' });
        expect(doc.length).toBeGreaterThan(0);
        expect(doc[0]?.tags).toContain('important');
        expect(doc[0]?.tags).toContain('work');
      });

      it('should find files by tags', async () => {
        await backend.write('/doc1.txt', Buffer.from('1'));
        await backend.write('/doc2.txt', Buffer.from('2'));
        await backend.write('/doc3.txt', Buffer.from('3'));
        
        await backend.tagFile('/doc1.txt', ['important', 'work']);
        await backend.tagFile('/doc2.txt', ['personal']);
        await backend.tagFile('/doc3.txt', ['work', 'draft']);

        const workFiles = await backend.findByTags(['work']);
        
        expect(workFiles).toHaveLength(2);
        expect(workFiles).toContain('/doc1.txt');
        expect(workFiles).toContain('/doc3.txt');
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitBackend = new CamaDBBackend();
      await expect(uninitBackend.read('/test.txt')).rejects.toThrow('not initialized');
    });
  });

  describe('path normalization', () => {
    it('should handle various path formats', async () => {
      const testData = Buffer.from('test');
      
      // All these should write to the same file
      await backend.write('test.txt', testData);
      await backend.write('/test.txt', testData);
      await backend.write('./test.txt', testData);
      
      // All these should read the same file
      const result1 = await backend.read('test.txt');
      const result2 = await backend.read('/test.txt');
      const result3 = await backend.read('./test.txt');
      
      expect(result1).toEqual(testData);
      expect(result2).toEqual(testData);
      expect(result3).toEqual(testData);
    });

    it('should handle trailing slashes', async () => {
      await backend.write('/dir/file.txt', Buffer.from('test'));
      
      const list1 = await backend.list('/dir');
      const list2 = await backend.list('/dir/');
      
      expect(list1).toEqual(list2);
    });
  });
});