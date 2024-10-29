import { LazyContainer } from '@/container.js';
import { injectionKey } from '@/injectionKey.js';
import { describe, expect, it } from 'vitest';

type AT = {
  something: string | undefined;
};

class A implements AT {
  something: string | undefined;
}

class DependsOnA {
  constructor(private _a: AT) {}

  public get a() {
    return this._a;
  }
}

class B {
  otherthing: number | undefined;
}

class WithSimpleParams {
  constructor(
    private _b: B,
    public readonly valueParam: number,
    public readonly arrayParam: number[],
    public readonly functionParam: () => number
  ) {}

  public get b() {
    return this._b;
  }
}

class NotProvided {
  something = NaN;
}

describe(LazyContainer, () => {
  it('injection', () => {
    expect.assertions(20);
    const container = LazyContainer.Create();
    let errorCount = 0;
    let resolvedCount = 0;
    let constructedCount = 0;
    container.onError.subscribe('error', () => errorCount++);
    container.onResolved.subscribe('resolved', () => resolvedCount++);
    container.onConstructed.subscribe('constructed', () => constructedCount++);

    container.provide(A);
    expect(() => container.provide(A)).toThrow();
    expect(() => container.provideInstruction(A, () => new A())).toThrow();
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
    container.provide(WithSimpleParams, B, 42, [42, 42], () => 84);
    expect(() => container.resolve(WithSimpleParams)).toThrow();
    expect(errorCount).toBe(4);
    container.provide(B);
    expect(container.resolve(WithSimpleParams).valueParam).toBe(42);
    expect(resolvedCount).toBe(7);
    expect(constructedCount).toBe(4);
  });

  it('injection key', () => {
    expect.assertions(11);
    const container = LazyContainer.Create();
    let errorCount = 0;
    let resolvedCount = 0;
    let constructedCount = 0;
    container.onError.subscribe('error', () => errorCount++);
    container.onResolved.subscribe('resolved', () => resolvedCount++);
    container.onConstructed.subscribe('constructed', () => constructedCount++);

    container.provide(A);
    const ik = injectionKey<AT>('at key');
    container.provideKey(ik, A);
    expect(() => container.provideKey(ik, A)).toThrow();
    expect(() => container.provideInstruction(ik, () => new A())).toThrow();
    container.resolve(ik).something = '42';
    expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(2);
    expect(container.resolve(ik).something).toBe('42');
    expect(resolvedCount).toBe(3);
    expect(constructedCount).toBe(2);
    container.provide(DependsOnA, ik);
    container.resolve(DependsOnA).a.something = '24';
    expect(resolvedCount).toBe(5);
    expect(constructedCount).toBe(3);
    expect(container.resolve(DependsOnA).a.something).toBe('24');
  });

  it('presolve', () => {
    expect.assertions(15);
    const container = LazyContainer.Create();
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
    expect(resolvedCount).toBe(3);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(1);
    container.presolve();
    expect(resolvedCount).toBe(5);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(1);
    container.provide(WithSimpleParams, B, 42, [42, 42], () => 84);
    expect(() => container.presolve()).toThrow();
    // expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(2);
    container.provide(B);
    container.presolve();
    // expect(resolvedCount).toBe(4);
    expect(constructedCount).toBe(4);
    expect(errorCount).toBe(2);
  });

  it('isolatedScope', () => {
    expect.assertions(22);
    const container = LazyContainer.Create();
    let errorCount = 0;
    let resolvedCount = 0;
    let constructedCount = 0;
    container.onError.subscribe('error', () => errorCount++);
    container.onResolved.subscribe('resolved', () => resolvedCount++);
    container.onConstructed.subscribe('constructed', () => constructedCount++);

    container.provide(B);
    container.provide(WithSimpleParams, B, 42, [42, 42], () => 84);
    expect(container.resolve(WithSimpleParams).valueParam).toBe(42);
    expect(container.resolve(WithSimpleParams).arrayParam).toEqual([42, 42]);
    expect(container.resolve(WithSimpleParams).functionParam()).toBe(84);
    expect(() =>
      container.isolatedScope('1').resolve(WithSimpleParams)
    ).toThrow();
    container.isolatedScope('1').provide(B);
    expect(() =>
      container.isolatedScope('1').resolve(WithSimpleParams)
    ).toThrow();
    container
      .isolatedScope('1')
      .provide(WithSimpleParams, B, 4242, [4242, 4242], () => 8484);
    expect(container.resolve(WithSimpleParams).valueParam).toBe(42);
    expect(container.resolve(WithSimpleParams).arrayParam).toEqual([42, 42]);
    expect(container.resolve(WithSimpleParams).functionParam()).toBe(84);
    expect(
      container.isolatedScope('1').resolve(WithSimpleParams).valueParam
    ).toBe(4242);
    expect(
      container.isolatedScope('1').resolve(WithSimpleParams).arrayParam
    ).toEqual([4242, 4242]);
    expect(
      container.isolatedScope('1').resolve(WithSimpleParams).functionParam()
    ).toBe(8484);

    expect(() =>
      container.isolatedScope('1').isolatedScope('1').resolve(WithSimpleParams)
    );
    container.isolatedScope('1').isolatedScope('1').provide(B);
    expect(() =>
      container.isolatedScope('1').isolatedScope('1').resolve(WithSimpleParams)
    );
    container
      .isolatedScope('1')
      .isolatedScope('1')
      .provide(WithSimpleParams, B, 424242, [424242, 424242], () => 848484);
    expect(container.resolve(WithSimpleParams).valueParam).toBe(42);
    expect(container.resolve(WithSimpleParams).arrayParam).toEqual([42, 42]);
    expect(container.resolve(WithSimpleParams).functionParam()).toBe(84);
    expect(
      container.isolatedScope('1').resolve(WithSimpleParams).valueParam
    ).toBe(4242);
    expect(
      container.isolatedScope('1').resolve(WithSimpleParams).arrayParam
    ).toEqual([4242, 4242]);
    expect(
      container.isolatedScope('1').resolve(WithSimpleParams).functionParam()
    ).toBe(8484);
    expect(
      container.isolatedScope('1').isolatedScope('1').resolve(WithSimpleParams)
        .valueParam
    ).toBe(424242);
    expect(
      container.isolatedScope('1').isolatedScope('1').resolve(WithSimpleParams)
        .arrayParam
    ).toEqual([424242, 424242]);
    expect(
      container
        .isolatedScope('1')
        .isolatedScope('1')
        .resolve(WithSimpleParams)
        .functionParam()
    ).toBe(848484);
  });

  it('inheritedScope', () => {
    expect.assertions(19);
    const container = LazyContainer.Create();
    let errorCount = 0;
    let resolvedCount = 0;
    let constructedCount = 0;
    container.onError.subscribe('error', () => errorCount++);
    container.onResolved.subscribe('resolved', () => resolvedCount++);
    container.onConstructed.subscribe('constructed', () => constructedCount++);

    expect(() =>
      container.inheritedScope('1').resolve(WithSimpleParams)
    ).toThrow();
    container.provide(B);
    expect(() =>
      container.inheritedScope('1').resolve(WithSimpleParams)
    ).toThrow();
    container.provide(WithSimpleParams, B, 42, [42, 42], () => 84);
    const c0 = container.resolve(WithSimpleParams);
    const c1 = container.inheritedScope('1').resolve(WithSimpleParams);
    expect(c0).toBe(c1); // both got resolved from root container
    expect(c0.b).toBe(c1.b); // both b's got resolved from root container
    expect(c1.valueParam).toBe(42);
    expect(c1.arrayParam).toEqual([42, 42]);
    expect(c1.functionParam()).toBe(84);
    container
      .inheritedScope('1')
      .provide(WithSimpleParams, B, 4242, [4242, 4242], () => 8484);

    const c0v2 = container.resolve(WithSimpleParams);
    const c1v2 = container.inheritedScope('1').resolve(WithSimpleParams);
    expect(c0v2).not.toBe(c1v2); // c0v2 got resolved from root container; c1v2 got resolved from scope
    expect(c0v2.b).toBe(c1v2.b); // B is still not provided in scope container so both b's are from root container
    expect(c1v2.valueParam).toBe(4242);
    expect(c1v2.arrayParam).toEqual([4242, 4242]);
    expect(c1v2.functionParam()).toBe(8484);

    container.inheritedScope('1').provide(B);

    const c0v3 = container.resolve(WithSimpleParams);
    const c1v3 = container.inheritedScope('1').resolve(WithSimpleParams);

    expect(c0v2).toBe(c0v3); // same instance
    expect(c1v2).toBe(c1v3); // same instance; WithSimpleParams is already cached as singleton in scoped container (with b from root container). So providing B to scoped container has no effect

    container.removeSingleton(WithSimpleParams);
    const c0v3Flushed = container.resolve(WithSimpleParams);

    expect(c0v3).not.toBe(c0v3Flushed); // cache got flushed so a new instance was created
    expect(c1v3).toBe(container.inheritedScope('1').resolve(WithSimpleParams)); // scope 1 cache wasn't flushed
    expect(c0v3Flushed.b).toBe(container.resolve(B)); // new instance got B from scoped container

    container.removeSingleton(WithSimpleParams, true);
    expect(c0v3Flushed).not.toBe(container.resolve(WithSimpleParams)); // cache got flushed so a new instance was created
    expect(c1v3).not.toBe(
      container.inheritedScope('1').resolve(WithSimpleParams)
    ); // scope 1 cache got flushed so a new instance was created
  });

  it('dispose', () => {
    expect.assertions(13);
    const container = LazyContainer.Create();
    expect(container.isDisposed).toBe(false);
    container.dispose();
    expect(container.isDisposed).toBe(true);
    expect(() => container.clearSingletons()).toThrow('Instance is disposed!');
    expect(() => container.removeSingleton(A)).toThrow('Instance is disposed!');
    expect(() => container.onError.subscribe('', () => {})).toThrow(
      'Instance is disposed!'
    );
    expect(() => container.onResolved.subscribe('', () => {})).toThrow(
      'Instance is disposed!'
    );
    expect(() => container.onConstructed.subscribe('', () => {})).toThrow(
      'Instance is disposed!'
    );
    expect(() => container.inheritedScope('')).toThrow('Instance is disposed!');
    expect(() => container.isolatedScope('')).toThrow('Instance is disposed!');
    expect(() => container.provideInstruction(A, () => new A())).toThrow(
      'Instance is disposed!'
    );
    expect(() => container.presolve()).toThrow('Instance is disposed!');
    expect(() => container.provide(A)).toThrow('Instance is disposed!');
    expect(() => container.resolve(A)).toThrow('Instance is disposed!');
  });

  it('clearSingletons', () => {
    expect.assertions(6);
    const container = LazyContainer.Create();
    container.provide(A);
    container.isolatedScope('1').provide(A);
    container.inheritedScope('1').provide(A);
    const c0A = container.resolve(A);
    const c1IsoA = container.isolatedScope('1').resolve(A);
    const c1InhA = container.inheritedScope('1').resolve(A);
    container.clearSingletons();
    expect(container.resolve(A)).not.toBe(c0A);
    expect(container.inheritedScope('1').resolve(A)).toBe(c1InhA);
    expect(container.isolatedScope('1').resolve(A)).toBe(c1IsoA);
    container.clearSingletons(true);
    expect(container.resolve(A)).not.toBe(c0A);
    expect(container.inheritedScope('1').resolve(A)).not.toBe(c1InhA);
    expect(container.isolatedScope('1').resolve(A)).not.toBe(c1IsoA);
  });

  it('resolve mode', () => {
    expect.assertions(6);
    const container = LazyContainer.Create();

    container.provide(A);
    container.provide(DependsOnA, A);

    const c0DoA = container.resolve(DependsOnA);
    const c0DoAu = container.resolve(DependsOnA, 'unique');
    const c0DoAdu = container.resolve(DependsOnA, 'deep-unique');

    expect(c0DoA).not.toBe(c0DoAu);
    expect(c0DoA).not.toBe(c0DoAdu);
    expect(c0DoAu).not.toBe(c0DoAdu);

    expect(c0DoA.a).toBe(c0DoAu.a);
    expect(c0DoA.a).not.toBe(c0DoAdu.a);
    expect(c0DoAu.a).not.toBe(c0DoAdu.a);
  });
});
