/**
 * FileSystem Mock - 统一模拟文件系统
 */

import { vi, type Mock } from 'vitest';

export interface FsMock {
  mkdir: Mock;
  readFile: Mock;
  writeFile: Mock;
  unlink: Mock;
  readdir: Mock;
  rmdir: Mock;
  stat: Mock;
}

export const createFsMock = (): FsMock => {
  const mocks: FsMock = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    rmdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
  };

  vi.mock('node:fs/promises', () => ({
    default: mocks,
  }));

  return mocks;
};

export const createFsMockWithFiles = (files: Record<string, string>): FsMock => {
  const mocks: FsMock = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn((path: string) => {
      if (path in files) return Promise.resolve(files[path]);
      return Promise.reject(new Error('ENOENT'));
    }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue(Object.keys(files)),
    rmdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn((path: string) => {
      if (path in files) {
        return Promise.resolve({ isFile: () => true, isDirectory: () => false });
      }
      return Promise.reject(new Error('ENOENT'));
    }),
  };

  vi.mock('node:fs/promises', () => ({
    default: mocks,
  }));

  return mocks;
};

export const createFsMockWithDirs = (dirs: string[]): FsMock => {
  const mocks: FsMock = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn((path: string) => {
      // Return contents for known directories
      if (path === '.' || path === '/') {
        return Promise.resolve(dirs);
      }
      return Promise.resolve([]);
    }),
    rmdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn((path: string) => {
      if (dirs.includes(path)) {
        return Promise.resolve({ isFile: () => false, isDirectory: () => true });
      }
      return Promise.reject(new Error('ENOENT'));
    }),
  };

  vi.mock('node:fs/promises', () => ({
    default: mocks,
  }));

  return mocks;
};

// Mock node:fs sync (if needed)
export const createFsSyncMock = () => {
  vi.mock('node:fs', () => ({
    default: {},
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(''),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
  }));
};
