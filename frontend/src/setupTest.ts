/**
 * Vitest setup file
 * Loads jest-dom matchers and extends Vitest's expect with custom matchers
 */
import '@testing-library/jest-dom/vitest';

// Augment Vitest's expect with jest-dom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeInTheDocument(): void;
  }
  interface AsymmetricMatchersContaining {
    toBeInTheDocument(): void;
  }
}