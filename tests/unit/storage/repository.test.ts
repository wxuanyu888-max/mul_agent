/**
 * Storage Repository Tests
 *
 * Tests for StorageError, type guards, and related utilities
 */

import { describe, it, expect } from 'vitest';
import {
  StorageError,
  isStorageError,
  createStorageError,
  type StorageErrorCode,
} from '../../../src/storage/repository.js';

describe('StorageError', () => {
  it('should create error with code and message', () => {
    const error = new StorageError('Test error', 'NOT_FOUND');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.name).toBe('StorageError');
  });

  it('should include context information', () => {
    const context = { key: 'value', id: '123' };
    const error = new StorageError('Test error', 'IO_ERROR', context);

    expect(error.context).toEqual(context);
  });

  it('should have all error codes available', () => {
    const errorCodes: StorageErrorCode[] = [
      'NOT_FOUND',
      'ALREADY_EXISTS',
      'VALIDATION_ERROR',
      'IO_ERROR',
      'LOCK_ERROR',
      'UNKNOWN',
    ];

    errorCodes.forEach((code) => {
      const error = new StorageError('Test', code);
      expect(error.code).toBe(code);
    });
  });
});

describe('isStorageError', () => {
  it('should return true for StorageError instance', () => {
    const error = new StorageError('Test', 'NOT_FOUND');
    expect(isStorageError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Test');
    expect(isStorageError(error)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isStorageError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isStorageError(undefined)).toBe(false);
  });

  it('should return false for string', () => {
    expect(isStorageError('error')).toBe(false);
  });

  it('should return false for object without StorageError properties', () => {
    expect(isStorageError({ message: 'test' })).toBe(false);
  });
});

describe('createStorageError', () => {
  it('should create error with specified code', () => {
    const error = createStorageError('NOT_FOUND', 'Entity not found');

    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Entity not found');
  });

  it('should create error with context', () => {
    const error = createStorageError('IO_ERROR', 'Read failed', {
      path: '/data/test.json',
    });

    expect(error.code).toBe('IO_ERROR');
    expect(error.context?.path).toBe('/data/test.json');
  });

  it('should allow calling with all error codes', () => {
    const codes: StorageErrorCode[] = [
      'NOT_FOUND',
      'ALREADY_EXISTS',
      'VALIDATION_ERROR',
      'IO_ERROR',
      'LOCK_ERROR',
      'UNKNOWN',
    ];

    codes.forEach((code) => {
      const error = createStorageError(code, `Error: ${code}`);
      expect(error.code).toBe(code);
    });
  });
});
