import { LazyContainer } from '@/index.js';
import { describe, expect, test } from 'vitest';

class A {}
class B {
  constructor(public a: A, public text: string) {}
}

const container = LazyContainer.Create();
container.provide(A);
container.provide(B, A, 'hello world');

const b = container.resolve(B);

describe(LazyContainer, () => {
  test('provide', () => {
    expect.assertions(2);
    expect(b.a).instanceOf(A);
    expect(b.text).toBe('hello world');
  });
});
