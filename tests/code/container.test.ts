import { describe, expect, it } from 'vitest';
import { LazyContainer } from '../../src/container.js';

class A {
  something: string | undefined;
}

class DependsOnA {
  constructor(private _a: A) {}

  public get a() {
    return this._a;
  }
}

class NotProvided {
  something = NaN;
}

describe(LazyContainer.name, () => {
  it('injection', () => {
    expect.assertions(5);
    const container = new LazyContainer();

    container.provide(A);
    expect(() => container.provide(A)).toThrow();
    expect(() => container.instruct(A, () => new A())).toThrow();
    container.resolve(A).something = '42';
    expect(container.resolve(A).something).toBe('42');
    container.provide(DependsOnA, A);
    container.resolve(DependsOnA).a.something = '24';
    expect(container.resolve(DependsOnA).a.something).toBe('24');
    expect(() => container.resolve(NotProvided)).toThrow();
  });
});
