import {
  injectionKey,
  InstanceEventArgs,
  isInjectionKey,
  LazyContainer,
  LazyContainerScope
} from '@/index.js';
import { describe, expect, it } from 'vitest';

describe('main', () => {
  it('exports', () => {
    expect.assertions(5);
    expect(LazyContainer).toBeDefined();
    expect(injectionKey).toBeDefined();
    expect(isInjectionKey).toBeDefined();
    expect(LazyContainerScope).toBeDefined();
    expect(InstanceEventArgs).toBeDefined();
  });
});
