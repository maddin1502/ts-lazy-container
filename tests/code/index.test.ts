import { LazyContainer, injectionKey, isInjectionKey } from '@/index.js';
import { describe, expect, it } from 'vitest';

describe('main', () => {
  it('exports', () => {
    expect.assertions(3);
    expect(LazyContainer).toBeDefined();
    expect(injectionKey).toBeDefined();
    expect(isInjectionKey).toBeDefined();
  });
});
