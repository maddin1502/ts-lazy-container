import { LazyContainer } from '@/index.js';
import { describe, expect, test } from 'vitest';

class A {}
class B {
  constructor(public a: A, public text: string) {}
}

const container = LazyContainer.Create();
container.provideClass(A);
container.provideClass(B, A, 'hello world');

const b = container.inject(B);

describe(LazyContainer, () => {
  test('provide', () => {
    expect.assertions(2);
    expect(b.a).instanceOf(A);
    expect(b.text).toBe('hello world');
  });
});
