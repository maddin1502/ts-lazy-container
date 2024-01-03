import {
  ConstructorParameters,
  Disposable,
  EventArgs,
  EventHandler,
  StandardConstructor
} from 'ts-lib-extended';

export type ErrorKind = 'duplicate' | 'missing';
export type InstanceInstruction<T> = () => T;
export type ConstructableParameters<
  C extends StandardConstructor,
  CP extends ConstructorParameters<C> = ConstructorParameters<C>
> = {
  [K in keyof CP]:
  CP[K] extends Function
  ? CP[K]
  : CP[K] extends Array<any>
  ? CP[K]
  : CP[K] extends object
  ? StandardConstructor<CP[K]>
  : CP[K];
} extends [...infer P]
  ? P
  : never;

type LazyContainerSource = {
  has<T>(constructor_: StandardConstructor<T>): boolean;
  delete<C extends StandardConstructor>(constructor_: C): boolean;
  get<T>(
    constructor_: StandardConstructor<T>
  ): InstanceInstruction<T> | undefined;
  set<T>(
    constructor_: StandardConstructor<T>,
    instruction_: InstanceInstruction<T>
  ): LazyContainerSource;
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
  private readonly _scopes: Map<string, LazyContainer>;
  private readonly _instanceSource: LazyContainerSource;
  private readonly _instructionSource: LazyContainerSource;
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

  constructor() {
    super();
    this._scopes = new Map();
    this._instanceSource = new Map();
    this._instructionSource = new Map();
    this._errorEventHandler = new EventHandler();
    this._resolvedEventHandler = new EventHandler();
    this._constructedEventHandler = new EventHandler();
    this._disposers.push(() => {
      this._scopes.forEach((container) => container.dispose());
      this._scopes.clear();
      this._instanceSource.clear();
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

  public scope(scopeId: string): LazyContainer {
    let scopedContainer = this._scopes.get(scopeId);

    if (!scopedContainer) {
      const container = new LazyContainer();
      this._scopes.set(scopeId, container);
      scopedContainer = container;
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
      () => new constructor_(...this.resolveParameters(parameters_))
    );
  }

  public resolve<T>(constructor_: StandardConstructor<T>): T | never {
    this.validateDisposed(this);
    const instanceResolver = this.getInstanceResolver<T>(constructor_);

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
      this._instanceSource.has<C>(constructor_) ||
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
    constructor_: StandardConstructor<T>
  ): InstanceInstruction<T> | undefined {
    return (
      this._instanceSource.get(constructor_) ??
      this.resolveInstruction(constructor_)
    );
  }

  private resolveInstruction<T>(
    constructor_: StandardConstructor<T>
  ): InstanceInstruction<T> | undefined {
    const instruction = this._instructionSource.get(constructor_);

    if (instruction) {
      const instance = instruction();
      this._constructedEventHandler.invoke(
        this,
        new EventArgs({ constructor: constructor_, instance: instance })
      );
      this._instanceSource.set<T>(constructor_, () => instance);
      this._instructionSource.delete(constructor_);
      return () => instance;
    }
  }

  private resolveParameters<T, C extends StandardConstructor<T>>(
    parameters_: ConstructableParameters<C>
  ): ConstructorParameters<C> {
    // TODO: optimize type assertions
    return parameters_.map((parameter_) =>
      typeof parameter_ === 'function' &&
        parameter_.toString().startsWith('class')
        ? this.resolve(parameter_ as StandardConstructor<unknown>)
        : parameter_
    ) as ConstructorParameters<C>;
  }

  /**
   * pre resolve all instances (renounce laziness). HINT: can be used to validate container consistency
   *
   * @memberof LazyContainer
   * @throws {Error}
   */
  public presolve(): void | never {
    this.validateDisposed(this);

    if (this._instructionSource.size === 0) {
      return;
    }

    this._instructionSource.forEach(({ }, constructor_) => {
      this.resolve(constructor_);
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

    throw new Error(`[lazy-container/${origin_}]: ${message_}`);
  }
}
