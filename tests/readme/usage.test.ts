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

    const a = container.inject(A);
    // => { text: 'hello world'; flag: true; callback: () => {} }
    const doa = container.inject(DependsOnA);
    // => { a: { text: 'hello world'; flag: true; callback: () => {} }; list: [1, 2, 3, 42] }
    expect(doa.a).toBe(a);
  });
  test('V2', () => {
    expect.assertions(1);
    const container = LazyContainer.Create();

    container.provide(A, () => new A('hello world', true, () => {}));
    container.provideClass(DependsOnA, A, [1, 2, 3, 42]);

    const a = container.inject(A);
    // => { text: 'hello world'; flag: true; callback: () => {} }
    const doa = container.inject(DependsOnA);
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

    const a = container.inject(aInjectionKey); // a: TypedA
    // => { text: 'hello world'; flag: true; callback: () => {} }
    const doa = container.inject(DependsOnA);
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

    const a = container.inject(aInjectionKey); // a: TypedA
    // => { text: 'hello world'; flag: true; callback: () => {} }
    const doa = container.inject(DependsOnA);
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
      () => new DependsOnA(container.inject(A), [5, 6, 7])
    );

    const doa1 = container.inject(doa1InjectionKey);
    // doa1.list => [1, 2, 3, 42]
    const doa2 = container.inject(doa2InjectionKey);
    // doa2.list => [5, 6, 7]
    expect(doa1).not.toBe(doa2);
    expect(doa1.a).toBe(doa2.a);
  });
  test('V6', () => {
    expect.assertions(6);
    const container = LazyContainer.Create();

    container.provideClass(A, 'hello world', true, () => {});
    container.provideClass(DependsOnA, A, [1, 2, 3, 42]);

    const doa1 = container.inject(DependsOnA); // defaults to 'singleton'
    const doa2 = container.inject(DependsOnA, 'singleton');
    const doa3 = container.inject(DependsOnA, 'unique');
    const doa4 = container.inject(DependsOnA, 'deep-unique');

    // doa1 === doa2      => true
    // doa1 === doa3      => false
    // doa1 === doa4      => false
    // doa1.a === doa2.a  => true
    // doa1.a === doa3.a  => true
    // doa1.a === doa4.a  => false

    expect(doa1).toBe(doa2);
    expect(doa1).not.toBe(doa3);
    expect(doa1).not.toBe(doa4);
    expect(doa1.a).toBe(doa2.a);
    expect(doa1.a).toBe(doa3.a);
    expect(doa1.a).not.toBe(doa4.a);
  });
  test('V7', () => {
    expect.assertions(10);

    class User {
      constructor(public name: string, public doa: DependsOnA) {}
    }

    const container = LazyContainer.Create();

    container.provideClass(A, 'hello world', true, () => {});
    container.provideClass(DependsOnA, A, [1, 2, 3, 42]);
    container.provideClass(User, 'Jack', DependsOnA);

    const scientistScope = container.scope('scientist').inherited; // can resolve any instance from parent scope
    scientistScope.provideClass(User, 'Daniel', DependsOnA);

    const alienScope = container.scope('alien').isolated; // NO access to parent; need to register dependencies again
    alienScope.provideClass(A, 'hello Chulak', false, () => {});
    alienScope.provideClass(DependsOnA, A, []);
    alienScope.provideClass(User, "Teal'c", DependsOnA);

    const jack = container.inject(User);
    const daniel = scientistScope.inject(User);
    const tealc = alienScope.inject(User);

    // jack === daniel              => false
    // jack === tealc               => false
    // jack.name                    => Jack
    // daniel.name                  => Daniel
    // tealc.name                   => Teal'c
    // jack.doa === daniel.doa      => true
    // jack.doa === tealc.doa       => false
    // jack.doa.a.text              => hello world
    // daniel.doa.a.text            => hello world
    // tealc.doa.a.text             => hello Chulak

    expect(jack).not.toBe(daniel);
    expect(jack).not.toBe(tealc);
    expect(jack.name).toBe('Jack');
    expect(daniel.name).toBe('Daniel');
    expect(tealc.name).toBe("Teal'c");
    expect(jack.doa).toBe(daniel.doa);
    expect(jack.doa).not.toBe(tealc.doa);
    expect(jack.doa.a.text).toBe('hello world');
    expect(daniel.doa.a.text).toBe('hello world');
    expect(tealc.doa.a.text).toBe('hello Chulak');
  });
});
