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

    container.provide(A);
    expect(() => container.provide(A)).toThrow();
    expect(() => container.provide(A, () => new A())).toThrow();
    container.inject(A).something = '42';
    expect(resolvedCount).toBe(1);
    expect(constructedCount).toBe(1);
    expect(errorCount).toBe(2);
    expect(container.inject(A).something).toBe('42');
    expect(resolvedCount).toBe(2);
    expect(constructedCount).toBe(1);
    container.provide(DependsOnA, A);
    container.inject(DependsOnA).a.something = '24';
    expect(resolvedCount).toBe(4);
    expect(constructedCount).toBe(2);
    expect(container.inject(DependsOnA).a.something).toBe('24');
    expect(() => container.inject(NotProvided)).toThrow();
    expect(resolvedCount).toBe(5);
    expect(constructedCount).toBe(2);
    expect(errorCount).toBe(3);
    container.provide(WithSimpleParams, B, 42, [42, 42], () => 84);
    expect(() => container.inject(WithSimpleParams)).toThrow();
    expect(errorCount).toBe(4);
    container.provide(B);
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

    container.provide(A);
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
    container.provide(DependsOnA, ik);
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
    container.onInjected.subscribe('resolved', () => resolvedCount++);
    container.onCreated.subscribe('constructed', () => constructedCount++);

    container.provide(B);
    container.provide(WithSimpleParams, B, 42, [42, 42], () => 84);
    expect(container.inject(WithSimpleParams).valueParam).toBe(42);
    expect(container.inject(WithSimpleParams).arrayParam).toEqual([42, 42]);
    expect(container.inject(WithSimpleParams).functionParam()).toBe(84);
    expect(() =>
      container.scope(1).isolated.inject(WithSimpleParams)
    ).toThrow();
    container.scope(1).isolated.provide(B);
    expect(() =>
      container.scope(1).isolated.inject(WithSimpleParams)
    ).toThrow();
    container
      .scope(1)
      .isolated.provide(WithSimpleParams, B, 4242, [4242, 4242], () => 8484);
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
    container.scope(1).isolated.scope(1).isolated.provide(B);
    expect(() =>
      container.scope(1).isolated.scope(1).isolated.inject(WithSimpleParams)
    );
    container
      .scope(1)
      .isolated.scope(1)
      .isolated.provide(
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
    container.provide(B);
    expect(() =>
      container.scope(1).inherited.inject(WithSimpleParams)
    ).toThrow();
    container.provide(WithSimpleParams, B, 42, [42, 42], () => 84);
    const c0 = container.inject(WithSimpleParams);
    const c1 = container.scope(1).inherited.inject(WithSimpleParams);
    expect(c0).toBe(c1); // both got resolved from root container
    expect(c0.b).toBe(c1.b); // both b's got resolved from root container
    expect(c1.valueParam).toBe(42);
    expect(c1.arrayParam).toEqual([42, 42]);
    expect(c1.functionParam()).toBe(84);
    container
      .scope(1)
      .inherited.provide(WithSimpleParams, B, 4242, [4242, 4242], () => 8484);

    const c0v2 = container.inject(WithSimpleParams);
    const c1v2 = container.scope(1).inherited.inject(WithSimpleParams);
    expect(c0v2).not.toBe(c1v2); // c0v2 got resolved from root container; c1v2 got resolved from scope
    expect(c0v2.b).toBe(c1v2.b); // B is still not provided in scope container so both b's are from root container
    expect(c1v2.valueParam).toBe(4242);
    expect(c1v2.arrayParam).toEqual([4242, 4242]);
    expect(c1v2.functionParam()).toBe(8484);

    container.scope(1).inherited.provide(B);

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
    expect(() => container.provide(A)).toThrow('Instance is disposed!');
    expect(() => container.inject(A)).toThrow('Instance is disposed!');
  });

  it('clearSingletons', () => {
    expect.assertions(6);
    const container = LazyContainer.Create();
    container.provide(A);
    container.scope(1).isolated.provide(A);
    container.scope(1).inherited.provide(A);
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

    container.provide(A);
    container.provide(DependsOnA, A);

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

  it('unique injection must not pollute singleton cache', () => {
    expect.assertions(3);
    const container = LazyContainer.Create();

    container.provide(A);

    const singletonBefore = container.inject(A);
    const unique = container.inject(A, 'unique');
    const singletonAfter = container.inject(A, 'singleton');

    expect(unique).not.toBe(singletonBefore);
    expect(singletonAfter).toBe(singletonBefore);
    expect(singletonAfter).not.toBe(unique);
  });

  it('regular function resolver is not mistaken for an identifier', () => {
    expect.assertions(2);
    const container = LazyContainer.Create();

    // a non-arrow function instruction must be treated as a resolver callback,
    // not as a (class) identifier to delegate to
    container.provide(A, function () {
      const a = new A();
      a.something = 'from function resolver';
      return a;
    });

    const a = container.inject(A);
    expect(a).toBeInstanceOf(A);
    expect(a.something).toBe('from function resolver');
  });

  it('provide unifies construction, creation callbacks and delegation', () => {
    expect.assertions(6);
    const container = LazyContainer.Create();

    class Constructed {
      constructor(public value: string) {}
    }
    class ViaCallback {
      constructor(public value: string) {}
    }

    container.provide(A);
    expect(container.inject(A)).toBeInstanceOf(A);

    container.provide(DependsOnA, A);
    expect(container.inject(DependsOnA).a).toBe(container.inject(A));

    container.provide(Constructed, 'constructed');
    expect(container.inject(Constructed).value).toBe('constructed');

    container.provide(ViaCallback, () => new ViaCallback('callback'));
    expect(container.inject(ViaCallback).value).toBe('callback');

    const atKey = injectionKey<AT>('at');
    container.provide(atKey, A);
    expect(container.inject(atKey)).toBe(container.inject(A));

    const atKey2 = injectionKey<AT>('at2');
    container.provide(atKey2, () => ({ something: 'literal' }));
    expect(container.inject(atKey2).something).toBe('literal');
  });

  it('circular dependency detection', () => {
    expect.assertions(4);
    const container = LazyContainer.Create();

    class Chicken {
      constructor(public egg: Egg) {}
    }
    class Egg {
      constructor(public chicken: Chicken) {}
    }

    let errorCount = 0;
    container.onError.subscribe('error', () => errorCount++);

    container.provide(Chicken, Egg);
    container.provide(Egg, Chicken);

    expect(() => container.inject(Chicken)).toThrow(/circular dependency/);
    expect(errorCount).toBe(1);
    expect(() => container.inject(Egg)).toThrow(/circular dependency/);
    expect(errorCount).toBe(2);
  });

  it('presolve cascades into scope instances', () => {
    expect.assertions(2);
    const container = LazyContainer.Create();
    const scope = container.scope('s').inherited;

    let scopeCreated = 0;
    scope.onCreated.subscribe('created', () => scopeCreated++);
    scope.provide(B);

    container.presolve();
    expect(scopeCreated).toBe(1);
    expect(scope.inject(B)).toBeInstanceOf(B);
  });

  it('provide throws for a non-class identifier without a valid instruction', () => {
    expect.assertions(1);
    const container = LazyContainer.Create();
    const key = injectionKey<number>('number');

    const untyped = container as unknown as {
      provide(identifier_: unknown, ...args_: unknown[]): void;
    };

    expect(() => untyped.provide(key, 42)).toThrow(/no valid instruction/);
  });

  it('has and tryInject', () => {
    expect.assertions(6);
    const container = LazyContainer.Create();
    container.provide(A);

    expect(container.has(A)).toBe(true);
    expect(container.has(B)).toBe(false);
    expect(container.tryInject(A)).toBeInstanceOf(A);
    expect(container.tryInject(B)).toBeUndefined();

    expect(container.scope('s').inherited.has(A)).toBe(true);
    expect(container.scope('s').isolated.has(A)).toBe(false);
  });

  it('override replaces an instruction and disposes the old singleton', () => {
    expect.assertions(5);
    const container = LazyContainer.Create();
    let disposed = 0;

    class Svc {
      constructor(public tag: string) {}
      dispose() {
        disposed++;
      }
    }

    container.provide(Svc, 'real'); // construction overload
    const first = container.inject(Svc);
    expect(first.tag).toBe('real');

    container.override(Svc, () => new Svc('fake'));
    expect(disposed).toBe(1); // old cached singleton disposed
    const second = container.inject(Svc);
    expect(second).not.toBe(first);
    expect(second.tag).toBe('fake');

    expect(() => container.override(B)).not.toThrow(); // override when not yet registered
  });

  it('disposes created singletons (dispose / Symbol.dispose), ignores the rest', () => {
    expect.assertions(3);
    const container = LazyContainer.Create();
    let disposeCalls = 0;

    class Resource {
      dispose() {
        disposeCalls++;
      }
    }
    class SymbolResource {
      [Symbol.dispose]() {
        disposeCalls++;
      }
    }

    const symKey = injectionKey<SymbolResource>('sym');
    const numKey = injectionKey<number>('num');
    const nullKey = injectionKey<null>('null');

    container.provide(Resource);
    container.provide(symKey, () => new SymbolResource());
    container.provide(A); // object without dispose
    container.provide(numKey, () => 42); // primitive
    container.provide(nullKey, () => null);

    container.inject(Resource);
    container.removeSingleton(Resource);
    expect(disposeCalls).toBe(1);

    container.inject(symKey);
    container.inject(A);
    container.inject(numKey);
    container.inject(nullKey);
    container.clearSingletons();
    expect(disposeCalls).toBe(2);

    const scoped = LazyContainer.Create();
    let scopedDisposed = 0;
    class R2 {
      dispose() {
        scopedDisposed++;
      }
    }
    scoped.provide(R2);
    scoped.inject(R2);
    scoped.dispose();
    expect(scopedDisposed).toBe(1);
  });

  it('container is disposable via Symbol.dispose', () => {
    expect.assertions(2);
    const container = LazyContainer.Create();
    expect(container.isDisposed).toBe(false);
    container[Symbol.dispose]();
    expect(container.isDisposed).toBe(true);
  });
});
