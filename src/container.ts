import {
  Event,
  EventArgs,
  EventHandler,
  type StandardConstructor
} from 'ts-lib-extended';
import { isInjectionKey } from './injectionKey.js';
import { ScopedLazyContainer, type LazyContainerShape } from './scope.js';
import {
  InstanceEventArgs,
  type ConstructableParameters,
  type Creator,
  type ErrorKind,
  type Identifier,
  type Instruction,
  type ResolveMode
} from './types.js';

type InstanceResolver<T> = () => T;
type ResolveFromScope = <T>(
  identifier_: Identifier<T>,
  mode_: ResolveMode
) => InstanceResolver<T> | undefined;

type InstanceSource = {
  has<T>(identifier_: Identifier<T>): boolean;
  get<T>(identifier_: Identifier<T>): InstanceResolver<T> | undefined;
  set<T>(
    identifier_: Identifier<T>,
    resolver_: InstanceResolver<T>
  ): InstanceSource;
  forEach(
    callbackfn: <T>(value_: InstanceResolver<T>, key_: Identifier<T>) => void,
    thisArg?: unknown
  ): void;
  clear(): void;
  delete<T>(identifier_: Identifier<T>): boolean;
};
type CreatorSource = {
  has<T>(identifier_: Identifier<T>): boolean;
  get<T>(identifier_: Identifier<T>): Creator<T> | undefined;
  set<T>(identifier_: Identifier<T>, instruction_: Creator<T>): CreatorSource;
  forEach(
    callbackfn: <T>(value_: Creator<T>, key_: Identifier<T>) => void,
    thisArg?: unknown
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
export class LazyContainer extends ScopedLazyContainer {
  public static Create(): LazyContainer {
    return new LazyContainer();
  }

  private readonly _singletonSource: InstanceSource;
  private readonly _creatorSource: CreatorSource;
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
    this._singletonSource = new Map();
    this._creatorSource = new Map();
    this._errorEventHandler = new EventHandler();
    this._resolvedEventHandler = new EventHandler();
    this._createdEventHandler = new EventHandler();
    this._disposers.push(() => {
      this._singletonSource.clear();
      this._creatorSource.clear();
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
   * Provide/Register an instance creation instruction via its class definition.
   *
   * Required parameters are determined via the class constructor and must be specified in the correct order.
   * Simple parameters (primitive values, arrays, functions) can be passed directly.
   * Object-like parameters (interfaces, record types, anonymous objects) must be provided via a matching class (NOT an instance).
   * These classes provided as parameters are resolved internally; this is only possible if their instance creation instructions are also specified by provide(), provideInstruction().
   *
   * ```ts
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
   * @param {C} constructor_
   * @param {...ConstructableParameters<C>} parameters_
   * @throws {Error} when already provided (duplicate)
   * @since 1.0.0
   */
  public provide<C extends StandardConstructor>(
    constructor_: C,
    ...parameters_: ConstructableParameters<C>
  ): void {
    this.validateDisposed(this);
    this.validateKnown(constructor_);
    this.setCreator(
      constructor_,
      (mode_) => new constructor_(...this.resolveParameters(parameters_, mode_))
    );
  }

  /**
   * Provide/Register creation instructions for a specific type (determined by the identifier).
   *
   * Use cases:
   * - custom instructions for class instances
   * - provide types/interfaces/class instructions based on inheritance/duck-typing (resolve A with B, when B extends/inherits/satisfies A)
   * - type/interface-based instruction (no need for classes) using typed injection keys
   *
   *
   * ```ts
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
   * container.instruct(aInjectionKey, () => ({value: 'hi'}))
   * container.instruct(A1, () => new A1('hello'))
   * container.provide(A2, 'greetings')
   * container.instruct(aInjectionKey2, A2)
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
   * @template T
   * @param {Identifier<T>} identifier_ Identifier (class constructor or injection key) that refers to the type to be provided/registered
   * @param {Instruction<T>} instruction_  Creation instructions: Identifier (class constructor or injection key) that refers to a type that is assignable to the target type; or an instance creation callback
   * @since 1.0.0
   */
  public instruct<T>(
    identifier_: Identifier<T>,
    instruction_: Instruction<T>
  ): void {
    this.validateDisposed(this);
    this.validateKnown(identifier_);

    this.setCreator(
      identifier_,
      this.isIdentifier(instruction_)
        ? (mode_) => this.resolve(instruction_, mode_)
        : instruction_
    );
  }

  private setCreator<T>(
    identifier_: Identifier<T>,
    creator_: Creator<T>
  ): void {
    this._creatorSource.set(identifier_, creator_);
  }

  /**
   * Resolve an instance using the provided identifier (class or injection key).
   * Suitable instructions must be provided in advance via provide() or instruct().
   *
   * ResolveMode:
   *
   * - singleton: created instance will be cached and reused when resolved later; dependencies/constructor-parameters are resolved in 'singleton' mode
   * - unique: creates a new instance each time; dependencies/constructor-parameters are resolved in 'singleton' mode
   * - deep-unique: creates a new instance each time; dependencies/constructor-parameters are resolved in 'deep-unique' mode and are therefore also unique
   *
   * @public
   * @template T
   * @param {Identifier<T>} identifier_
   * @param {ResolveMode} [mode_='singleton'] default 'singleton'
   * @returns {T}
   * @throws {Error} when no instruction are provided
   * @since 1.0.0
   */
  public resolve<T>(
    identifier_: Identifier<T>,
    mode_: ResolveMode = 'singleton'
  ): T {
    this.validateDisposed(this);
    const instanceResolver = this.getInstanceResolver(identifier_, mode_);

    if (instanceResolver) {
      const instance = instanceResolver();
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
   * Clear cached singleton instance for provided identifier (class or injection key)
   *
   * @public
   * @template {Identifier} ID
   * @param {ID} identifier_
   * @param {boolean} [includeScopes_=false]
   * @since 1.0.0
   */
  public removeSingleton<ID extends Identifier>(
    identifier_: ID,
    includeScopes_: boolean = false
  ): void {
    this.validateDisposed(this);
    this._singletonSource.delete(identifier_);

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
    this._singletonSource.clear();

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

    this._creatorSource.forEach((_, identifier_) => {
      this.resolve(identifier_, 'singleton');
    });

    this.forEachScopeInstance((instance_) => instance_.presolve());
  }

  protected createScopeInstance(shape_: LazyContainerShape): this {
    if (this.constructor !== LazyContainer) {
      this.throwError(
        this.createScopeInstance.name,
        'Class extension detected! Please override createScopeInstance to provide an instance of this extended class'
      );
    }

    return new LazyContainer(
      shape_ === 'inherited'
        ? (identifier_, mode_) => this.getInstanceResolver(identifier_, mode_)
        : undefined
    ) as this;
  }

  private forEachScopeInstance(callbackFn_: (instance_: this) => void): void {
    this.scopes.forEach((scope_) =>
      scope_.instances.forEach((instance_) => callbackFn_(instance_))
    );
  }

  private validateKnown<ID extends Identifier>(identifier_: ID): void {
    if (this._creatorSource.has(identifier_)) {
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
    const instruction = this._creatorSource.get(identifier_);

    if (instruction) {
      const instance = instruction(mode_);
      this._createdEventHandler.invoke(
        this,
        new InstanceEventArgs(identifier_, instance)
      );

      const instanceResolver: InstanceResolver<T> = () => instance;

      if (mode_ === 'singleton') {
        this._singletonSource.set<T>(identifier_, instanceResolver);
      }

      return instanceResolver;
    }
  }

  private resolveParameters<C extends StandardConstructor>(
    parameters_: ConstructableParameters<C>,
    mode_: ResolveMode
  ): ConstructorParameters<C> {
    return parameters_.map((parameter_) =>
      this.isIdentifier(parameter_)
        ? this.resolve(parameter_, mode_ === 'unique' ? 'singleton' : mode_)
        : parameter_
    ) as ConstructorParameters<C>;
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

// const c = LazyContainer.Create();
// const i = c.scope('kjj').inherited
