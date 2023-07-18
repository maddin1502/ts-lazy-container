import { describe, expect, it } from 'vitest';
import { Example } from '../../src/index.js';

describe('main', () => {
  it('exports', () => {
    expect.assertions(1);
    expect(Example).toBeDefined();
  });
});
