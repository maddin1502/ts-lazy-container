import { LazyContainer } from '@/index.js';
import { describe, expect, it } from 'vitest';

describe('main', () => {
  it('exports', () => {
    expect.assertions(1);
    expect(LazyContainer).toBeDefined();
  });
});
