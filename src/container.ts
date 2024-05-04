import {
  Disposable,
  EventArgs,
  EventHandler,
  type ConstructorParameters,
  type StandardConstructor
} from 'ts-lib-extended';
import type {
  ConstructableParameters,
  ErrorKind,
  InstanceInstruction,
  ResolveMode
} from './types.js';

type InstanceResolver<T> = () => T;
type ResolveFromScope = <T>(
  constructor_: StandardConstructor<T>,
  mode_: ResolveMode
) => InstanceResolver<T> | undefined;

type ScopeSource = Map<string, LazyContainer>;

type InstanceSource = {
  has<T>(constructor_: StandardConstructor<T>): boolean;
  delete<C extends StandardConstructor>(constructor_: C): boolean;
  get<T>(constructor_: StandardConstructor<T>): InstanceResolver<T> | undefined;
  set<T>(
    constructor_: StandardConstructor<T>,
    instruction_: InstanceResolver<T>
  ): InstanceSource;
  size: number;
  forEach(
    callbackfn: (
      value_: InstanceResolver<InstanceType<StandardConstructor>>,
      key_: StandardConstructor
    ) => void,
    thisArg?: any
  ): void;
  clear(): void;
};
type InstructionSource = {
  has<T>(constructor_: StandardConstructor<T>): boolean;
  delete<C extends StandardConstructor>(constructor_: C): boolean;
  get<T>(
    constructor_: StandardConstructor<T>
  ): InstanceInstruction<T> | undefined;
  set<T>(
    constructor_: StandardConstructor<T>,
    instruction_: InstanceInstruction<T>
  ): InstructionSource;
  size: number;
  forEach(
    callbackfn: (
      value_: InstanceInstruction<InstanceType<StandardConstructor>>,
      key_: StandardConstructor
    ) => void,
    thisArg?: any
  ): void;
  clear(): void;
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
      constructor: StandardConstructor;
      kind: ErrorKind;
    }>
  >;
  private readonly _resolvedEventHandler: EventHandler<
    this,
    EventArgs<StandardConstructor>
  >;
  private readonly _constructedEventHandler: EventHandler<
    this,
    EventArgs<{
      constructor: StandardConstructor;
      instance: unknown;
    }>
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
    return this.scope(this._inheritedScopes, scopeId_, (constructor_, mode_) =>
      this.getInstanceResolver(constructor_, mode_)
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

  public instruct<T>(
    constructor_: StandardConstructor<T>,
    instruction_: InstanceInstruction<T>
  ): void | never {
    this.validateDisposed(this);
    this.validateKnown(constructor_);
    this._instructionSource.set(constructor_, instruction_);
  }

  public provide<T, C extends StandardConstructor<T>>(
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

  public resolve<T>(
    constructor_: StandardConstructor<T>,
    mode_: ResolveMode = 'singleton'
  ): T | never {
    this.validateDisposed(this);
    console.log('resolve', constructor_.name, mode_);
    const instanceResolver = this.getInstanceResolver<T>(constructor_, mode_);

    if (instanceResolver) {
      const instance = instanceResolver();
      this._resolvedEventHandler.invoke(this, new EventArgs(constructor_));
      return instance;
    }

    this.throwError(
      constructor_,
      this.resolve.name,
      `"${constructor_.name}" could not be resolved`,
      'missing'
    );
  }

  private validateKnown<C extends StandardConstructor>(
    constructor_: C
  ): void | never {
    if (
      this._singletonSource.has<C>(constructor_) ||
      this._instructionSource.has<C>(constructor_)
    ) {
      this.throwError(
        constructor_,
        this.validateKnown.name,
        `"${constructor_.name}" already configured`,
        'duplicate'
      );
    }
  }

  private getInstanceResolver<T>(
    constructor_: StandardConstructor<T>,
    mode_: ResolveMode
  ): InstanceResolver<T> | undefined {
    switch (mode_) {
      case 'singleton':
        return (
          this._singletonSource.get(constructor_) ??
          this.resolveInstruction(constructor_, mode_) ??
          this._resolveFromScope?.(constructor_, mode_)
        );
      case 'unique':
        return (
          this.resolveInstruction(constructor_, 'singleton') ??
          this._resolveFromScope?.(constructor_, 'singleton')
        );
      case 'deep-unique':
        return (
          this.resolveInstruction(constructor_, mode_) ??
          this._resolveFromScope?.(constructor_, mode_)
        );
    }
  }

  private resolveInstruction<T>(
    constructor_: StandardConstructor<T>,
    mode_: ResolveMode
  ): InstanceResolver<T> | undefined {
    const instruction = this._instructionSource.get(constructor_);

    if (instruction) {
      const instance = instruction(mode_);
      this._constructedEventHandler.invoke(
        this,
        new EventArgs({ constructor: constructor_, instance: instance })
      );

      const instanceResolver: InstanceResolver<T> = () => instance;

      if (mode_ === 'singleton') {
        this._singletonSource.set<T>(constructor_, instanceResolver);
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
      parameter_.toString().startsWith('class')
        ? this.resolve(
            parameter_ as StandardConstructor<unknown>,
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

    this._instructionSource.forEach(({}, constructor_) => {
      this.resolve(constructor_, 'singleton');
    });

    this._inheritedScopes.forEach((inheritedScope_) => {
      inheritedScope_.presolve();
    });

    this._isolatedScopes.forEach((isolatedScope_) => {
      isolatedScope_.presolve();
    });
  }

  private throwError(
    constructor_: StandardConstructor,
    origin_: string,
    message_: string,
    kind_: ErrorKind
  ): never {
    this._errorEventHandler.invoke(
      this,
      new EventArgs({
        kind: kind_,
        constructor: constructor_
      })
    );

    throw new Error(`[ts-lazy-container/${origin_}]: ${message_}`);
  }
}
