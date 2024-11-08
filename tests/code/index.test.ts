import {
  injectionKey,
  isInjectionKey,
  LazyContainer,
  LazyContainerScope,
  ScopedLazyContainer
} from '@/index.js';
import { describe, expect, it } from 'vitest';

describe('main', () => {
  it('exports', () => {
    expect.assertions(5);
    expect(LazyContainer).toBeDefined();
    expect(injectionKey).toBeDefined();
    expect(isInjectionKey).toBeDefined();
    expect(LazyContainerScope).toBeDefined();
    expect(ScopedLazyContainer).toBeDefined();
  });
});
