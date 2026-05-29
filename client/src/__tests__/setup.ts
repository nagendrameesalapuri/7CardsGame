import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';
import React from 'react';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// Framer Motion — render as plain HTML elements in jsdom
vi.mock('framer-motion', () => {
  const tags = ['div', 'span', 'button', 'ul', 'li', 'p', 'h1', 'h2', 'h3', 'form', 'input', 'svg', 'path'];
  const motion = Object.fromEntries(
    tags.map(tag => [
      tag,
      React.forwardRef(({ children, ...props }: any, ref: any) =>
        React.createElement(tag, { ...props, ref }, children)
      ),
    ])
  );
  return {
    motion,
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() }),
    useMotionValue: (initial: any) => ({ get: () => initial, set: vi.fn() }),
    useSpring: (initial: any) => ({ get: () => initial, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
  };
});

// react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  Toaster: () => null,
}));

// Suppress console.error noise from React in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('Error: Not implemented'))
    ) return;
    originalConsoleError(...args);
  };
});
