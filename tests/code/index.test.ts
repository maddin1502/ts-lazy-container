import {
  injectionKey,
  isInjectionKey,
  LazyContainer,
  Scope,
  Scopes
} from '@/index.js';
import { describe, expect, it } from 'vitest';

describe('main', () => {
  it('exports', () => {
    expect.assertions(5);
    expect(LazyContainer).toBeDefined();
    expect(injectionKey).toBeDefined();
    expect(isInjectionKey).toBeDefined();
    expect(Scope).toBeDefined();
    expect(Scopes).toBeDefined();
  });
});
