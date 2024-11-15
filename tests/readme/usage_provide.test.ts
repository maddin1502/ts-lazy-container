import { injectionKey, LazyContainer } from '@/index.js';
import { describe, expect, test } from 'vitest';

type TypedA = {
  text: string;
  flag: boolean;
  callback: () => void;
};

class A implements TypedA {
  constructor(
    public text: string,
    public flag: boolean,
    public callback: () => void
  ) {}
}

class DependsOnA {
  constructor(public a: TypedA, public list: number[]) {}
}

describe('usage_provide', () => {
  test('V1', () => {
    expect.assertions(1);
    const container = LazyContainer.Create();

    container.provideClass(A, 'hello world', true, () => {});
    container.provideClass(DependsOnA, A, [1, 2, 3, 42]);

    const a = container.resolve(A);
    // => { text: 'hello world'; flag: true; callback: () => {} }
    const doa = container.resolve(DependsOnA);
    // => { a: { text: 'hello world'; flag: true; callback: () => {} }; list: [1, 2, 3, 42] }
    expect(doa.a).toBe(a);
  });
  test('V2', () => {
    expect.assertions(1);
    const container = LazyContainer.Create();

    container.provide(A, () => new A('hello world', true, () => {}));
    container.provideClass(DependsOnA, A, [1, 2, 3, 42]);

    const a = container.resolve(A);
    // => { text: 'hello world'; flag: true; callback: () => {} }
    const doa = container.resolve(DependsOnA);
    // => { a: { text: 'hello world'; flag: true; callback: () => {} }; list: [1, 2, 3, 42] }
    expect(doa.a).toBe(a);
  });
  test('V3', () => {
    expect.assertions(1);
    const container = LazyContainer.Create();

    const aInjectionKey = injectionKey<TypedA>();
    container.provide(
      aInjectionKey,
      () => new A('hello world', true, () => {})
    );
    container.provideClass(DependsOnA, aInjectionKey, [1, 2, 3, 42]);

    const a = container.resolve(aInjectionKey);
    // => { text: 'hello world'; flag: true; callback: () => {} }
    const doa = container.resolve(DependsOnA);
    // => { a: { text: 'hello world'; flag: true; callback: () => {} }; list: [1, 2, 3, 42] }
    expect(doa.a).toBe(a);
  });
  test('V4', () => {
    expect.assertions(1);
    const container = LazyContainer.Create();

    const aInjectionKey = injectionKey<TypedA>();
    container.provide(aInjectionKey, () => ({
      text: 'hello world',
      flag: true,
      callback: () => {}
    }));
    container.provideClass(DependsOnA, aInjectionKey, [1, 2, 3, 42]);

    const a = container.resolve(aInjectionKey);
    // => { text: 'hello world'; flag: true; callback: () => {} }
    const doa = container.resolve(DependsOnA);
    // => { a: { text: 'hello world'; flag: true; callback: () => {} }; list: [1, 2, 3, 42] }
    expect(doa.a).toBe(a);
  });
  test('V5', () => {
    expect.assertions(2);
    const container = LazyContainer.Create();

    const doa1InjectionKey = injectionKey<DependsOnA>();
    const doa2InjectionKey = injectionKey<DependsOnA>();
    container.provideClass(A, 'hello world', true, () => {});
    container.provideClass(DependsOnA, A, [1, 2, 3, 42]);
    container.provide(doa1InjectionKey, DependsOnA);
    container.provide(
      doa2InjectionKey,
      () => new DependsOnA(container.resolve(A), [5, 6, 7])
    );

    const doa1 = container.resolve(doa1InjectionKey);
    // doa1.list => [1, 2, 3, 42]
    const doa2 = container.resolve(doa2InjectionKey);
    // doa2.list => [5, 6, 7]
    expect(doa1).not.toBe(doa2);
    expect(doa1.a).toBe(doa2.a);
  });
});
