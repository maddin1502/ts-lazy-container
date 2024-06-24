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

/**
 * This tool controls the creation and distribution of application-wide object instances.
 * These are created as singletons or unique variants as needed from provided build instructions.
 * In addition, scopes can be used to refine the distribution
 *
 * @export
 * @class LazyContainer
 * @extends {Disposable}
 * @since 1.0.0
 */
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

  /**
   * subscribe/unsubscribe to an event that is triggered when an error occurs
   *
   * @public
   * @readonly
   * @type {*}
   * @since 1.0.0
   */
  public get onError() {
    return this._errorEventHandler.event;
  }

  /**
   * subscribe/unsubscribe to an event that is triggered when an instance is resolved
   *
   * @public
   * @readonly
   * @type {*}
   * @since 1.0.0
   */
  public get onResolved() {
    return this._resolvedEventHandler.event;
  }

  /**
   * subscribe/unsubscribe to an event that is triggered when an object is instantiated
   *
   * @public
   * @readonly
   * @type {*}
   * @since 1.0.0
   */
  public get onConstructed() {
    return this._constructedEventHandler.event;
  }

  /**
   * create/use a sub container that is isolated from its parent container (no access to instances)
   *
   * @public
   * @param {string} scopeId_
   * @returns {LazyContainer}
   * @since 1.0.0
   */
  public isolatedScope(scopeId_: string): LazyContainer {
    this.validateDisposed(this);
    return this.getOrCreateScope(this._isolatedScopes, scopeId_);
  }

  /**
   * create/use a sub container that is able to access instances from its parent container (can override it)
   *
   * @public
   * @param {string} scopeId_
   * @returns {LazyContainer}
   * @since 1.0.0
   */
  public inheritedScope(scopeId_: string): LazyContainer {
    this.validateDisposed(this);
    return this.getOrCreateScope(
      this._inheritedScopes,
      scopeId_,
      (identifier_, mode_) => this.getInstanceResolver(identifier_, mode_)
    );
  }

  /**
   * Provide an instruction callback that creates an instance of the type defined by the specified identifier (class constructor or injection key).
   *
   * @public
   * @template T
   * @template {InstanceInstruction<T>} II
   * @param {Identifier<T>} identifier_
   * @param {II} instruction_
   * @returns {(void | never)}
   * @since 1.0.0
   */
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
    this.validateDisposed(this);

    if (typeof identifier_ === 'symbol') {
      this.provideKey(identifier_, params_[0] as C);
    } else {
      this.provideConstructor(
        identifier_,
        ...(params_ as ConstructableParameters<C>)
      );
    }
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
    this.validateDisposed(this);
    this._singletonSource.delete(identifier_);

    if (!includeScopes_) {
      return;
    }

    this.forEachScope((scope_) => {
      scope_.removeSingleton(identifier_, true);
    });
  }

  public clearSingletons(includeScopes_ = false): void {
    this.validateDisposed(this);
    this._singletonSource.clear();

    if (!includeScopes_) {
      return;
    }

    this.forEachScope((scope_) => {
      scope_.clearSingletons(true);
    });
  }

  /**
   * pre resolve instances as singleton and abandon laziness (including scopes).
   * HINT: can be used to validate container consistency in tests
   *
   * @public
   * @returns {(void | never)}
   * @throws {Error} if at least one instance cannot be resolved
   * @since 1.0.0
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

  private getOrCreateScope(
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

  private provideConstructor<T, C extends StandardConstructor<T>>(
    constructor_: C,
    ...parameters_: ConstructableParameters<C>
  ): void | never {
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
      (typeof parameter_ === 'function' &&
        parameter_.toString().startsWith('class')) ||
      typeof parameter_ === 'symbol'
        ? this.resolve(
            parameter_ as Identifier<unknown>,
            mode_ === 'unique' ? 'singleton' : mode_
          )
        : parameter_
    ) as ConstructorParameters<C>;
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
