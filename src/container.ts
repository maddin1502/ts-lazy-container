import {
  Event,
  EventArgs,
  EventHandler,
  ScopedInstanceCore,
  type StandardConstructor
} from 'ts-lib-extended';
import { isInjectionKey } from './injectionKey.js';
import { LazyContainerScope } from './scope.js';
import {
  InstanceEventArgs,
  type ConstructableParameters,
  type ErrorKind,
  type Identifier,
  type IdentifierInstruction,
  type InjectionMode,
  type Resolver
} from './types.js';

type InstanceCreator<T> = () => T;

type CreatorSource = {
  has<T>(identifier_: Identifier<T>): boolean;
  get<T>(identifier_: Identifier<T>): InstanceCreator<T> | undefined;
  set<T>(
    identifier_: Identifier<T>,
    creator_: InstanceCreator<T>
  ): CreatorSource;
  forEach(
    callbackfn: <T>(creator_: InstanceCreator<T>, key_: Identifier<T>) => void
  ): void;
  clear(): void;
  delete<T>(identifier_: Identifier<T>): boolean;
};
type ResolverSource = {
  has<T>(identifier_: Identifier<T>): boolean;
  get<T>(identifier_: Identifier<T>): Resolver<T> | undefined;
  set<T>(identifier_: Identifier<T>, resolver_: Resolver<T>): ResolverSource;
  forEach(
    callbackfn: <T>(resolver_: Resolver<T>, key_: Identifier<T>) => void
  ): void;
  clear(): void;
  delete<T>(identifier_: Identifier<T>): boolean;
};
/**
 * This tool manages the creation and distribution of application-wide instances.
 * These are created as singletons or unique variants as needed from provided instructions.
 * In addition, scopes can be used to refine the distribution
 *
 * @export
 * @class LazyContainer
 * @extends {ScopedInstanceCore<LazyContainerScope>}
 * @since 1.0.0
 */
export class LazyContainer extends ScopedInstanceCore<LazyContainerScope> {
  public static Create(): LazyContainer {
    return new LazyContainer();
  }

  private readonly _creatorSource: CreatorSource;
  private readonly _resolverSource: ResolverSource;
  private readonly _resolving: Set<Identifier>;
  private readonly _errorEventHandler: EventHandler<
    this,
    EventArgs<[Identifier, ErrorKind]>
  >;
  private readonly _injectedEventHandler: EventHandler<
    this,
    InstanceEventArgs<unknown>
  >;
  private readonly _createdEventHandler: EventHandler<
    this,
    InstanceEventArgs<unknown>
  >;

  protected constructor(private readonly _parent?: LazyContainer) {
    super();
    this._creatorSource = new Map();
    this._resolverSource = new Map();
    this._resolving = new Set();
    this._errorEventHandler = new EventHandler();
    this._injectedEventHandler = new EventHandler();
    this._createdEventHandler = new EventHandler();
    this._disposers.push(() => {
      this.disposeSingletonInstances();
      this._creatorSource.clear();
      this._resolverSource.clear();
      this._resolving.clear();
      this._errorEventHandler.dispose();
      this._injectedEventHandler.dispose();
      this._createdEventHandler.dispose();
    });
  }

  /**
   * subscribe/unsubscribe to an event that is triggered when an error occurs
   *
   * @public
   * @readonly
   * @type {Event<this, EventArgs<[Identifier, ErrorKind]>>}
   * @since 1.0.0
   */
  public get onError(): Event<this, EventArgs<[Identifier, ErrorKind]>> {
    return this._errorEventHandler.event;
  }

  /**
   * subscribe/unsubscribe to an event that is triggered when an instance is injected
   *
   * @public
   * @readonly
   * @type {Event<this, InstanceEventArgs<unknown>>}
   * @since 1.0.0
   */
  public get onInjected(): Event<this, InstanceEventArgs<unknown>> {
    return this._injectedEventHandler.event;
  }

  /**
   * subscribe/unsubscribe to an event that is triggered when an instance is created
   *
   * @public
   * @readonly
   * @type {Event<this, InstanceEventArgs<unknown>>}
   * @since 1.0.0
   */
  public get onCreated(): Event<this, InstanceEventArgs<unknown>> {
    return this._createdEventHandler.event;
  }

  /**
   * Provide/Register an instance creation instruction for an identifier (class or injection key).
   *
   * The form is determined automatically from the arguments:
   * - construction: pass a class together with its constructor parameters.
   *   Simple parameters (primitives, arrays, functions) are passed directly;
   *   object-like parameters (interfaces, record types, anonymous objects) must
   *   be passed as a matching identifier (class or injection key - NOT an
   *   instance) and are resolved lazily on injection.
   * - creation callback: pass a single function `(mode) => instance`.
   * - delegation: pass a single identifier that resolves to an assignable type
   *   (inheritance/duck-typing; e.g. resolve an injection key via a class).
   *
   * Note: a single function argument is always interpreted as a creation
   * callback, and a single identifier argument for a *class* is always
   * interpreted as that class' sole constructor parameter.
   *
   * Identifiers can only be registered once; duplicate registration throws.
   *
   * ```ts
   * import { LazyContainer, injectionKey } from 'ts-lazy-container'
   *
   * type AType = { value: string }
   * class A1 implements AType { constructor(public value: string) {} }
   * class A2 extends A1 {}
   *
   * const container = LazyContainer.Create();
   * const aInjectionKey = injectionKey<AType>();
   * const aInjectionKey2 = injectionKey<AType>();
   *
   * container.provide(A1, () => new A1('hello'))           // creation callback
   * container.provide(A2, 'greetings')                     // construction
   * container.provide(aInjectionKey, () => ({ value: 'hi' })) // creation callback
   * container.provide(aInjectionKey2, A2)                  // delegation
   *
   * ...
   *
   * const a1: AType = container.inject(A1); // value = hello
   * const a2: AType = container.inject(A2); // value = greetings
   * const aik: AType = container.inject(aInjectionKey); // value = hi
   * const aik2: AType = container.inject(aInjectionKey2); // value = greetings
   * ```
   *
   * @public
   * @throws {Error} when already provided (duplicate)
   * @since 1.0.0
   */
  public provide<C extends StandardConstructor>(
    constructor_: C,
    ...parameters_: ConstructableParameters<C>
  ): void;
  public provide<I extends Identifier>(
    identifier_: I,
    instruction_: IdentifierInstruction<I>
  ): void;
  public provide(identifier_: Identifier, ...args_: unknown[]): void {
    this.validateDisposed(this);
    this.validateKnown(identifier_);
    this.setResolver(identifier_, this.createResolver(identifier_, args_));
  }

  /**
   * Like provide(), but replaces an existing instruction instead of throwing.
   * Any cached singleton for the identifier is removed (and disposed) first.
   * Useful for mocking/overriding in tests.
   *
   * @public
   * @since 1.0.0
   */
  public override<C extends StandardConstructor>(
    constructor_: C,
    ...parameters_: ConstructableParameters<C>
  ): void;
  public override<I extends Identifier>(
    identifier_: I,
    instruction_: IdentifierInstruction<I>
  ): void;
  public override(identifier_: Identifier, ...args_: unknown[]): void {
    this.validateDisposed(this);
    this.removeSingleton(identifier_);
    this.setResolver(identifier_, this.createResolver(identifier_, args_));
  }

  /**
   * Inject/Resolve an instance. Suitable instructions must be provided in advance via provide().
   *
   * InjectionMode:
   * - singleton: created instance will be cached and reused on further injections; dependencies/constructor-parameters are resolved in 'singleton' mode
   * - unique: creates a new instance each time; dependencies/constructor-parameters are resolved in 'singleton' mode
   * - deep-unique: creates a new instance each time; dependencies/constructor-parameters are resolved in 'deep-unique' mode and are therefore also unique
   *
   * @public
   * @template T
   * @param {Identifier<T>} identifier_ class or injection key
   * @param {InjectionMode} [mode_='singleton'] default 'singleton'
   * @returns {T}
   * @throws {Error} when no instruction found
   * @since 1.0.0
   */
  public inject<T>(
    identifier_: Identifier<T>,
    mode_: InjectionMode = 'singleton'
  ): T {
    this.validateDisposed(this);
    const creator = this.getInstanceCreator(identifier_, mode_);

    if (creator) {
      return this.handOut(identifier_, creator);
    }

    this.throwInstanceError(
      identifier_,
      this.inject.name,
      `"${this.identifierName(identifier_)}" could not be injected`,
      'missing'
    );
  }

  /**
   * Like inject(), but returns undefined instead of throwing when no instruction is found.
   *
   * @public
   * @template T
   * @param {Identifier<T>} identifier_ class or injection key
   * @param {InjectionMode} [mode_='singleton'] default 'singleton'
   * @returns {T | undefined}
   * @since 1.0.0
   */
  public tryInject<T>(
    identifier_: Identifier<T>,
    mode_: InjectionMode = 'singleton'
  ): T | undefined {
    this.validateDisposed(this);
    const creator = this.getInstanceCreator(identifier_, mode_);
    return creator ? this.handOut(identifier_, creator) : undefined;
  }

  /**
   * Check whether an instruction is registered for the identifier (including inherited scopes).
   *
   * @public
   * @param {Identifier} identifier_ class or injection key
   * @returns {boolean}
   * @since 1.0.0
   */
  public has(identifier_: Identifier): boolean {
    this.validateDisposed(this);
    return (
      this._resolverSource.has(identifier_) ||
      (this._parent?.has(identifier_) ?? false)
    );
  }

  /**
   * Clear cached singleton instance (disposing it if it is disposable)
   *
   * @public
   * @template {Identifier} ID
   * @param {ID} identifier_ class or injection key
   * @param {boolean} [includeScopes_=false]
   * @since 1.0.0
   */
  public removeSingleton<ID extends Identifier>(
    identifier_: ID,
    includeScopes_: boolean = false
  ): void {
    this.validateDisposed(this);
    const creator = this._creatorSource.get(identifier_);

    if (creator) {
      this.tryDisposeInstance(creator());
      this._creatorSource.delete(identifier_);
    }

    if (!includeScopes_) {
      return;
    }

    this.forEachScopeInstance((instance_) =>
      instance_.removeSingleton(identifier_, true)
    );
  }

  /**
   * Clear ALL cached singleton instances (disposing those that are disposable)
   *
   * @public
   * @param {boolean} [includeScopes_=false]
   * @since 1.0.0
   */
  public clearSingletons(includeScopes_: boolean = false): void {
    this.validateDisposed(this);
    this.disposeSingletonInstances();
    this._creatorSource.clear();

    if (!includeScopes_) {
      return;
    }

    this.forEachScopeInstance((instance_) => instance_.clearSingletons(true));
  }

  /**
   * Pre-resolve all instances as singletons using the provided instructions (abandon laziness; including scopes).
   *
   * HINT: can be used to validate container consistency in tests
   *
   * @public
   * @throws {Error} if at least one instance cannot be resolved
   * @since 1.0.0
   */
  public presolve(): void {
    this.validateDisposed(this);

    this._resolverSource.forEach((_, identifier_) =>
      this.inject(identifier_, 'singleton')
    );

    this.forEachScopeInstance((instance_) => instance_.presolve());
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }

  protected disposeScope(scope_: LazyContainerScope): void {
    scope_.dispose();
  }

  protected createScope(scopeId_: PropertyKey): LazyContainerScope {
    return new LazyContainerScope(
      scopeId_,
      (variant_) =>
        new LazyContainer(variant_ === 'inherited' ? this : undefined)
    );
  }

  private setResolver<T>(
    identifier_: Identifier<T>,
    resolver_: Resolver<T>
  ): void {
    this._resolverSource.set(identifier_, resolver_);
  }

  private forEachScopeInstance(
    callbackFn_: (instance_: LazyContainer) => void
  ): void {
    this.scopes.forEach((scope_) =>
      scope_.variants.forEach((instance_) => callbackFn_(instance_))
    );
  }

  private handOut<T>(
    identifier_: Identifier<T>,
    creator_: InstanceCreator<T>
  ): T {
    const instance = creator_();
    this._injectedEventHandler.invoke(
      this,
      new InstanceEventArgs(identifier_, instance)
    );
    return instance;
  }

  private disposeSingletonInstances(): void {
    this._creatorSource.forEach((creator_) =>
      this.tryDisposeInstance(creator_())
    );
  }

  private tryDisposeInstance(instance_: unknown): void {
    if (typeof instance_ !== 'object' || instance_ === null) {
      return;
    }

    const dispose_ =
      'dispose' in instance_
        ? instance_.dispose
        : Symbol.dispose in instance_
        ? instance_[Symbol.dispose]
        : undefined;

    if (typeof dispose_ === 'function') {
      dispose_.call(instance_);
    }
  }

  private validateKnown<ID extends Identifier>(identifier_: ID): void {
    if (this._resolverSource.has(identifier_)) {
      this.throwInstanceError(
        identifier_,
        this.validateKnown.name,
        `"${this.identifierName(identifier_)}" already configured`,
        'duplicate'
      );
    }
  }

  private identifierName(identifier_: Identifier): string {
    return isInjectionKey(identifier_)
      ? identifier_.toString()
      : identifier_.name;
  }

  private getInstanceCreator<T>(
    identifier_: Identifier<T>,
    mode_: InjectionMode
  ): InstanceCreator<T> | undefined {
    switch (mode_) {
      case 'singleton':
        return (
          this._creatorSource.get(identifier_) ??
          this.resolveCreator(identifier_, mode_, true) ??
          this._parent?.getInstanceCreator(identifier_, mode_)
        );
      case 'unique':
        return (
          this.resolveCreator(identifier_, 'singleton', false) ??
          this._parent?.getInstanceCreator(identifier_, 'unique')
        );
      case 'deep-unique':
        return (
          this.resolveCreator(identifier_, mode_, false) ??
          this._parent?.getInstanceCreator(identifier_, mode_)
        );
    }
  }

  private resolveCreator<T>(
    identifier_: Identifier<T>,
    mode_: InjectionMode,
    cache_: boolean
  ): InstanceCreator<T> | undefined {
    const resolver = this._resolverSource.get(identifier_);

    if (resolver) {
      if (this._resolving.has(identifier_)) {
        this.throwInstanceError(
          identifier_,
          this.resolveCreator.name,
          `circular dependency detected while resolving "${this.identifierName(
            identifier_
          )}"`,
          'cyclic'
        );
      }

      this._resolving.add(identifier_);
      let instance: T;

      try {
        instance = resolver(mode_);
      } finally {
        this._resolving.delete(identifier_);
      }

      this._createdEventHandler.invoke(
        this,
        new InstanceEventArgs(identifier_, instance)
      );

      const creator: InstanceCreator<T> = () => instance;

      if (cache_) {
        this._creatorSource.set<T>(identifier_, creator);
      }

      return creator;
    }
  }

  private createResolver(
    identifier_: Identifier,
    args_: readonly unknown[]
  ): Resolver {
    const firstArg = args_[0];

    // a lone function argument is a creation callback `(mode) => instance`
    if (args_.length === 1 && this.isResolver(firstArg)) {
      return firstArg;
    }

    // a class is constructed from the given constructor parameters
    // (isConstructor narrows identifier_ - no unchecked assertion needed)
    if (this.isConstructor(identifier_)) {
      return (mode_) =>
        new identifier_(...this.resolveParameters(args_, mode_));
    }

    // a non-class identifier delegates to another (inheritance/duck-typing)
    if (this.isIdentifier(firstArg)) {
      return (mode_) => this.inject(firstArg, mode_);
    }

    // defensive (unreachable via the typed API): a non-class identifier must be
    // given a creation callback or a delegation identifier
    this.throwInstanceError(
      identifier_,
      this.createResolver.name,
      `"${this.identifierName(identifier_)}" was given no valid instruction`,
      'missing'
    );
  }

  private resolveParameters(
    parameters_: readonly unknown[],
    mode_: InjectionMode
  ): unknown[] {
    return parameters_.map((parameter_) => {
      return this.isIdentifier(parameter_)
        ? this.inject(parameter_, mode_)
        : parameter_;
    });
  }

  private throwInstanceError(
    identifier_: Identifier,
    origin_: string,
    message_: string,
    kind_: ErrorKind
  ): never {
    this._errorEventHandler.invoke(this, new EventArgs(identifier_, kind_));
    this.throwError(origin_, message_);
  }

  private throwError(origin_: string, message_: string): never {
    throw new Error(`[ts-lazy-container/${origin_}]: ${message_}`);
  }

  private isConstructor(value_: unknown): value_ is StandardConstructor {
    if (typeof value_ !== 'function') {
      return false;
    }

    // a class exposes a non-writable `prototype` descriptor; regular functions
    // (resolver callbacks) have a writable one and arrow functions have none
    const prototypeDescriptor = Object.getOwnPropertyDescriptor(
      value_,
      'prototype'
    );

    return prototypeDescriptor !== undefined && !prototypeDescriptor.writable;
  }

  private isIdentifier(value_: unknown): value_ is Identifier {
    return this.isConstructor(value_) || isInjectionKey(value_);
  }

  private isResolver(value_: unknown): value_ is Resolver {
    return typeof value_ === 'function' && !this.isConstructor(value_);
  }
}
