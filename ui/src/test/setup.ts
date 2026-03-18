// Test setup file for frontend tests

import '@testing-library/jest-dom';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockVi = (globalThis as any).vi || ((...args: unknown[]) => ({ mockImplementation: () => ({}) }));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockVi.mockImplementation ? mockVi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: mockVi.fn(),
    removeListener: mockVi.fn(),
    addEventListener: mockVi.fn(),
    removeEventListener: mockVi.fn(),
    dispatchEvent: mockVi.fn(),
  })) : (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as unknown as typeof IntersectionObserver;
