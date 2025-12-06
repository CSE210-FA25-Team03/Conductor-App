import 'whatwg-fetch';
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

if (expect && typeof expect.extend === 'function' && matchers) {
  expect.extend(matchers);
}

// Minimal localStorage polyfill for jsdom in Node 25
if (!globalThis.localStorage || typeof globalThis.localStorage.clear !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(String(key), String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}
