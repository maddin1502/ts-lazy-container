import {
  Disposable,
  EventArgs,
  EventHandler,
  type ConstructorParameters,
  type StandardConstructor
} from 'ts-lib-extended';
import {
  InstanceEventArgs,
  type ConstructableParameters,
  type ErrorKind,
  type Identifier,
  type InjectionKey,
  type InstanceInstruction,
  type ResolveMode
} from './types.js';

type InstanceResolver<T> = () => T;
type ResolveFromScope = <T>(
  identifier_: Identifier<T>,
  mode_: ResolveMode
) => InstanceResolver<T> | undefined;

type ScopeSource = Map<string, LazyContainer>;

type InstanceSource = {
  has<T>(identifier_: Identifier<T>): boolean;
  get<T>(identifier_: Identifier<T>): InstanceResolver<T> | undefined;
  set<T>(
    identifier_: Identifier<T>,
    resolver_: InstanceResolver<T>
  ): InstanceSource;
  forEach(
    callbackfn: <T, ID extends Identifier<T>>(
      value_: InstanceResolver<T>,
      key_: ID
    ) => void,
    thisArg?: any
  ): void;
  clear(): void;
  delete<T>(identifier_: Identifier<T>): boolean;
};
type InstructionSource = {
  has<T>(identifier_: Identifier<T>): boolean;
  get<T>(identifier_: Identifier<T>): InstanceInstruction<T> | undefined;
  set<T>(
    identifier_: Identifier<T>,
    instruction_: InstanceInstruction<T>
  ): InstructionSource;
  forEach(
    callbackfn: <T, ID extends Identifier<T>>(
      value_: InstanceInstruction<T>,
      key_: ID
    ) => void,
    thisArg?: any
  ): void;
  clear(): void;
  delete<T>(identifier_: Identifier<T>): boolean;
};

export class LazyContainer extends Disposable {
  public static Create(): LazyContainer {
    return new LazyContainer();
  }

  private readonly _isolatedScopes: ScopeSource;
  private readonly _inheritedScopes: ScopeSource;
  private readonly _singletonSource: InstanceSource;
  private readonly _instructionSource: InstructionSource;
  private readonly _errorEventHandler: EventHandler<
    this,
    EventArgs<{
      identifier: Identifier;
      kind: ErrorKind;
    }>
  >;
  private readonly _resolvedEventHandler: EventHandler<
    this,
    InstanceEventArgs<unknown>
  >;
  private readonly _constructedEventHandler: EventHandler<
    this,
    InstanceEventArgs<unknown>
  >;

  private constructor(private readonly _resolveFromScope?: ResolveFromScope) {
    super();
    this._isolatedScopes = new Map();
    this._inheritedScopes = new Map();
    this._singletonSource = new Map();
    this._instructionSource = new Map();
    this._errorEventHandler = new EventHandler();
    this._resolvedEventHandler = new EventHandler();
    this._constructedEventHandler = new EventHandler();
    this._disposers.push(() => {
      this._isolatedScopes.forEach((container) => container.dispose());
      this._isolatedScopes.clear();
      this._inheritedScopes.forEach((container) => container.dispose());
      this._inheritedScopes.clear();
      this._singletonSource.clear();
      this._instructionSource.clear();
      this._errorEventHandler.dispose();
      this._resolvedEventHandler.dispose();
      this._constructedEventHandler.dispose();
    });
  }

  public get onError() {
    return this._errorEventHandler.event;
  }

  public get onResolved() {
    return this._resolvedEventHandler.event;
  }

  public get onConstructed() {
    return this._constructedEventHandler.event;
  }

  public isolatedScope(scopeId_: string): LazyContainer {
    return this.scope(this._isolatedScopes, scopeId_);
  }

  public inheritedScope(scopeId_: string): LazyContainer {
    return this.scope(this._inheritedScopes, scopeId_, (identifier_, mode_) =>
      this.getInstanceResolver(identifier_, mode_)
    );
  }

  private scope(
    source_: ScopeSource,
    scopeId_: string,
    resolveFromScope_?: ResolveFromScope
  ): LazyContainer {
    let scopedContainer = source_.get(scopeId_);

    if (!scopedContainer) {
      scopedContainer = new LazyContainer(resolveFromScope_);
      source_.set(scopeId_, scopedContainer);
    }

    return scopedContainer;
  }

  public instruct<T, II extends InstanceInstruction<T>>(
    identifier_: Identifier<T>,
    instruction_: II
  ): void | never {
    this.validateDisposed(this);
    this.validateKnown(identifier_);
    this._instructionSource.set(identifier_, instruction_);
  }

  public provide<T, C extends StandardConstructor<T>>(
    constructor_: C,
    ...parameters_: ConstructableParameters<C>
  ): void | never;
  public provide<T, C extends StandardConstructor<T>>(
    key_: InjectionKey<T>,
    constructor_: C
  ): void | never;

  public provide<T, C extends StandardConstructor<T>>(
    identifier_: C | InjectionKey<T>,
    ...params_: [C] | ConstructableParameters<C>
  ): void | never {
    if (typeof identifier_ === 'symbol') {
      this.provideKey(identifier_, params_[0] as C);
    } else {
      this.provideConstructor(
        identifier_,
        ...(params_ as ConstructableParameters<C>)
      );
    }
  }

  private provideConstructor<T, C extends StandardConstructor<T>>(
    constructor_: C,
    ...parameters_: ConstructableParameters<C>
  ): void | never {
    this.validateDisposed(this);
    this.validateKnown(constructor_);
    this.instruct(
      constructor_,
      (mode_) => new constructor_(...this.resolveParameters(parameters_, mode_))
    );
  }

  private provideKey<T, C extends StandardConstructor<T>>(
    key_: InjectionKey<T>,
    constructor_: C
  ): void | never {
    this.validateDisposed(this);
    this.validateKnown(key_);
    this.instruct(key_, (mode_) => this.resolve(constructor_, mode_));
  }

  // public provide<T, C extends StandardConstructor<T>>(
  //   constructor_: C,
  //   ...parameters_: ConstructableParameters<C>
  // ): void | never {
  //   this.validateDisposed(this);
  //   this.validateKnown(constructor_);
  //   this.instruct(
  //     constructor_,
  //     (mode_) => new constructor_(...this.resolveParameters(parameters_, mode_))
  //   );
  // }

  // public provideKey<T, C extends StandardConstructor<T>>(
  //   key_: InjectionKey<T>,
  //   constructor_: C
  // ): void | never {
  //   this.validateDisposed(this);
  //   this.validateKnown(key_);
  //   this.instruct(key_, (mode_) => this.resolve(constructor_, mode_));
  // }

  public resolve<T>(
    identifier_: Identifier<T>,
    mode_: ResolveMode = 'singleton'
  ): T | never {
    this.validateDisposed(this);
    const instanceResolver = this.getInstanceResolver(identifier_, mode_);

    if (instanceResolver) {
      const instance = instanceResolver();
      this._resolvedEventHandler.invoke(
        this,
        new InstanceEventArgs({ identifier: identifier_, instance: instance })
      );

      return instance;
    }

    this.throwError(
      identifier_,
      this.resolve.name,
      `"${this.identifierName(identifier_)}" could not be resolved`,
      'missing'
    );
  }

  public removeSingleton<ID extends Identifier>(
    identifier_: ID,
    includeScopes_ = false
  ): void {
    this._singletonSource.delete(identifier_);

    if (!includeScopes_) {
      return;
    }

    this.forEachScope((scope_) => {
      scope_.removeSingleton(identifier_, true);
    });
  }

  public clearSingletons(includeScopes_ = false): void {
    this._singletonSource.clear();

    if (!includeScopes_) {
      return;
    }

    this.forEachScope((scope_) => {
      scope_.clearSingletons(true);
    });
  }

  private forEachScope(handler_: (scope_: LazyContainer) => void) {
    this._isolatedScopes.forEach(handler_);
    this._inheritedScopes.forEach(handler_);
  }

  private validateKnown<ID extends Identifier>(identifier_: ID): void | never {
    if (this._instructionSource.has<ID>(identifier_)) {
      this.throwError(
        identifier_,
        this.validateKnown.name,
        `"${this.identifierName(identifier_)}" already configured`,
        'duplicate'
      );
    }
  }

  private identifierName(identifier_: Identifier): string {
    return typeof identifier_ === 'symbol'
      ? identifier_.toString()
      : identifier_.name;
  }

  private getInstanceResolver<T>(
    identifier_: Identifier<T>,
    mode_: ResolveMode
  ): InstanceResolver<T> | undefined {
    switch (mode_) {
      case 'singleton':
        return (
          this._singletonSource.get(identifier_) ??
          this.resolveInstruction(identifier_, mode_) ??
          this._resolveFromScope?.(identifier_, mode_)
        );
      case 'unique':
        return (
          this.resolveInstruction(identifier_, 'singleton') ??
          this._resolveFromScope?.(identifier_, 'singleton')
        );
      case 'deep-unique':
        return (
          this.resolveInstruction(identifier_, mode_) ??
          this._resolveFromScope?.(identifier_, mode_)
        );
    }
  }

  private resolveInstruction<T>(
    identifier_: Identifier<T>,
    mode_: ResolveMode
  ): InstanceResolver<T> | undefined {
    const instruction = this._instructionSource.get(identifier_);

    if (instruction) {
      const instance = instruction(mode_);
      this._constructedEventHandler.invoke(
        this,
        new InstanceEventArgs({ identifier: identifier_, instance: instance })
      );

      const instanceResolver: InstanceResolver<T> = () => instance;

      if (mode_ === 'singleton') {
        console.log('set', identifier_)
        this._singletonSource.set<T>(identifier_, instanceResolver);
      }

      return instanceResolver;
    }
  }

  private resolveParameters<T, C extends StandardConstructor<T>>(
    parameters_: ConstructableParameters<C>,
    mode_: ResolveMode
  ): ConstructorParameters<C> {
    // TODO: optimize type assertions
    return parameters_.map((parameter_) =>
      typeof parameter_ === 'function' &&
      parameter_.toString().startsWith('class') || typeof parameter_ === 'symbol'
        ? this.resolve(
            parameter_ as Identifier<unknown>,
            mode_ === 'unique' ? 'singleton' : mode_
          )
        : parameter_
    ) as ConstructorParameters<C>;
  }

  /**
   * pre resolve instances as singleton and abandon laziness (including scopes). HINT: can be used to validate container consistency
   *
   * @memberof LazyContainer
   * @throws {Error}
   */
  public presolve(): void | never {
    this.validateDisposed(this);

    this._instructionSource.forEach(({}, identifier_) => {
      this.resolve(identifier_, 'singleton');
    });

    this.forEachScope((scope_) => {
      scope_.presolve();
    });
  }

  private throwError(
    identifier_: Identifier,
    origin_: string,
    message_: string,
    kind_: ErrorKind
  ): never {
    this._errorEventHandler.invoke(
      this,
      new EventArgs({
        kind: kind_,
        identifier: identifier_
      })
    );

    throw new Error(`[ts-lazy-container/${origin_}]: ${message_}`);
  }
}

// interface ITest {
//   test_: string;
// }

// class Test implements ITest {
//   constructor(public readonly test_: string) {}
// }

// const lz: LazyContainer = null as any;
// const ik = injectionKey<ITest>();

// lz.provide(ik, Test);
// lz.provide(ik, Object);
// lz.provide(Test, '');
// lz.instruct(Test, () => new Test(''));
// lz.instruct(ik, () => new Test(''));
// lz.instruct(ik, () => new Object());
