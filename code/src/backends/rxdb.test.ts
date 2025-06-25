/**
 * Tests for RxDB storage backend
 */

import { RxDBBackend } from './rxdb';

describe('RxDBBackend', () => {
  let backend: RxDBBackend;

  beforeEach(async () => {
    backend = new RxDBBackend({ inMemory: true });
    await backend.initialize();
  });

  afterEach(async () => {
    await backend.cleanup();
  });

  describe('File Operations', () => {
    it('should write and read a file', async () => {
      const path = '/test.txt';
      const content = Buffer.from('Hello, RxDB!');

      await backend.write(path, content);
      const result = await backend.read(path);

      expect(result).toEqual(content);
    });

    it('should throw error when reading non-existent file', async () => {
      await expect(backend.read('/non-existent.txt')).rejects.toThrow('File not found');
    });

    it('should check file existence', async () => {
      const path = '/exists.txt';
      const content = Buffer.from('I exist');

      expect(await backend.exists(path)).toBe(false);
      
      await backend.write(path, content);
      
      expect(await backend.exists(path)).toBe(true);
    });

    it('should get file stats', async () => {
      const path = '/stats.txt';
      const content = Buffer.from('File with stats');

      await backend.write(path, content);
      const stats = await backend.stat(path);

      expect(stats.path).toBe(path);
      expect(stats.size).toBe(content.length);
      expect(stats.isDirectory).toBe(false);
      expect(stats.permissions).toBe(0o644);
      expect(stats.mtime).toBeInstanceOf(Date);
    });

    it('should overwrite existing files', async () => {
      const path = '/overwrite.txt';
      const content1 = Buffer.from('Original content');
      const content2 = Buffer.from('New content');

      await backend.write(path, content1);
      await backend.write(path, content2);
      
      const result = await backend.read(path);
      expect(result).toEqual(content2);
    });

    it('should delete files', async () => {
      const path = '/delete.txt';
      const content = Buffer.from('To be deleted');

      await backend.write(path, content);
      expect(await backend.exists(path)).toBe(true);

      await backend.delete(path);
      expect(await backend.exists(path)).toBe(false);
    });

    it('should throw error when deleting non-existent file', async () => {
      await expect(backend.delete('/non-existent.txt')).rejects.toThrow('File not found');
    });
  });

  describe('Directory Operations', () => {
    it('should list directory contents', async () => {
      // Create files in a directory
      await backend.write('/dir/file1.txt', Buffer.from('File 1'));
      await backend.write('/dir/file2.txt', Buffer.from('File 2'));
      await backend.write('/dir/subdir/file3.txt', Buffer.from('File 3'));
      await backend.write('/other/file4.txt', Buffer.from('File 4'));

      const contents = await backend.list('/dir');
      
      expect(contents).toHaveLength(2);
      expect(contents).toContain('file1.txt');
      expect(contents).toContain('file2.txt');
      expect(contents).not.toContain('file3.txt'); // In subdirectory
      expect(contents).not.toContain('file4.txt'); // In different directory
    });

    it('should return empty array for empty directory', async () => {
      const contents = await backend.list('/empty');
      expect(contents).toEqual([]);
    });

    it('should handle trailing slashes in directory paths', async () => {
      await backend.write('/dir/file1.txt', Buffer.from('File 1'));
      await backend.write('/dir/file2.txt', Buffer.from('File 2'));

      const contents1 = await backend.list('/dir');
      const contents2 = await backend.list('/dir/');

      expect(contents1).toEqual(contents2);
    });
  });

  describe('Binary Data', () => {
    it('should handle binary data correctly', async () => {
      const path = '/binary.dat';
      // Create binary data with various byte values
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFE, 0xFF]);

      await backend.write(path, binaryData);
      const result = await backend.read(path);

      expect(result).toEqual(binaryData);
    });

    it('should preserve large files', async () => {
      const path = '/large.bin';
      // Create a 1MB buffer
      const largeData = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      await backend.write(path, largeData);
      const result = await backend.read(path);

      expect(result).toEqual(largeData);
      expect(result.length).toBe(1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when database not initialized', async () => {
      const uninitializedBackend = new RxDBBackend();
      
      await expect(uninitializedBackend.read('/test.txt')).rejects.toThrow('Database not initialized');
      await expect(uninitializedBackend.write('/test.txt', Buffer.from('test'))).rejects.toThrow('Database not initialized');
      await expect(uninitializedBackend.exists('/test.txt')).rejects.toThrow('Database not initialized');
      await expect(uninitializedBackend.stat('/test.txt')).rejects.toThrow('Database not initialized');
      await expect(uninitializedBackend.list('/')).rejects.toThrow('Database not initialized');
      await expect(uninitializedBackend.delete('/test.txt')).rejects.toThrow('Database not initialized');
    });
  });

  describe('Advanced Features', () => {
    it('should provide access to RxDB database', () => {
      const db = backend.getDatabase();
      expect(db).toBeDefined();
      expect(db?.files).toBeDefined();
    });

    it('should create indexes', async () => {
      await expect(backend.createIndexes()).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle many files efficiently', async () => {
      const fileCount = 100;
      const startTime = Date.now();

      // Write many files
      for (let i = 0; i < fileCount; i++) {
        await backend.write(`/perf/file${i}.txt`, Buffer.from(`Content ${i}`));
      }

      // List directory
      const contents = await backend.list('/perf');
      expect(contents).toHaveLength(fileCount);

      const duration = Date.now() - startTime;
      // Should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });
});