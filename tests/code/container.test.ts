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

class B {
  otherthing: number | undefined;
}

class WithSimpleParam {
  constructor(private _b: B, public readonly value: number) {}

  public get b() {
    return this._b;
  }
}

class NotProvided {
  something = NaN;
}

describe(LazyContainer.name, () => {
  it('injection', () => {
    expect.assertions(20);
    const container = new LazyContainer();
    let errorCount = 0;
    let resolvedCount = 0;
    let constructedCount = 0;
    container.onError.subscribe('error', () => errorCount++);
    container.onResolved.subscribe('resolved', () => resolvedCount++);
    container.onConstructed.subscribe('constructed', () => constructedCount++);

    container.provide(A);
    expect(() => container.provide(A)).toThrow();
    expect(() => container.instruct(A, () => new A())).toThrow();
    container.resolve(A).something = '42';
    expect(resolvedCount).toBe(1);
    expect(constructedCount).toBe(1);
    expect(errorCount).toBe(2);
    expect(container.resolve(A).something).toBe('42');
    expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(1);
    container.provide(DependsOnA, A);
    container.resolve(DependsOnA).a.something = '24';
    expect(resolvedCount).toBe(4);
    expect(constructedCount).toBe(2);
    expect(container.resolve(DependsOnA).a.something).toBe('24');
    expect(() => container.resolve(NotProvided)).toThrow();
    expect(resolvedCount).toBe(5);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(3);
    container.provide(WithSimpleParam, B, 42);
    expect(() => container.resolve(WithSimpleParam)).toThrow();
    expect(errorCount).toBe(4);
    container.provide(B);
    expect(container.resolve(WithSimpleParam).value).toBe(42);
    expect(resolvedCount).toBe(7);
    expect(constructedCount).toBe(4);
  });

  it('presolve', () => {
    expect.assertions(17);
    const container = new LazyContainer();
    let errorCount = 0;
    let resolvedCount = 0;
    let constructedCount = 0;
    container.onError.subscribe('error', () => errorCount++);
    container.onResolved.subscribe('resolved', () => resolvedCount++);
    container.onConstructed.subscribe('constructed', () => constructedCount++);

    container.provide(DependsOnA, A);
    expect(() => container.presolve()).toThrow();
    expect(resolvedCount).toBe(0);
    expect(constructedCount).toBe(0);
    expect(errorCount).toBe(1);
    container.provide(A);
    container.presolve();
    expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(1);
    container.presolve();
    expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(1);
    container.provide(WithSimpleParam, B, 42);
    expect(() => container.presolve()).toThrow();
    expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(2);
    container.provide(B);
    container.presolve();
    expect(resolvedCount).toBe(4);
    expect(constructedCount).toBe(4);
    expect(errorCount).toBe(2);
  });
});
