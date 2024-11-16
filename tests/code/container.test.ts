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
    container.onInjected.subscribe('resolved', () => resolvedCount++);
    container.onCreated.subscribe('constructed', () => constructedCount++);

    container.provideClass(A);
    expect(() => container.provideClass(A)).toThrow();
    expect(() => container.provide(A, () => new A())).toThrow();
    container.inject(A).something = '42';
    expect(resolvedCount).toBe(1);
    expect(constructedCount).toBe(1);
    expect(errorCount).toBe(2);
    expect(container.inject(A).something).toBe('42');
    expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(1);
    container.provideClass(DependsOnA, A);
    container.inject(DependsOnA).a.something = '24';
    expect(resolvedCount).toBe(4);
    expect(constructedCount).toBe(2);
    expect(container.inject(DependsOnA).a.something).toBe('24');
    expect(() => container.inject(NotProvided)).toThrow();
    expect(resolvedCount).toBe(5);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(3);
    container.provideClass(WithSimpleParams, B, 42, [42, 42], () => 84);
    expect(() => container.inject(WithSimpleParams)).toThrow();
    expect(errorCount).toBe(4);
    container.provideClass(B);
    expect(container.inject(WithSimpleParams).valueParam).toBe(42);
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
    container.onInjected.subscribe('resolved', () => resolvedCount++);
    container.onCreated.subscribe('constructed', () => constructedCount++);

    container.provideClass(A);
    const ik = injectionKey<AT>('at key');
    container.provide(ik, A);
    expect(() => container.provide(ik, A)).toThrow();
    expect(() => container.provide(ik, () => new A())).toThrow();
    container.inject(ik).something = '42';
    expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(2);
    expect(container.inject(ik).something).toBe('42');
    expect(resolvedCount).toBe(3);
    expect(constructedCount).toBe(2);
    container.provideClass(DependsOnA, ik);
    container.inject(DependsOnA).a.something = '24';
    expect(resolvedCount).toBe(5);
    expect(constructedCount).toBe(3);
    expect(container.inject(DependsOnA).a.something).toBe('24');
  });

  it('presolve', () => {
    expect.assertions(15);
    const container = LazyContainer.Create();
    let errorCount = 0;
    let resolvedCount = 0;
    let constructedCount = 0;
    container.onError.subscribe('error', () => errorCount++);
    container.onInjected.subscribe('resolved', () => resolvedCount++);
    container.onCreated.subscribe('constructed', () => constructedCount++);

    container.provideClass(DependsOnA, A);
    expect(() => container.presolve()).toThrow();
    expect(resolvedCount).toBe(0);
    expect(constructedCount).toBe(0);
    expect(errorCount).toBe(1);
    container.provideClass(A);
    container.presolve();
    expect(resolvedCount).toBe(3);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(1);
    container.presolve();
    expect(resolvedCount).toBe(5);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(1);
    container.provideClass(WithSimpleParams, B, 42, [42, 42], () => 84);
    expect(() => container.presolve()).toThrow();
    // expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(2);
    container.provideClass(B);
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
    container.onInjected.subscribe('resolved', () => resolvedCount++);
    container.onCreated.subscribe('constructed', () => constructedCount++);

    container.provideClass(B);
    container.provideClass(WithSimpleParams, B, 42, [42, 42], () => 84);
    expect(container.inject(WithSimpleParams).valueParam).toBe(42);
    expect(container.inject(WithSimpleParams).arrayParam).toEqual([42, 42]);
    expect(container.inject(WithSimpleParams).functionParam()).toBe(84);
    expect(() =>
      container.scope(1).isolated.inject(WithSimpleParams)
    ).toThrow();
    container.scope(1).isolated.provideClass(B);
    expect(() =>
      container.scope(1).isolated.inject(WithSimpleParams)
    ).toThrow();
    container
      .scope(1)
      .isolated.provideClass(WithSimpleParams, B, 4242, [4242, 4242], () => 8484);
    expect(container.inject(WithSimpleParams).valueParam).toBe(42);
    expect(container.inject(WithSimpleParams).arrayParam).toEqual([42, 42]);
    expect(container.inject(WithSimpleParams).functionParam()).toBe(84);
    expect(
      container.scope(1).isolated.inject(WithSimpleParams).valueParam
    ).toBe(4242);
    expect(
      container.scope(1).isolated.inject(WithSimpleParams).arrayParam
    ).toEqual([4242, 4242]);
    expect(
      container.scope(1).isolated.inject(WithSimpleParams).functionParam()
    ).toBe(8484);

    expect(() =>
      container.scope(1).isolated.scope(1).isolated.inject(WithSimpleParams)
    );
    container.scope(1).isolated.scope(1).isolated.provideClass(B);
    expect(() =>
      container.scope(1).isolated.scope(1).isolated.inject(WithSimpleParams)
    );
    container
      .scope(1)
      .isolated.scope(1)
      .isolated.provideClass(
        WithSimpleParams,
        B,
        424242,
        [424242, 424242],
        () => 848484
      );
    expect(container.inject(WithSimpleParams).valueParam).toBe(42);
    expect(container.inject(WithSimpleParams).arrayParam).toEqual([42, 42]);
    expect(container.inject(WithSimpleParams).functionParam()).toBe(84);
    expect(
      container.scope(1).isolated.inject(WithSimpleParams).valueParam
    ).toBe(4242);
    expect(
      container.scope(1).isolated.inject(WithSimpleParams).arrayParam
    ).toEqual([4242, 4242]);
    expect(
      container.scope(1).isolated.inject(WithSimpleParams).functionParam()
    ).toBe(8484);
    expect(
      container.scope(1).isolated.scope(1).isolated.inject(WithSimpleParams)
        .valueParam
    ).toBe(424242);
    expect(
      container.scope(1).isolated.scope(1).isolated.inject(WithSimpleParams)
        .arrayParam
    ).toEqual([424242, 424242]);
    expect(
      container
        .scope(1)
        .isolated.scope(1)
        .isolated.inject(WithSimpleParams)
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
    container.onInjected.subscribe('resolved', () => resolvedCount++);
    container.onCreated.subscribe('constructed', () => constructedCount++);

    expect(() =>
      container.scope(1).inherited.inject(WithSimpleParams)
    ).toThrow();
    container.provideClass(B);
    expect(() =>
      container.scope(1).inherited.inject(WithSimpleParams)
    ).toThrow();
    container.provideClass(WithSimpleParams, B, 42, [42, 42], () => 84);
    const c0 = container.inject(WithSimpleParams);
    const c1 = container.scope(1).inherited.inject(WithSimpleParams);
    expect(c0).toBe(c1); // both got resolved from root container
    expect(c0.b).toBe(c1.b); // both b's got resolved from root container
    expect(c1.valueParam).toBe(42);
    expect(c1.arrayParam).toEqual([42, 42]);
    expect(c1.functionParam()).toBe(84);
    container
      .scope(1)
      .inherited.provideClass(WithSimpleParams, B, 4242, [4242, 4242], () => 8484);

    const c0v2 = container.inject(WithSimpleParams);
    const c1v2 = container.scope(1).inherited.inject(WithSimpleParams);
    expect(c0v2).not.toBe(c1v2); // c0v2 got resolved from root container; c1v2 got resolved from scope
    expect(c0v2.b).toBe(c1v2.b); // B is still not provided in scope container so both b's are from root container
    expect(c1v2.valueParam).toBe(4242);
    expect(c1v2.arrayParam).toEqual([4242, 4242]);
    expect(c1v2.functionParam()).toBe(8484);

    container.scope(1).inherited.provideClass(B);

    const c0v3 = container.inject(WithSimpleParams);
    const c1v3 = container.scope(1).inherited.inject(WithSimpleParams);

    expect(c0v2).toBe(c0v3); // same instance
    expect(c1v2).toBe(c1v3); // same instance; WithSimpleParams is already cached as singleton in scoped container (with b from root container). So providing B to scoped container has no effect

    container.removeSingleton(WithSimpleParams);
    const c0v3Flushed = container.inject(WithSimpleParams);

    expect(c0v3).not.toBe(c0v3Flushed); // cache got flushed so a new instance was created
    expect(c1v3).toBe(container.scope(1).inherited.inject(WithSimpleParams)); // scope 1 cache wasn't flushed
    expect(c0v3Flushed.b).toBe(container.inject(B)); // new instance got B from scoped container

    container.removeSingleton(WithSimpleParams, true);
    expect(c0v3Flushed).not.toBe(container.inject(WithSimpleParams)); // cache got flushed so a new instance was created
    expect(c1v3).not.toBe(
      container.scope(1).inherited.inject(WithSimpleParams)
    ); // scope 1 cache got flushed so a new instance was created
  });

  it('dispose', () => {
    expect.assertions(15);
    const container = LazyContainer.Create();
    const testScope = container.scope('test').inherited;
    expect(container.isDisposed).toBe(false);
    expect(testScope.isDisposed).toBe(false);
    container.dispose();
    expect(container.isDisposed).toBe(true);
    expect(testScope.isDisposed).toBe(true);
    expect(() => container.clearSingletons()).toThrow('Instance is disposed!');
    expect(() => container.removeSingleton(A)).toThrow('Instance is disposed!');
    expect(() => container.onError.subscribe('', () => {})).toThrow(
      'Instance is disposed!'
    );
    expect(() => container.onInjected.subscribe('', () => {})).toThrow(
      'Instance is disposed!'
    );
    expect(() => container.onCreated.subscribe('', () => {})).toThrow(
      'Instance is disposed!'
    );
    expect(() => container.scope('').inherited).toThrow(
      'Instance is disposed!'
    );
    expect(() => container.scope('').isolated).toThrow('Instance is disposed!');
    expect(() => container.provide(A, () => new A())).toThrow(
      'Instance is disposed!'
    );
    expect(() => container.presolve()).toThrow('Instance is disposed!');
    expect(() => container.provideClass(A)).toThrow('Instance is disposed!');
    expect(() => container.inject(A)).toThrow('Instance is disposed!');
  });

  it('clearSingletons', () => {
    expect.assertions(6);
    const container = LazyContainer.Create();
    container.provideClass(A);
    container.scope(1).isolated.provideClass(A);
    container.scope(1).inherited.provideClass(A);
    const c0A = container.inject(A);
    const c1IsoA = container.scope(1).isolated.inject(A);
    const c1InhA = container.scope(1).inherited.inject(A);
    container.clearSingletons();
    expect(container.inject(A)).not.toBe(c0A);
    expect(container.scope(1).inherited.inject(A)).toBe(c1InhA);
    expect(container.scope(1).isolated.inject(A)).toBe(c1IsoA);
    container.clearSingletons(true);
    expect(container.inject(A)).not.toBe(c0A);
    expect(container.scope(1).inherited.inject(A)).not.toBe(c1InhA);
    expect(container.scope(1).isolated.inject(A)).not.toBe(c1IsoA);
  });

  it('resolve mode', () => {
    expect.assertions(12);
    const container = LazyContainer.Create();

    container.provideClass(A);
    container.provideClass(DependsOnA, A);

    const c0DoA = container.inject(DependsOnA);
    const c0DoAu = container.inject(DependsOnA, 'unique');
    const c0DoAdu = container.inject(DependsOnA, 'deep-unique');

    expect(c0DoA).not.toBe(c0DoAu);
    expect(c0DoA).not.toBe(c0DoAdu);
    expect(c0DoAu).not.toBe(c0DoAdu);

    expect(c0DoA.a).toBe(c0DoAu.a);
    expect(c0DoA.a).not.toBe(c0DoAdu.a);
    expect(c0DoAu.a).not.toBe(c0DoAdu.a);

    const c0s0DoAu1 = container
      .scope('scope')
      .inherited.inject(DependsOnA, 'unique');
    const c0s0DoAu2 = container
      .scope('scope')
      .inherited.inject(DependsOnA, 'unique');
    expect(c0DoA).not.toBe(c0s0DoAu1);
    expect(c0DoA).not.toBe(c0s0DoAu2);
    expect(c0s0DoAu1.a).toBe(c0s0DoAu2.a);

    const c0s0DoAdu1 = container
      .scope('scope')
      .inherited.inject(DependsOnA, 'deep-unique');
    const c0s0DoAdu2 = container
      .scope('scope')
      .inherited.inject(DependsOnA, 'deep-unique');
    expect(c0DoA).not.toBe(c0s0DoAdu1);
    expect(c0DoA).not.toBe(c0s0DoAdu2);
    expect(c0s0DoAdu1.a).not.toBe(c0s0DoAdu2.a);
  });
});
