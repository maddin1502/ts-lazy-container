import { describe, expect, it } from 'vitest';
import { LazyContainer } from '../../src/index.js';

describe('main', () => {
  it('exports', () => {
    expect.assertions(1);
    expect(LazyContainer).toBeDefined();
  });
});
