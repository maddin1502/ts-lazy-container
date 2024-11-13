import { injectionKey, isInjectionKey } from '@/injectionKey.js';
import '@/types.js';
import { describe, expect, test } from 'vitest';

describe('injectionkey', () => {
  test('general', () => {
    expect.assertions(2)
    const ik = injectionKey();
    const fake = Symbol();

    expect(isInjectionKey(ik)).toBe(true);
    expect(isInjectionKey(fake)).toBe(false);
  });
});
