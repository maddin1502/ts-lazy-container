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
  type IdentifierDefinition,
  type ResolveMode,
  type Resolver
} from './types.js';

type InstanceCreator<T> = () => T;
type ResolveFromScope = <T>(
  identifier_: Identifier<T>,
  mode_: ResolveMode
) => InstanceCreator<T> | undefined;

type CreatorSource = {
  has<T>(identifier_: Identifier<T>): boolean;
  get<T>(identifier_: Identifier<T>): InstanceCreator<T> | undefined;
  set<T>(
    identifier_: Identifier<T>,
    creator_: InstanceCreator<T>
  ): CreatorSource;
  forEach(
    callbackfn: <T>(creator_: InstanceCreator<T>, key_: Identifier<T>) => void,
    thisArg?: unknown
  ): void;
  clear(): void;
  delete<T>(identifier_: Identifier<T>): boolean;
};
type ResolverSource = {
  has<T>(identifier_: Identifier<T>): boolean;
  get<T>(identifier_: Identifier<T>): Resolver<T> | undefined;
  set<T>(identifier_: Identifier<T>, resolver_: Resolver<T>): ResolverSource;
  forEach(
    callbackfn: <T>(resolver_: Resolver<T>, key_: Identifier<T>) => void,
    thisArg?: unknown
  ): void;
  clear(): void;
  delete<T>(identifier_: Identifier<T>): boolean;
};

/**
 * This tool manages the creation and distribution of application-wide instances.
 * These are created as singletons or unique variants as needed from provided definitions.
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
  private readonly _errorEventHandler: EventHandler<
    this,
    EventArgs<[Identifier, ErrorKind]>
  >;
  private readonly _resolvedEventHandler: EventHandler<
    this,
    InstanceEventArgs<unknown>
  >;
  private readonly _createdEventHandler: EventHandler<
    this,
    InstanceEventArgs<unknown>
  >;

  protected constructor(private readonly _resolveFromScope?: ResolveFromScope) {
    super();
    this._creatorSource = new Map();
    this._resolverSource = new Map();
    this._errorEventHandler = new EventHandler();
    this._resolvedEventHandler = new EventHandler();
    this._createdEventHandler = new EventHandler();
    this._disposers.push(() => {
      this._creatorSource.clear();
      this._resolverSource.clear();
      this._errorEventHandler.dispose();
      this._resolvedEventHandler.dispose();
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
   * subscribe/unsubscribe to an event that is triggered when an instance is resolved
   *
   * @public
   * @readonly
   * @type {Event<this, InstanceEventArgs<unknown>>}
   * @since 1.0.0
   */
  public get onResolved(): Event<this, InstanceEventArgs<unknown>> {
    return this._resolvedEventHandler.event;
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
   * Register an instance creation definition via its class definition.
   *
   * Required parameters are determined via the class constructor and must be specified in the correct order.
   * Simple parameters (primitive values, arrays, functions) can be passed directly.
   * Object-like parameters (interfaces, record types, anonymous objects) must be provided via a matching identifier (class or injection key - NOT an instance).
   * These parameter identifiers are resolved internally; this is only possible if their instance creation definitions are also specified by provide() of provideClass().
   *
   * ```ts
   * import { LazyContainer } from 'ts-lazy-container'
   *
   * class A {}
   * class B {
   *   constructor(
   *     public a: A,
   *     public text: string
   *   ) {}
   * }
   *
   * const container = LazyContainer.Create();
   * container.provide(A)
   * container.provide(B, A, 'hello world')
   *
   * ...
   *
   * const b = container.resolve(B);
   * ```
   *
   * @public
   * @template {StandardConstructor} C
   * @param {C} constructor_ Class itself, NOT an instance
   * @param {...ConstructableParameters<C>} parameters_
   * @throws {Error} when already provided (duplicate)
   * @since 1.0.0
   */
  public provideClass<C extends StandardConstructor>(
    constructor_: C,
    ...parameters_: ConstructableParameters<C>
  ): void {
    this.validateDisposed(this);
    this.validateKnown(constructor_);
    this.setResolver(
      constructor_,
      (mode_) => new constructor_(...this.resolveParameters(parameters_, mode_))
    );
  }

  /**
   * Provide/Register instance creation definitions for a specific type (determined by the identifier - class or injection key).
   *
   * Use cases:
   * - custom definitions for class instances
   * - provide types/interfaces/class definitions based on inheritance/duck-typing (resolve A with B, when B extends/inherits/satisfies A)
   * - type/interface-based definition (no need for classes) using typed injection keys
   *
   * ```ts
   * import { LazyContainer, injectionKey } from 'ts-lazy-container'
   *
   * type AType = {
   *   value: string
   * }
   *
   * class A1 implements AType {
   *   constructor(public value: string) {}
   * }
   *
   * class A2 extends A1 {}
   *
   * const container = LazyContainer.Create();
   * const aInjectionKey = injectionKey<AType>();
   * const aInjectionKey2 = injectionKey<AType>();
   * container.provide(aInjectionKey, () => ({value: 'hi'}))
   * container.provide(A1, () => new A1('hello'))
   * container.provide(A2, 'greetings')
   * container.provide(aInjectionKey2, A2)
   *
   * ...
   *
   * const aik: AType = container.resolve(aInjectionKey); // value = hi
   * const a1: AType = container.resolve(A1); // value = hello
   * const a2: AType = container.resolve(A2); // value = greeting
   * const aik2: AType = container.resolve(aInjectionKey2); // value = greeting
   * ```
   *
   * @public
   * @template {Identifier} I
   * @param {I} identifier_ Identifier (class or injection key) that refers to the type to be provided/registered
   * @param {IdentifierDefinition<I>} definition_ definition_  Definition: Identifier (class or injection key) that refers to a type that is assignable to the target type; or an instance creation callback
   * @throws {Error} when already provided (duplicate)
   * @since 1.0.0
   */
  public provide<I extends Identifier>(
    identifier_: I,
    definition_: IdentifierDefinition<I>
  ): void {
    this.validateDisposed(this);
    this.validateKnown(identifier_);

    this.setResolver(
      identifier_,
      this.isIdentifier(definition_)
        ? (mode_) => this.resolve(definition_, mode_)
        : definition_
    );
  }

  /**
   * Resolve an instance. Suitable definitions must be provided in advance via provide() or provideClass().
   *
   * ResolveMode:
   * - singleton: created instance will be cached and reused when resolved later; dependencies/constructor-parameters are resolved in 'singleton' mode
   * - unique: creates a new instance each time; dependencies/constructor-parameters are resolved in 'singleton' mode
   * - deep-unique: creates a new instance each time; dependencies/constructor-parameters are resolved in 'deep-unique' mode and are therefore also unique
   *
   * @public
   * @template T
   * @param {Identifier<T>} identifier_ class or injection key
   * @param {ResolveMode} [mode_='singleton'] default 'singleton'
   * @returns {T}
   * @throws {Error} when no definition is provided
   * @since 1.0.0
   */
  public resolve<T>(
    identifier_: Identifier<T>,
    mode_: ResolveMode = 'singleton'
  ): T {
    this.validateDisposed(this);
    const creator = this.getInstanceCreator(identifier_, mode_);

    if (creator) {
      const instance = creator();
      this._resolvedEventHandler.invoke(
        this,
        new InstanceEventArgs(identifier_, instance)
      );

      return instance;
    }

    this.throwInstanceError(
      identifier_,
      this.resolve.name,
      `"${this.identifierName(identifier_)}" could not be resolved`,
      'missing'
    );
  }

  /**
   * Clear cached singleton instance
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
    this._creatorSource.delete(identifier_);

    if (!includeScopes_) {
      return;
    }

    this.forEachScopeInstance((instance_) =>
      instance_.removeSingleton(identifier_, true)
    );
  }

  /**
   * Clear ALL cached singleton instances
   *
   * @public
   * @param {boolean} [includeScopes_=false]
   * @since 1.0.0
   */
  public clearSingletons(includeScopes_: boolean = false): void {
    this.validateDisposed(this);
    this._creatorSource.clear();

    if (!includeScopes_) {
      return;
    }

    this.forEachScopeInstance((instance_) => instance_.clearSingletons(true));
  }

  /**
   * Pre-resolve all instances as singletons using the provided definitions (abandon laziness; including scopes).
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
      this.resolve(identifier_, 'singleton')
    );

    this.forEachScopeInstance((instance_) => instance_.presolve());
  }

  protected disposeScope(scope_: LazyContainerScope): void {
    scope_.dispose();
  }

  protected createScope(scopeId_: PropertyKey): LazyContainerScope {
    return new LazyContainerScope(
      scopeId_,
      (variant_) =>
        new LazyContainer(
          variant_ === 'inherited'
            ? (identifier_, mode_) =>
                this.getInstanceCreator(identifier_, mode_)
            : undefined
        )
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
    mode_: ResolveMode
  ): InstanceCreator<T> | undefined {
    switch (mode_) {
      case 'singleton':
        return (
          this._creatorSource.get(identifier_) ??
          this.resolveCreator(identifier_, mode_) ??
          this._resolveFromScope?.(identifier_, mode_)
        );
      case 'unique':
        return (
          this.resolveCreator(identifier_, 'singleton') ??
          this._resolveFromScope?.(identifier_, 'singleton')
        );
      case 'deep-unique':
        return (
          this.resolveCreator(identifier_, mode_) ??
          this._resolveFromScope?.(identifier_, mode_)
        );
    }
  }

  private resolveCreator<T>(
    identifier_: Identifier<T>,
    mode_: ResolveMode
  ): InstanceCreator<T> | undefined {
    const resolver = this._resolverSource.get(identifier_);

    if (resolver) {
      const instance = resolver(mode_);
      this._createdEventHandler.invoke(
        this,
        new InstanceEventArgs(identifier_, instance)
      );

      const creator: InstanceCreator<T> = () => instance;

      if (mode_ === 'singleton') {
        this._creatorSource.set<T>(identifier_, creator);
      }

      return creator;
    }
  }

  private resolveParameters<C extends StandardConstructor>(
    parameters_: ConstructableParameters<C>,
    mode_: ResolveMode
  ): ConstructorParameters<C> {
    return parameters_.map((parameter_) => {
      return this.isIdentifier(parameter_)
        ? this.resolve(parameter_, mode_)
        : parameter_;
    }) as ConstructorParameters<C>;
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
    return (
      typeof value_ === 'function' && value_.toString().startsWith('class')
    );
  }

  private isIdentifier(value_: unknown): value_ is Identifier {
    return this.isConstructor(value_) || isInjectionKey(value_);
  }
}
