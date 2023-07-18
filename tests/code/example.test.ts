import { describe, expect, it } from 'vitest';
import { Example } from '../../src/example.js';

describe(Example.name, () => {
  it('value', () => {
    expect.assertions(1);
    const instance = new Example(42);
    expect(instance.value).toBe(42);
  });
});
